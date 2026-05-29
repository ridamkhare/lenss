import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"

/**
 * POST /api/billing/portal — creates a Stripe Customer Portal session for
 * self-service subscription management (cancel, update card, view invoices).
 * Returns { url } the client redirects to.
 *
 * Auth required. User must have a stripe_customer_id (i.e., they've gone
 * through Checkout at least once).
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
      { error: "Sign in first." },
      { status: 401 }
    )
  }

  const [row] = await db
    .select({ stripeCustomerId: schema.users.stripeCustomerId })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)
  const customerId = row?.stripeCustomerId
  if (!customerId) {
    return NextResponse.json(
      { error: "No subscription to manage yet. Upgrade first." },
      { status: 400 }
    )
  }

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl(req)}/account`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("[portal] error:", err)
    return NextResponse.json(
      { error: "Could not open the management portal. Try again in a moment." },
      { status: 500 }
    )
  }
}
