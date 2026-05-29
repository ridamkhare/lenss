import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { stripe } from "@/lib/stripe"
import type Stripe from "stripe"

export const runtime = "nodejs"

/**
 * POST /api/webhooks/stripe — Stripe sends subscription lifecycle events here.
 * Validates the signature using the webhook secret, then updates the user's
 * plan based on the event type.
 *
 * Events we care about (others are ignored):
 *   - customer.subscription.created / updated → plan = "active" if
 *     subscription is active; "lapsed" if past_due or unpaid
 *   - customer.subscription.deleted → plan = "free" (subscription canceled
 *     after grace period or immediately)
 *
 * Webhook secret comes from `STRIPE_WEBHOOK_SECRET`. In production this is
 * set after creating the webhook endpoint in Stripe dashboard.
 *
 * Idempotency: each event has a unique stripe_event_id. We could dedupe
 * via a table (webhook_events) but for v1 the operations are themselves
 * idempotent (setting plan = X on a user is repeatable). Add a dedupe table
 * if/when we add side effects that aren't.
 */

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not set")
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 }
    )
  }

  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 })
  }

  // Stripe needs the raw body bytes (not the parsed JSON) to verify the
  // signature. NextRequest.text() returns the raw string body.
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    console.error("[webhook] signature verify failed:", err)
    return NextResponse.json({ error: "invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(sub)
        break
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(sub)
        break
      }
      default:
        // Ignore other event types — Stripe sends many, we only act on
        // subscription lifecycle.
        break
    }
  } catch (err) {
    console.error("[webhook] handler error for", event.type, err)
    // Return 500 so Stripe will retry. Their retry policy is exponential
    // backoff over 3 days, so a transient DB blip self-heals.
    return NextResponse.json({ error: "handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id

  // Map Stripe status → our plan enum
  let plan: "active" | "lapsed" | "free"
  switch (sub.status) {
    case "active":
    case "trialing":
      plan = "active"
      break
    case "past_due":
    case "unpaid":
    case "incomplete":
      plan = "lapsed"
      break
    case "canceled":
    case "incomplete_expired":
      plan = "free"
      break
    default:
      // paused, etc. — treat as lapsed to be safe
      plan = "lapsed"
  }

  await db
    .update(schema.users)
    .set({
      plan,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionStatus: sub.status,
    })
    .where(eq(schema.users.stripeCustomerId, customerId))
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id

  await db
    .update(schema.users)
    .set({
      plan: "free",
      stripeSubscriptionStatus: "canceled",
    })
    .where(eq(schema.users.stripeCustomerId, customerId))
}
