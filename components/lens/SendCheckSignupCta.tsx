"use client"

import { useState } from "react"

/**
 * Inline signup prompt shown after an anonymous user uses their free check.
 * Email-only, magic link. No card. The form sits inline below the rate-limit
 * notice — calm CTA, no modal, no popup.
 */

type Status = "idle" | "sending" | "sent" | "error"

export function SendCheckSignupCta({ reason }: { reason: string }) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setErrorMsg] = useState<string>("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || status === "sending") return
    setStatus("sending")
    setErrorMsg("")
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data?.error || "That didn't go through. Try again in a moment.")
        setStatus("error")
        return
      }
      setStatus("sent")
    } catch {
      setErrorMsg("That didn't go through. Try again in a moment.")
      setStatus("error")
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-12 animate-reveal rounded-md border border-divider bg-paper/60 px-6 py-5">
        <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-2 flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-[#efd356]"
          />
          check your email
        </p>
        <p className="font-serif text-[16px] leading-[1.6] text-ink">
          A magic link is on its way to <span className="font-medium">{email}</span>.
          Tap it on this device to activate Pro.
        </p>
        <p className="font-serif text-[14px] text-ink-dimmed mt-3">
          Doesn&rsquo;t arrive in a few minutes? Check spam, or{" "}
          <button
            type="button"
            onClick={() => {
              setStatus("idle")
              setEmail("")
            }}
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            try a different address
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="mt-12 animate-reveal rounded-md border border-divider bg-paper/60 px-6 py-6">
      <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
        loved that?
      </p>
      <p className="font-serif text-[17px] leading-[1.5] text-ink mb-2">
        {reason}
      </p>
      <p className="font-serif text-[14px] text-ink-dimmed mb-5">
        14 days of unlimited Pro — multi-recipient simulation, saved personas, full history. No card.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={status === "sending"}
          autoComplete="email"
          required
          className="flex-1 rounded-md border border-divider bg-paper px-4 py-2.5 font-serif text-[15px] text-ink placeholder:text-ink-dimmed/60 transition-colors duration-200 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "sending" || email.trim().length === 0}
          className="px-5 py-2.5 bg-ink text-paper font-sans text-[13px] font-medium rounded-md hover:bg-ink/85 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === "sending" ? "Sending…" : "Send me the link"}
        </button>
      </form>
      {status === "error" && (
        <p className="mt-3 font-sans text-[12px] text-ink-dimmed italic">{errorMsg}</p>
      )}
    </div>
  )
}
