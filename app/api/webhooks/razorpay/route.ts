import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import crypto from "crypto"

export const runtime = "nodejs"

/**
 * POST /api/webhooks/razorpay — Razorpay subscription lifecycle events.
 *
 * Validates HMAC-SHA256 signature using RAZORPAY_WEBHOOK_SECRET, then
 * updates the user's plan based on event type.
 *
 * Events we care about (others ignored):
 *   - subscription.activated  → plan = active (initial setup complete)
 *   - subscription.charged    → plan = active, log status (recurring charge ok)
 *   - subscription.halted     → plan = lapsed (retries exhausted, payment failed)
 *   - subscription.cancelled  → plan = free (user or admin cancelled)
 *   - subscription.completed  → plan = free (billing term ended naturally)
 *
 * Idempotency: setting plan = X on a user is repeatable, so re-delivery is
 * harmless. Add a webhook_events dedupe table if/when side effects appear.
 *
 * The webhook payload nests the subscription entity under
 * payload.subscription.entity (Razorpay convention).
 */

type RzpStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "paused"

interface RzpSubscriptionEntity {
  id: string
  status: RzpStatus
  notes?: Record<string, string> | null
  customer_id?: string | null
}

interface RzpWebhookEvent {
  event: string
  payload: {
    subscription?: { entity: RzpSubscriptionEntity }
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error("[razorpay/webhook] RAZORPAY_WEBHOOK_SECRET not set")
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 }
    )
  }

  const signature = req.headers.get("x-razorpay-signature")
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 })
  }

  // Razorpay verifies the raw body bytes with HMAC-SHA256 over the secret.
  // NextRequest.text() returns the unparsed string body.
  const rawBody = await req.text()

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")

  // Constant-time compare to avoid timing attacks
  const sigBuf = Buffer.from(signature, "utf8")
  const expBuf = Buffer.from(expected, "utf8")
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    console.error("[razorpay/webhook] signature verify failed")
    return NextResponse.json({ error: "invalid signature" }, { status: 400 })
  }

  let event: RzpWebhookEvent
  try {
    event = JSON.parse(rawBody) as RzpWebhookEvent
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const sub = event.payload?.subscription?.entity
  if (!sub) {
    // Some Razorpay events (payment-only, refunds, etc.) won't carry a
    // subscription entity. Ack and ignore so Razorpay doesn't retry.
    return NextResponse.json({ received: true, ignored: event.event })
  }

  try {
    switch (event.event) {
      case "subscription.activated":
      case "subscription.charged":
        await setPlanForSubscription(sub, "active")
        break
      case "subscription.halted":
        await setPlanForSubscription(sub, "lapsed")
        break
      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.expired":
        await setPlanForSubscription(sub, "free")
        break
      default:
        // Other events (created, authenticated, pending, paused, updated…)
        // don't flip plan — ack and move on.
        break
    }
  } catch (err) {
    console.error("[razorpay/webhook] handler error for", event.event, err)
    // 500 so Razorpay retries
    return NextResponse.json({ error: "handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function setPlanForSubscription(
  sub: RzpSubscriptionEntity,
  plan: "active" | "lapsed" | "free"
) {
  // Subscription id is the primary key we stored on /subscribe.
  // Fallback to user_id from notes if needed (older subscriptions or edge cases).
  const updated = await db
    .update(schema.users)
    .set({
      plan,
      razorpaySubscriptionId: sub.id,
      razorpaySubscriptionStatus: sub.status,
      ...(sub.customer_id ? { razorpayCustomerId: sub.customer_id } : {}),
    })
    .where(eq(schema.users.razorpaySubscriptionId, sub.id))
    .returning({ id: schema.users.id })

  if (updated.length === 0 && sub.notes?.user_id) {
    // Fallback: subscription was created but the id wasn't persisted yet
    // (race between webhook and /subscribe response). Match by user_id from
    // the subscription notes.
    await db
      .update(schema.users)
      .set({
        plan,
        razorpaySubscriptionId: sub.id,
        razorpaySubscriptionStatus: sub.status,
        ...(sub.customer_id ? { razorpayCustomerId: sub.customer_id } : {}),
      })
      .where(eq(schema.users.id, sub.notes.user_id))
  }
}
