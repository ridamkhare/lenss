"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Footer } from "@/components/lens/Footer"
import { SendCheckForm } from "@/components/lens/SendCheckForm"
import { SendCheckResults } from "@/components/lens/SendCheckResults"
import { SendCheckSignupCta } from "@/components/lens/SendCheckSignupCta"
import type {
  MetaSynthesis,
  RateLimitKind,
  RecipientArchetype,
  RecipientInput,
  RecipientReading,
  SendCheckStreamEvent,
} from "@/lib/types"

type Status =
  | "empty"
  | "checking"
  | "streaming"
  | "complete"
  | "declined"
  | "rate_limited"
  | "error"

type PlanState = "anon" | "trial" | "free" | "active" | "lapsed"

interface MeResponse {
  plan: PlanState
  email?: string
  trial_ends_at?: string | null
  reveals_today?: number
  caps?: {
    daily_reveals: number
    personas: number
    history: number
    max_recipients_per_check?: number
  }
}

const TOKEN_STORAGE_KEY = "lenss-session-token"

export default function SendCheckPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20" />}>
      <SendCheckInner />
    </Suspense>
  )
}

function SendCheckInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [me, setMe] = useState<MeResponse | null>(null)
  const [activationError, setActivationError] = useState<string | null>(null)

  const [status, setStatus] = useState<Status>("empty")
  const [perRecipient, setPerRecipient] = useState<RecipientReading[]>([])
  const [recipientDeclines, setRecipientDeclines] = useState<
    { recipient: RecipientArchetype; reason: string }[]
  >([])
  const [meta, setMeta] = useState<MetaSynthesis | null>(null)
  const [message, setMessage] = useState<string>("")
  const [rateLimitKind, setRateLimitKind] = useState<RateLimitKind | null>(null)
  const [showSignup, setShowSignup] = useState(false)
  const signupCtaRef = useRef<HTMLDivElement | null>(null)

  function openSignup() {
    setShowSignup(true)
    // Scroll the CTA into view after the next paint so it's visible
    // instead of being rendered below the fold.
    requestAnimationFrame(() => {
      signupCtaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  // On mount: capture activation token from URL (set by /api/auth/activate
  // redirect), persist to localStorage, strip from URL. Then fetch /api/me.
  useEffect(() => {
    const urlToken = searchParams?.get("token")
    const urlError = searchParams?.get("activation_error")
    if (urlToken) {
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, urlToken)
      } catch {
        /* localStorage disabled — token won't persist but this call still works */
      }
      router.replace("/send-check")
    } else if (urlError) {
      setActivationError(
        urlError === "expired_or_unknown"
          ? "That link expired. Sign up again to get a fresh one."
          : "Something went wrong activating that link."
      )
      router.replace("/send-check")
    }

    const token = (() => {
      try { return localStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
    })()

    fetch(`/api/me?_=${Date.now()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`me failed: ${r.status}`)
        return (await r.json()) as MeResponse
      })
      .then((data) => {
        // Defend against malformed/missing plan field — fall back to anon
        // rather than silently rendering free.
        if (!data || typeof data.plan !== "string") {
          setMe({ plan: "anon" })
        } else {
          setMe(data)
        }
      })
      .catch(() => setMe({ plan: "anon" }))

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(input: {
    subject: string
    body: string
    recipients: RecipientInput[]
  }) {
    setStatus("checking")
    setPerRecipient([])
    setRecipientDeclines([])
    setMeta(null)
    setMessage("")
    setRateLimitKind(null)

    const token = (() => {
      try { return localStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
    })()

    try {
      const res = await fetch("/api/send-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      })

      if (!res.ok || !res.body) {
        setMessage("That didn't come through. Try again in a moment.")
        setStatus("error")
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split("\n\n")
        buffer = frames.pop() || ""

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "))
          if (!line) continue
          let event: SendCheckStreamEvent
          try {
            event = JSON.parse(line.slice(6)) as SendCheckStreamEvent
          } catch {
            continue
          }

          if (event.type === "recipient") {
            setPerRecipient((prev) => [...prev, event.reading])
            setStatus("streaming")
          } else if (event.type === "recipient_declined") {
            setRecipientDeclines((prev) => [
              ...prev,
              { recipient: event.recipient, reason: event.reason },
            ])
            setStatus("streaming")
          } else if (event.type === "meta") {
            setMeta(event.meta)
          } else if (event.type === "declined") {
            setMessage(event.reason)
            setStatus("declined")
            return
          } else if (event.type === "rate_limited") {
            setMessage(event.reason)
            setRateLimitKind(event.kind)
            setStatus("rate_limited")
            return
          } else if (event.type === "error") {
            setMessage(event.reason)
            setStatus("error")
            return
          } else if (event.type === "done") {
            setStatus("complete")
            // Refresh /api/me to update reveals_today / history_count
            if (token) {
              fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
                .then((r) => r.json())
                .then((data: MeResponse) => setMe(data))
                .catch(() => {})
            }
            return
          }
        }
      }
    } catch {
      setMessage("That didn't come through. Try again in a moment.")
      setStatus("error")
    }
  }

  function handleReset() {
    setStatus("empty")
    setPerRecipient([])
    setRecipientDeclines([])
    setMeta(null)
    setMessage("")
    setRateLimitKind(null)
  }

  const busy = status === "checking" || status === "streaming"
  const isAnon = !me || me.plan === "anon"
  const isPro = me?.plan === "trial" || me?.plan === "active"

  return (
    <main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
      <header className="mb-16 sm:mb-20 flex items-center justify-between">
        <Link
          href="/"
          className="font-sans text-[14px] font-medium tracking-wordmark text-ink lowercase hover:text-ink-dimmed transition-colors duration-200"
        >
          lenss
        </Link>
        <HeaderRight me={me} onSignupClick={openSignup} />
      </header>

      {activationError && (
        <div className="mb-10 rounded-md border border-divider bg-paper/60 px-5 py-4 animate-reveal">
          <p className="font-serif italic text-[15px] text-ink-dimmed">
            {activationError}
          </p>
        </div>
      )}

      <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
        draft check
      </p>
      <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.3] text-ink mb-6">
        Before your email lands, see what it&rsquo;s doing to the reader.
      </h1>
      <p className="font-serif text-[17px] leading-[1.6] text-ink-dimmed mb-14">
        Paste the message you&rsquo;re about to send and name who&rsquo;s
        reading it. Lenss reads it the way each of them will — the pressure,
        the positioning, the unspoken pull — before they do. No rewriting.
        Just the reading.
      </p>

      <SendCheckForm
        onSubmit={handleSubmit}
        busy={busy}
        maxRecipients={me?.caps?.max_recipients_per_check ?? 4}
      />

      <PlanFootnote me={me} busy={busy} />

      {isAnon && status === "empty" && (
        <p className="mt-6 font-sans text-[12px] text-ink-dimmed/80 leading-[1.55]">
          You have {Math.max(0, 3 - (me?.reveals_today ?? 0))} of 3 free reveals today.{" "}
          <button
            type="button"
            onClick={openSignup}
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            Sign up free
          </button>
          {" "}for 5/day, saved personas, and history.
        </p>
      )}

      {isAnon && showSignup && (
        <div ref={signupCtaRef}>
          <SendCheckSignupCta reason="Sign up free to unlock 5 reveals every day, save up to 3 recipient profiles, and keep your last 10 checks in history." />
        </div>
      )}

      <SendCheckResults
        perRecipient={perRecipient}
        declined={recipientDeclines}
        meta={meta ?? undefined}
        streaming={busy}
      />

      {status === "rate_limited" && rateLimitKind === "anon_used" && (
        <SendCheckSignupCta reason={message} />
      )}

      {status === "rate_limited" && rateLimitKind === "daily_cap_reached" && (
        <div className="mt-12 animate-reveal">
          <p className="font-serif italic text-[16px] leading-[1.55] text-ink-dimmed mb-5">
            {message}
          </p>
          {!isPro && (
            <Link
              href="/account"
              className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-sans text-[14px] font-medium rounded-md hover:bg-ink/85 transition-colors duration-200"
            >
              Upgrade to Pro — $19/mo
              <span aria-hidden>→</span>
            </Link>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="block mt-5 font-sans text-[12px] text-ink-dimmed hover:text-ink transition-colors duration-200"
          >
            ← start over
          </button>
        </div>
      )}

      {(status === "declined" || status === "error") && (
        <div className="mt-12 animate-reveal">
          <p className="font-serif italic text-[16px] leading-[1.55] text-ink-dimmed mb-4">
            {message}
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="font-sans text-[12px] text-ink-dimmed hover:text-ink transition-colors duration-200"
          >
            ← start over
          </button>
        </div>
      )}

      {status === "complete" && (
        <div className="mt-12 animate-reveal">
          <button
            type="button"
            onClick={handleReset}
            className="font-sans text-[12px] text-ink-dimmed hover:text-ink transition-colors duration-200"
          >
            check another draft
          </button>
        </div>
      )}

      {status === "complete" && isAnon && (
        <p className="mt-6 font-sans text-[11px] text-ink-dimmed/80">
          {Math.max(0, 3 - (me?.reveals_today ?? 0))} of 3 free reveals left today.
        </p>
      )}

      {status === "empty" && isAnon && (
        <p className="mt-20 font-sans text-[11px] text-ink-dimmed/70">
          Email today. The same instrument is in use at{" "}
          <Link href="/" className="underline decoration-divider underline-offset-2 hover:text-ink-dimmed transition-colors">
            lenss.one
          </Link>{" "}
          for AI replies. Research, pitches, journalism — coming as Lenss grows.
        </p>
      )}

      <Footer />
    </main>
  )
}

function HeaderRight({
  me,
  onSignupClick,
}: {
  me: MeResponse | null
  onSignupClick: () => void
}) {
  // Loading state — render nothing (avoids "sign up → free" flicker for
  // signed-in users whose me hasn't resolved yet)
  if (!me) return null

  // Anon: prominent "sign up — free" button in the header.
  if (me.plan === "anon") {
    return (
      <button
        type="button"
        onClick={onSignupClick}
        className="font-sans text-[12px] tracking-[0.04em] lowercase text-ink hover:text-ink-dimmed transition-colors duration-200"
      >
        sign up — free →
      </button>
    )
  }

  // Signed-in: plan badge linking to /account.
  return <PlanBadge me={me} />
}

function PlanBadge({ me }: { me: MeResponse | null }) {
  if (!me || me.plan === "anon") return null

  const className =
    "inline-flex items-center gap-2 font-sans text-[12px] tracking-[0.04em] lowercase text-ink-dimmed hover:text-ink transition-colors duration-200"

  // Trial and active both render as "pro" — trial is just Pro you
  // haven't paid for yet, not a separate tier. The trial countdown is
  // shown as a quiet suffix so it doesn't feel like its own thing.
  if (me.plan === "trial") {
    const daysLeft = me.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(me.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 10
    return (
      <Link href="/account" className={className}>
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[#efd356]" />
        pro · {daysLeft} {daysLeft === 1 ? "day" : "days"} free
      </Link>
    )
  }

  if (me.plan === "active") {
    return (
      <Link href="/account" className={className}>
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[#efd356]" />
        pro
      </Link>
    )
  }

  if (me.plan === "lapsed") {
    return (
      <Link href="/account" className={className}>
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
        pro · payment issue
      </Link>
    )
  }

  if (me.plan === "free") {
    return (
      <Link href="/account" className={className}>
        free
      </Link>
    )
  }

  // Unknown plan — render nothing rather than guessing
  return null
}

function PlanFootnote({
  me,
  busy,
}: {
  me: MeResponse | null
  busy: boolean
}) {
  if (busy || !me || me.plan === "anon") return null

  if (me.plan === "trial" && me.trial_ends_at) {
    const daysLeft = Math.max(0, Math.ceil(
      (new Date(me.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ))
    return (
      <p className="mt-4 font-sans text-[11px] text-ink-dimmed">
        {me.reveals_today ?? 0} of {me.caps?.daily_reveals ?? 50} reveals today. {daysLeft} {daysLeft === 1 ? "day" : "days"} free remaining — no charge until then.
      </p>
    )
  }

  if (me.plan === "free") {
    return (
      <p className="mt-4 font-sans text-[11px] text-ink-dimmed">
        {me.reveals_today ?? 0} of {me.caps?.daily_reveals ?? 5} free reveals today.
      </p>
    )
  }

  if (me.plan === "active") {
    return (
      <p className="mt-4 font-sans text-[11px] text-ink-dimmed">
        {me.reveals_today ?? 0} reveals today. Pro — $19/mo.
      </p>
    )
  }

  return null
}
