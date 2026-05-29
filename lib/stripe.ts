import Stripe from "stripe"

/**
 * Stripe client. Lazy-init so the module is safe to import even when the
 * env var is missing (the throw fires only when something actually tries to
 * use the client). Lets static analysis / build-time imports succeed.
 */

let _client: Stripe | null = null

export function stripe(): Stripe {
  if (_client) return _client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (and Vercel env)."
    )
  }
  _client = new Stripe(key, {
    // Pin API version so Stripe rolling updates don't silently change behavior.
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
  })
  return _client
}

export const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID_PRO_MONTHLY || ""
