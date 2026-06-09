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
          Tap it on this device to sign in — your account includes a 10-day Pro
          trial, no card required.
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
        sign up — free
      </p>
      <p className="font-serif text-[17px] leading-[1.5] text-ink mb-5">
        {reason}
      </p>

      {/* Primary: Continue with Google */}
      <a
        href="/api/auth/google/start"
        className="inline-flex w-full sm:w-auto items-center justify-center gap-3 px-5 py-3 bg-ink text-paper font-sans text-[14px] font-medium rounded-md hover:bg-ink/85 transition-colors duration-200"
      >
        <GoogleG className="w-4 h-4" />
        Continue with Google
      </a>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <span className="flex-1 h-px bg-divider" />
        <span className="font-sans text-[11px] uppercase tracking-label text-ink-dimmed/70">or</span>
        <span className="flex-1 h-px bg-divider" />
      </div>

      {/* Secondary: magic-link email */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={status === "sending"}
          autoComplete="email"
          className="flex-1 rounded-md border border-divider bg-paper px-4 py-2.5 font-serif text-[15px] text-ink placeholder:text-ink-dimmed/60 transition-colors duration-200 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "sending" || email.trim().length === 0}
          className="px-5 py-2.5 border border-divider text-ink font-sans text-[13px] font-medium rounded-md hover:border-ink-dimmed transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === "sending" ? "Sending…" : "Get a magic link"}
        </button>
      </form>

      <p className="mt-4 font-sans text-[11px] text-ink-dimmed/70">
        10-day Pro trial included, optional. No card. Cancel anytime.
      </p>

      {status === "error" && (
        <p className="mt-3 font-sans text-[12px] text-ink-dimmed italic">{errorMsg}</p>
      )}
    </div>
  )
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path fill="#FFFFFF" d="M21.6 12.227c0-.682-.061-1.337-.176-1.965H12v3.717h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.89-1.74 2.982-4.305 2.982-7.28z"/>
      <path fill="#FFFFFF" d="M12 22c2.7 0 4.964-.895 6.618-2.423l-3.232-2.51c-.896.6-2.04.955-3.386.955-2.604 0-4.81-1.76-5.596-4.123H3.064v2.59A9.996 9.996 0 0012 22z" opacity=".85"/>
      <path fill="#FFFFFF" d="M6.404 13.9a6.013 6.013 0 010-3.8V7.51H3.064a10.003 10.003 0 000 8.98l3.34-2.59z" opacity=".7"/>
      <path fill="#FFFFFF" d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.96 2.99 14.696 2 12 2 8.087 2 4.71 4.247 3.064 7.51l3.34 2.59C7.19 7.737 9.396 5.977 12 5.977z" opacity=".55"/>
    </svg>
  )
}
