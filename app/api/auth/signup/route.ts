import { NextRequest, NextResponse } from "next/server"
import { checkSecurity } from "@/lib/security"
import { isEmailShape, issueMagicTokenForEmail } from "@/lib/auth"
import { magicLinkEmail, sendEmail } from "@/lib/email"

export const runtime = "nodejs"

function originBaseUrl(req: NextRequest): string {
  // Prefer the request's origin so the magic link points back at the same
  // host the user signed up on (works for localhost, vercel previews, prod).
  const origin = req.headers.get("origin")
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, "")
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("host") || "lenss.one"
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  const sec = checkSecurity(req)
  if (!sec.ok) {
    return NextResponse.json(
      { error: sec.reason || "forbidden" },
      { status: sec.status || 403 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const rawEmail = body?.email

  if (!isEmailShape(rawEmail)) {
    return NextResponse.json(
      { error: "That email doesn't look right. Try again." },
      { status: 400 }
    )
  }

  try {
    const { email, magicToken, isNewUser } = await issueMagicTokenForEmail(rawEmail)
    const base = originBaseUrl(req)
    const activateUrl = `${base}/api/auth/activate?token=${magicToken}`
    const { subject, text, html } = magicLinkEmail(activateUrl, isNewUser)
    const sent = await sendEmail({ to: email, subject, text, html })

    // We always return the same shape, regardless of whether the email is
    // a new signup or a re-signup, so the response can't be used to enumerate
    // existing accounts.
    if (!sent.ok) {
      console.error("[signup] email send failed:", sent.reason)
      // Don't expose send-failure to the client — log and return generic ok.
      // The user can hit "resend link" if it never arrives.
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[signup] error:", err)
    return NextResponse.json(
      { error: "Something went quiet on our side. Try again in a moment." },
      { status: 500 }
    )
  }
}
