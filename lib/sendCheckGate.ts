import { createHash } from "node:crypto"
import { db, schema } from "@/lib/db"
import { and, count, eq, gte, sql } from "drizzle-orm"
import { resolveSessionToken, type ResolvedUser } from "@/lib/auth"
import type { NextRequest } from "next/server"

/**
 * Rate-limit + auth gate for /api/send-check.
 *
 * Three states a request can be in:
 *   - authed (session token resolves) → daily-cap check against user's plan
 *   - anon under daily cap (3/day per IP) → allowed, counter incremented;
 *     ALSO multi-recipient is gated for anon (single-recipient only — that
 *     check happens upstream in the route, not here)
 *   - anon at daily cap → blocked, signup CTA shown
 *
 * The IP itself is never stored — only sha256(ip + salt) lands in the DB.
 */

const ANON_DAILY_CAP = 3
const FREE_DAILY = 5
const PRO_DAILY = 50

function clientIp(req: NextRequest): string {
  // Vercel-style headers first, then a generic forwarded header, then a stub.
  // Stub for local dev is fine because the rate limit is per-IP — localhost
  // requests share one bucket.
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  )
}

function hashIp(ip: string): string {
  const salt = process.env.ANON_IP_HASH_SALT
  if (!salt) {
    // Refuse to hash without a salt — the security guarantee of "we don't
    // store raw IPs" only holds if the salt isn't predictable.
    throw new Error("ANON_IP_HASH_SALT is not configured")
  }
  return createHash("sha256").update(salt + ":" + ip).digest("hex")
}

function startOfTodayUtc(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export type GateResult =
  | { allow: true; mode: "anon"; ipHash: string; revealsToday: number; capDaily: number }
  | { allow: true; mode: "user"; user: ResolvedUser; revealsToday: number }
  | { allow: false; reason: "anon_used"; capDaily: number }
  | { allow: false; reason: "daily_cap_reached"; plan: ResolvedUser["plan"]; capDaily: number }
  | { allow: false; reason: "server_misconfigured" }

export async function gate(req: NextRequest): Promise<GateResult> {
  // 1. Authenticated path
  const auth = req.headers.get("authorization")
  if (auth) {
    const user = await resolveSessionToken(auth)
    if (user) {
      const dayStart = startOfTodayUtc()
      const [{ n }] = await db
        .select({ n: count() })
        .from(schema.checks)
        .where(
          and(
            eq(schema.checks.userId, user.id),
            gte(schema.checks.createdAt, dayStart)
          )
        )
      const revealsToday = Number(n)
      const isPro = user.plan === "trial" || user.plan === "active"
      const capDaily = isPro ? PRO_DAILY : FREE_DAILY
      if (revealsToday >= capDaily) {
        return {
          allow: false,
          reason: "daily_cap_reached",
          plan: user.plan,
          capDaily,
        }
      }
      return { allow: true, mode: "user", user, revealsToday }
    }
    // Bearer header present but token doesn't resolve — fall through to anon.
  }

  // 2. Anonymous path — 3 reveals per IP per day
  try {
    const ip = clientIp(req)
    const ipHash = hashIp(ip)
    const today = todayDate()
    const existing = await db
      .select({
        checkCount: schema.anonChecks.checkCount,
        countDate: schema.anonChecks.countDate,
      })
      .from(schema.anonChecks)
      .where(eq(schema.anonChecks.ipHash, ipHash))
      .limit(1)

    let revealsToday = 0
    if (existing.length > 0 && existing[0].countDate === today) {
      revealsToday = existing[0].checkCount
    }

    if (revealsToday >= ANON_DAILY_CAP) {
      return { allow: false, reason: "anon_used", capDaily: ANON_DAILY_CAP }
    }
    return {
      allow: true,
      mode: "anon",
      ipHash,
      revealsToday,
      capDaily: ANON_DAILY_CAP,
    }
  } catch (err) {
    console.error("[gate] anon path failed:", err)
    return { allow: false, reason: "server_misconfigured" }
  }
}

/** UTC date string (YYYY-MM-DD) — matches Postgres date column format. */
function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Record that a successful check happened. For anon, upserts the IP-hash
 * row so the 7-day clock starts/restarts. For authed users, inserts a row
 * into the checks table — this serves both as history AND as the rate-limit
 * counter for the day.
 */
export async function recordCheck(opts: {
  gateResult: Extract<GateResult, { allow: true }>
  subject: string
  body: string
  recipients: unknown
  results: unknown
  outcome: "completed" | "declined" | "error"
}): Promise<void> {
  if (opts.gateResult.mode === "anon") {
    const now = new Date()
    const today = todayDate()
    // Upsert: insert new row with count=1 on first check, or increment
    // count for today. If countDate is yesterday, reset count to 1.
    await db
      .insert(schema.anonChecks)
      .values({
        ipHash: opts.gateResult.ipHash,
        checkCount: 1,
        countDate: today,
        lastCheckAt: now,
      })
      .onConflictDoUpdate({
        target: schema.anonChecks.ipHash,
        set: {
          checkCount: sql`CASE WHEN ${schema.anonChecks.countDate} = ${today} THEN ${schema.anonChecks.checkCount} + 1 ELSE 1 END`,
          countDate: today,
          lastCheckAt: now,
        },
      })
    return
  }
  // Authed path — persist full check for history
  await db.insert(schema.checks).values({
    userId: opts.gateResult.user.id,
    subject: opts.subject,
    body: opts.body,
    recipients: opts.recipients as object,
    results: opts.results as object,
    outcome: opts.outcome,
  })
}
