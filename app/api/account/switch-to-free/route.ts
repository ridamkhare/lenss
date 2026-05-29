import { NextRequest, NextResponse } from "next/server"
import { resolveSessionToken } from "@/lib/auth"
import { checkSecurity } from "@/lib/security"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

/**
 * POST /api/account/switch-to-free — switches a trial user back to Free.
 *
 * The trial clock keeps ticking in real time (we preserve trial_ends_at).
 * User can re-enter the trial via /api/account/start-trial as long as the
 * clock is still in the future.
 *
 * Enforced transitions:
 *   - trial  → free (the only action this endpoint takes)
 *   - free   → no-op (already free)
 *   - active → rejected (must cancel via Stripe portal instead)
 *   - lapsed → rejected (must fix billing or cancel via portal)
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

  if (user.plan === "free") {
    return NextResponse.json({ ok: true, alreadyFree: true })
  }
  if (user.plan === "active") {
    return NextResponse.json(
      { error: "You're on a paid subscription. Cancel via Manage subscription instead." },
      { status: 400 }
    )
  }
  if (user.plan === "lapsed") {
    return NextResponse.json(
      { error: "Resolve billing first via Manage subscription." },
      { status: 400 }
    )
  }

  // plan === "trial" — flip to free, preserve trial_ends_at so they can resume
  await db
    .update(schema.users)
    .set({ plan: "free" })
    .where(eq(schema.users.id, user.id))

  return NextResponse.json({ ok: true })
}
