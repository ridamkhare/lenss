import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq, desc } from "drizzle-orm"

export const runtime = "nodejs"

/**
 * GET /api/history — returns the authenticated user's past send-checks,
 * newest first. Capped by plan: free = last 10, pro = last 200.
 *
 * Each row contains enough to render a list card (subject, recipients,
 * verdict) plus the full results blob for the detail view.
 */

const FREE_HISTORY_CAP = 10
const PRO_HISTORY_CAP = 200

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
} as const

export async function GET(req: NextRequest) {
  const sec = checkSecurity(req)
  if (!sec.ok) {
    return NextResponse.json(
      { error: sec.reason || "forbidden" },
      { status: sec.status || 403 }
    )
  }

  const user = await resolveSessionToken(req.headers.get("authorization"))
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  }

  const isPro = user.plan === "trial" || user.plan === "active"
  const limit = isPro ? PRO_HISTORY_CAP : FREE_HISTORY_CAP

  const rows = await db
    .select({
      id: schema.checks.id,
      subject: schema.checks.subject,
      recipients: schema.checks.recipients,
      results: schema.checks.results,
      outcome: schema.checks.outcome,
      createdAt: schema.checks.createdAt,
    })
    .from(schema.checks)
    .where(eq(schema.checks.userId, user.id))
    .orderBy(desc(schema.checks.createdAt))
    .limit(limit)

  return NextResponse.json(
    {
      checks: rows.map((r) => ({
        id: r.id,
        subject: r.subject,
        recipients: r.recipients,
        results: r.results,
        outcome: r.outcome,
        created_at: r.createdAt.toISOString(),
      })),
      cap: limit,
      plan: user.plan,
    },
    { headers: NO_CACHE_HEADERS }
  )
}
