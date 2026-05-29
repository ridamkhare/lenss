import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { stripe, PRO_PRICE_ID } from "@/lib/stripe"

export const runtime = "nodejs"

/**
 * POST /api/billing/checkout — creates a Stripe Checkout session for the
 * Pro monthly subscription. Returns { url } the client redirects to.
 *
 * Auth required (session token). Reuses or creates the Stripe customer
 * tied to the user.
 */

function baseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("host") || "lenss.one"
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1")
  return isLocal ? `http://${host}` : `${proto}://${host}`
}

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

  if (!PRO_PRICE_ID) {
    console.error("[checkout] STRIPE_PRICE_ID_PRO_MONTHLY not set")
    return NextResponse.json(
      { error: "Upgrade is temporarily unavailable. Try again in a moment." },
      { status: 500 }
    )
  }

  try {
    const s = stripe()

    // Look up existing customer id (one column on the users table)
    const [row] = await db
      .select({ stripeCustomerId: schema.users.stripeCustomerId })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1)
    let customerId = row?.stripeCustomerId || null

    if (!customerId) {
      const customer = await s.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
      await db
        .update(schema.users)
        .set({ stripeCustomerId: customerId })
        .where(eq(schema.users.id, user.id))
    }

    // If the user has time remaining on their in-app trial (whether
    // currently active or paused as free), defer the first Stripe charge
    // to that date. They get to keep their free trial days AND lock in
    // continuity. Without this, clicking the button while in trial would
    // charge them today and forfeit any remaining free days.
    const [userRow] = await db
      .select({ trialEndsAt: schema.users.trialEndsAt })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1)
    const now = new Date()
    let trialEndUnix: number | undefined
    if (userRow?.trialEndsAt && userRow.trialEndsAt.getTime() > now.getTime()) {
      trialEndUnix = Math.floor(userRow.trialEndsAt.getTime() / 1000)
    }

    const base = baseUrl(req)
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      subscription_data: {
        metadata: { user_id: user.id },
        ...(trialEndUnix ? { trial_end: trialEndUnix } : {}),
      },
      success_url: `${base}/account?upgrade=success`,
      cancel_url: `${base}/send-check?upgrade=canceled`,
      customer_update: { address: "auto" },
      allow_promotion_codes: true,
    })

    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout session created without a URL." },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("[checkout] error:", err)
    return NextResponse.json(
      { error: "Something went wrong. Try again in a moment." },
      { status: 500 }
    )
  }
}
