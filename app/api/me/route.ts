import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq, and, gte, count } from "drizzle-orm"
import { createHash } from "node:crypto"

export const runtime = "nodejs"

/**
 * GET /api/me — returns the authenticated user's plan + usage. Used by the
 * /send-check page to render the right plan badge, footnote, and gating.
 *
 * Unauthenticated requests return `{plan: "anon", ...}` with the anon
 * reveal count for today so the page can render "N of 3 free today"
 * without needing a separate endpoint.
 */

const ANON_DAILY_CAP = 3
const FREE_DAILY_REVEALS = 5

// /api/me must never be cached — its answer depends on the user's session
// token + their current usage, which changes per-request. Browser caches
// or service workers serving stale "free" responses to a newly-anon user
// (or vice versa) is the entire failure mode we're guarding against.
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
} as const
const FREE_PERSONA_CAP = 3
const FREE_HISTORY_CAP = 10
const PRO_DAILY_REVEALS = 50
const PRO_PERSONA_CAP = 30
const PRO_HISTORY_CAP = 200

function startOfTodayUtc(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  )
}

function hashIp(ip: string): string | null {
  const salt = process.env.ANON_IP_HASH_SALT
  if (!salt) return null
  return createHash("sha256").update(salt + ":" + ip).digest("hex")
}

export async function GET(req: NextRequest) {
  const sec = checkSecurity(req)
  if (!sec.ok) {
    return NextResponse.json(
      { error: sec.reason || "forbidden" },
      { status: sec.status || 403 }
    )
  }

  const auth = req.headers.get("authorization")
  const user = await resolveSessionToken(auth)
  if (!user) {
    // Anonymous — return today's anon usage count so the page can render
    // "N of 3 free today" without a second endpoint round-trip
    let revealsToday = 0
    try {
      const ipHash = hashIp(clientIp(req))
      if (ipHash) {
        const [row] = await db
          .select({
            checkCount: schema.anonChecks.checkCount,
            countDate: schema.anonChecks.countDate,
          })
          .from(schema.anonChecks)
          .where(eq(schema.anonChecks.ipHash, ipHash))
          .limit(1)
        if (row && row.countDate === todayDate()) {
          revealsToday = row.checkCount
        }
      }
    } catch {
      /* anon counter is best-effort */
    }
    return NextResponse.json(
      {
        plan: "anon",
        reveals_today: revealsToday,
        caps: {
          daily_reveals: ANON_DAILY_CAP,
          personas: 0,
          history: 0,
          max_recipients_per_check: 3, // anon + free both get up to 3 recipients
        },
      },
      { headers: NO_CACHE_HEADERS }
    )
  }

  const dayStart = startOfTodayUtc()

  const [[revealsCountRow], [personasCountRow], [historyCountRow]] =
    await Promise.all([
      db
        .select({ n: count() })
        .from(schema.checks)
        .where(
          and(
            eq(schema.checks.userId, user.id),
            gte(schema.checks.createdAt, dayStart)
          )
        ),
      db
        .select({ n: count() })
        .from(schema.personas)
        .where(eq(schema.personas.userId, user.id)),
      db
        .select({ n: count() })
        .from(schema.checks)
        .where(eq(schema.checks.userId, user.id)),
    ])

  const revealsToday = Number(revealsCountRow.n)
  const personasCount = Number(personasCountRow.n)
  const historyCount = Number(historyCountRow.n)

  const isPro = user.plan === "trial" || user.plan === "active"
  const caps = isPro
    ? {
        daily_reveals: PRO_DAILY_REVEALS,
        personas: PRO_PERSONA_CAP,
        history: PRO_HISTORY_CAP,
        max_recipients_per_check: 4, // pro gets one more recipient than free
      }
    : {
        daily_reveals: FREE_DAILY_REVEALS,
        personas: FREE_PERSONA_CAP,
        history: FREE_HISTORY_CAP,
        max_recipients_per_check: 3, // free caps at 3 — Pro is the differentiator
      }

  return NextResponse.json(
    {
      plan: user.plan,
      email: user.email,
      // Returned for both trial and free plans so /account can compute
      // "resume trial — N days left" when a free user has a paused trial
      trial_ends_at: user.trialEndsAt ? user.trialEndsAt.toISOString() : null,
      reveals_today: revealsToday,
      personas_count: personasCount,
      history_count: historyCount,
      caps,
    },
    { headers: NO_CACHE_HEADERS }
  )
}
