import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { razorpay, RAZORPAY_PLAN_ID } from "@/lib/razorpay"

export const runtime = "nodejs"

/**
 * POST /api/billing/razorpay/subscribe — creates a Razorpay subscription for
 * the Pro monthly plan (₹1599/mo). Returns { url } the client redirects to.
 *
 * Mirrors the Stripe checkout flow. Auth required (session token).
 *
 * Trial handling: if the user has time remaining on their in-app trial
 * (trial_ends_at in the future), we set start_at to that timestamp so the
 * first charge is deferred to trial end. No card-on-file friction is hidden —
 * Razorpay still collects authentication up front (RBI e-mandate), but the
 * money only moves after the trial ends.
 *
 * total_count = 120 (10 years monthly) → effectively "until cancelled".
 * Razorpay requires a finite term; this is the convention.
 */

const MAX_BILLING_CYCLES = 120

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
    return NextResponse.json(
      { error: "Sign in first to upgrade." },
      { status: 401 }
    )
  }

  if (!RAZORPAY_PLAN_ID) {
    console.error("[razorpay/subscribe] RAZORPAY_PLAN_ID not set")
    return NextResponse.json(
      { error: "Upgrade is temporarily unavailable. Try again in a moment." },
      { status: 500 }
    )
  }

  try {
    const rzp = razorpay()

    // Defer first charge if user still has trial days left. start_at must be
    // a future Unix timestamp; Razorpay rejects past dates.
    const [userRow] = await db
      .select({ trialEndsAt: schema.users.trialEndsAt })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1)
    const nowMs = Date.now()
    let startAtUnix: number | undefined
    if (
      userRow?.trialEndsAt &&
      userRow.trialEndsAt.getTime() > nowMs
    ) {
      startAtUnix = Math.floor(userRow.trialEndsAt.getTime() / 1000)
    }

    const subscription = await rzp.subscriptions.create({
      plan_id: RAZORPAY_PLAN_ID,
      customer_notify: 1,
      quantity: 1,
      total_count: MAX_BILLING_CYCLES,
      ...(startAtUnix ? { start_at: startAtUnix } : {}),
      notes: { user_id: user.id, email: user.email },
    })

    // Persist subscription id so the webhook can map back even before the
    // first event fires (some events arrive with only customer_id, others
    // with subscription_id — store both as they appear).
    await db
      .update(schema.users)
      .set({
        razorpaySubscriptionId: subscription.id,
        razorpaySubscriptionStatus: subscription.status,
      })
      .where(eq(schema.users.id, user.id))

    if (!subscription.short_url) {
      return NextResponse.json(
        { error: "Subscription created without a checkout URL." },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: subscription.short_url })
  } catch (err) {
    console.error("[razorpay/subscribe] error:", err)
    return NextResponse.json(
      { error: "Something went wrong. Try again in a moment." },
      { status: 500 }
    )
  }
}
