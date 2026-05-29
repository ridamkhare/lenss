import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { razorpay } from "@/lib/razorpay"

export const runtime = "nodejs"

/**
 * POST /api/billing/razorpay/cancel — cancels the user's active Razorpay
 * subscription at the end of the current billing cycle. User keeps Pro
 * access until cycle end; webhook will fire subscription.cancelled which
 * flips plan to "free".
 *
 * Razorpay has no hosted customer portal (unlike Stripe), so we own this
 * surface entirely. For v1 we only offer cancel; pause/resume can come later.
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

  const [row] = await db
    .select({ subId: schema.users.razorpaySubscriptionId })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)

  if (!row?.subId) {
    return NextResponse.json(
      { error: "No active subscription to cancel." },
      { status: 400 }
    )
  }

  try {
    const rzp = razorpay()
    // cancel_at_cycle_end: true → user keeps access until period end, then
    // subscription auto-ends and Razorpay fires subscription.cancelled.
    await rzp.subscriptions.cancel(row.subId, true)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[razorpay/cancel] error:", err)
    return NextResponse.json(
      { error: "Couldn't cancel. Try again or email us." },
      { status: 500 }
    )
  }
}
