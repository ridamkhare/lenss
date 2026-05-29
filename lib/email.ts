/**
 * Email sender. Uses Resend in production (when RESEND_API_KEY is set);
 * falls back to console-logging the message in dev/local. The fallback
 * means signup + magic-link works end-to-end on localhost with no email
 * provider configured — copy-paste the link from your dev server terminal.
 */

const RESEND_API_URL = "https://api.resend.com/emails"

export interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || "Lenss <hello@lenss.one>"

  if (!apiKey) {
    // Dev fallback: print to server console so we can copy the magic link
    // without needing a real provider configured.
    console.log("─".repeat(64))
    console.log("[email] (no RESEND_API_KEY — printing instead of sending)")
    console.log(`  From:    ${from}`)
    console.log(`  To:      ${opts.to}`)
    console.log(`  Subject: ${opts.subject}`)
    console.log()
    console.log(opts.text)
    console.log("─".repeat(64))
    return { ok: true }
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html ?? undefined,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("[email] resend error:", res.status, detail.slice(0, 200))
      return { ok: false, reason: `resend_${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error("[email] resend fetch failed:", err)
    return { ok: false, reason: "fetch_failed" }
  }
}

/**
 * Compose the magic-link email body. Keeps copy aligned with the calm
 * brand voice — no exclamation marks, no urgency tactics, just the link
 * and what to do with it.
 */
export function magicLinkEmail(activateUrl: string, isNewUser: boolean): {
  subject: string
  text: string
  html: string
} {
  const subject = isNewUser
    ? "Activate your Lenss draft check"
    : "Your new Lenss draft check link"
  const text = `${isNewUser ? "Welcome to Lenss." : "Here's the link you asked for."}

Tap the link below to activate this device. It works once, and the link expires in 24 hours.

${activateUrl}

If you didn't request this, ignore the email — nothing happens until the link is clicked.

— Lenss`
  const html = `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#2C2C2C">
${isNewUser ? "Welcome to Lenss." : "Here&rsquo;s the link you asked for."}
</p>
<p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#666">
Tap the link below to activate this device. It works once, and the link expires in 24 hours.
</p>
<p style="margin:24px 0">
<a href="${activateUrl}" style="display:inline-block;background:#2C2C2C;color:#FAF7F0;text-decoration:none;padding:12px 24px;border-radius:6px;font-family:-apple-system,Helvetica,sans-serif;font-size:14px">Activate Lenss</a>
</p>
<p style="font-family:Georgia,serif;font-size:13px;line-height:1.55;color:#888">
If the button doesn&rsquo;t work, paste this URL into your browser:<br>
<span style="color:#666">${activateUrl}</span>
</p>
<p style="font-family:Georgia,serif;font-size:13px;color:#888;margin-top:32px">
If you didn&rsquo;t request this, ignore this email &mdash; nothing happens until the link is clicked.
</p>
<p style="font-family:Georgia,serif;font-size:13px;color:#888;margin-top:24px">
&mdash; Lenss
</p>`
  return { subject, text, html }
}
