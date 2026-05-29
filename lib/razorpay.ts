import Razorpay from "razorpay"

/**
 * Razorpay client. Lazy-init so the module is safe to import even when
 * env vars are missing (the throw fires only when something actually tries
 * to use the client). Mirrors the pattern in lib/stripe.ts.
 */

let _client: Razorpay | null = null

export function razorpay(): Razorpay {
  if (_client) return _client
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new Error(
      "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set. Add them to .env.local (and Vercel env)."
    )
  }
  _client = new Razorpay({ key_id: keyId, key_secret: keySecret })
  return _client
}

export const RAZORPAY_PLAN_ID = process.env.RAZORPAY_PLAN_ID || ""

/**
 * Returns the active payment provider for this deployment.
 * Defaults to "razorpay" — flip via PAYMENT_PROVIDER=stripe if you reactivate
 * the Stripe flow (kept intact as fallback).
 */
export function paymentProvider(): "razorpay" | "stripe" {
  const p = (process.env.PAYMENT_PROVIDER || "razorpay").toLowerCase()
  return p === "stripe" ? "stripe" : "razorpay"
}
