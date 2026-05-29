import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

const TRIAL_DAYS = 10

/**
 * POST /api/account/start-trial — flips a free user into a 10-day Pro trial.
 *
 * Trial is one-time per user — once started (and ended), they can't restart
 * it. To get Pro again after trial, they must upgrade via Stripe Checkout.
 *
 * Enforced state transitions:
 *   - free          → trial (allowed; sets timestamps)
 *   - trial         → no-op (already trialing)
 *   - active/lapsed → rejected (they're already paying or already had one)
 *
 * Idempotent on free→trial: if called twice while already free, the second
 * call would also flip to trial. We guard against this with trialStartedAt:
 * if it's already set (even after revert to free), they've used their trial.
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

  // Check the user hasn't already used a trial
  const [row] = await db
    .select({ trialStartedAt: schema.users.trialStartedAt })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)
  if (row?.trialStartedAt) {
    return NextResponse.json(
      { error: "You've already used your free trial. Upgrade to Pro to continue." },
      { status: 400 }
    )
  }

  const now = new Date()
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
