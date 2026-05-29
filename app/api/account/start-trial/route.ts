import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

const TRIAL_DAYS = 10

/**
 * POST /api/account/start-trial — starts OR resumes a 10-day Pro trial.
 *
 * Bidirectional model: user can switch between Free and Pro Trial freely
 * while the trial clock is still ticking. Real-time clock — switching back
 * to Free doesn't pause the trial; clock keeps elapsing in real time.
 *
 * Enforced transitions:
 *   - free, no prior trial          → start fresh 10-day trial
 *   - free, trial_ends_at in future → resume trial (timestamps preserved)
 *   - free, trial_ends_at in past   → reject (trial used up; must upgrade)
 *   - trial                         → no-op (already trialing)
 *   - active                        → reject (already paying)
 *   - lapsed                        → reject (must fix billing first)
 */

export async function POST(req: NextRequest) {
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

  if (user.plan === "trial") {
    return NextResponse.json({ ok: true, alreadyTrial: true })
  }
  if (user.plan === "active") {
    return NextResponse.json(
      { error: "You're already on Pro." },
      { status: 400 }
    )
  }
  if (user.plan === "lapsed") {
    return NextResponse.json(
      { error: "Resume your subscription instead of starting a new trial." },
      { status: 400 }
    )
  }

  const [row] = await db
    .select({
      trialStartedAt: schema.users.trialStartedAt,
      trialEndsAt: schema.users.trialEndsAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)

  const now = new Date()

  // Case 1: First-time trial — set timestamps fresh
  if (!row?.trialStartedAt || !row?.trialEndsAt) {
    const endsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    await db
      .update(schema.users)
      .set({
        plan: "trial",
        trialStartedAt: now,
        trialEndsAt: endsAt,
      })
      .where(eq(schema.users.id, user.id))
    return NextResponse.json({ ok: true, trialEndsAt: endsAt.toISOString() })
  }

  // Case 2: Resuming — trial clock still in the future, just flip the plan
  if (row.trialEndsAt > now) {
    await db
      .update(schema.users)
      .set({ plan: "trial" })
      .where(eq(schema.users.id, user.id))
    return NextResponse.json({
      ok: true,
      resumed: true,
      trialEndsAt: row.trialEndsAt.toISOString(),
    })
  }

  // Case 3: Trial already used up
  return NextResponse.json(
    { error: "Your free trial has ended. Upgrade to Pro to continue." },
    { status: 400 }
  )
}
