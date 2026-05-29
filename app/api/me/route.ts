import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq, and, gte, count } from "drizzle-orm"

export const runtime = "nodejs"

/**
 * GET /api/me — returns the authenticated user's plan + usage. Used by the
 * /send-check page to render the right plan badge, footnote, and gating.
 *
 * Unauthenticated requests return `{plan: "anon", ...}` rather than 401 —
 * the page renders anon state instead of an error.
 */

const FREE_DAILY_REVEALS = 5
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
    return NextResponse.json({
      plan: "anon",
      caps: {
        daily_reveals: 1, // first-check-anonymous allowance
        personas: 0,
        history: 0,
      },
    })
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
      }
    : {
        daily_reveals: FREE_DAILY_REVEALS,
        personas: FREE_PERSONA_CAP,
        history: FREE_HISTORY_CAP,
      }

  return NextResponse.json({
    plan: user.plan,
    email: user.email,
    trial_ends_at:
      user.plan === "trial" ? user.trialEndsAt.toISOString() : null,
    reveals_today: revealsToday,
    personas_count: personasCount,
    history_count: historyCount,
    caps,
  })
}
