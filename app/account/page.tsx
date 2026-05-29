"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Footer } from "@/components/lens/Footer"

type Plan = "anon" | "trial" | "free" | "active" | "lapsed"

interface MeResponse {
  plan: Plan
  email?: string
  trial_ends_at?: string | null
  reveals_today?: number
  history_count?: number
  caps?: { daily_reveals: number; personas: number; history: number }
}

const TOKEN_STORAGE_KEY = "lenss-session-token"

export default function AccountPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20" />}>
      <AccountInner />
    </Suspense>
  )
}

function AccountInner() {
  const searchParams = useSearchParams()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionState, setActionState] = useState<"idle" | "loading" | "error">("idle")
  const [actionMessage, setActionMessage] = useState<string>("")

  const upgradeBanner = searchParams?.get("upgrade")

  useEffect(() => {
    const token = (() => {
      try { return localStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
    })()
    if (!token) {
      setMe({ plan: "anon" })
      setLoading(false)
      return
    }
    fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: MeResponse) => setMe(data))
      .catch(() => setMe({ plan: "anon" }))
      .finally(() => setLoading(false))
  }, [])

  async function handleUpgrade() {
    const token = (() => {
      try { return localStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
    })()
    if (!token) return
    setActionState("loading")
    setActionMessage("")
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok || !data?.url) {
        setActionState("error")
        setActionMessage(data?.error || "Couldn't open checkout. Try again.")
        return
      }
      window.location.href = data.url
    } catch {
      setActionState("error")
      setActionMessage("Couldn't open checkout. Try again.")
    }
  }

  async function postWithToken(url: string, errMsg: string) {
    const token = (() => {
      try { return localStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
    })()
    if (!token) return
    setActionState("loading")
    setActionMessage("")
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setActionState("error")
        setActionMessage(data?.error || errMsg)
        return
      }
      // Refresh /api/me to reflect new state
      const refresh = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const refreshed = await refresh.json()
      setMe(refreshed)
      setActionState("idle")
    } catch {
      setActionState("error")
      setActionMessage(errMsg)
    }
  }

  async function handleStartTrial() {
    await postWithToken("/api/account/start-trial", "Couldn't start the trial. Try again.")
  }

  async function handleSwitchToFree() {
    await postWithToken("/api/account/switch-to-free", "Couldn't switch back to Free. Try again.")
  }

  async function handleManageSubscription() {
    const token = (() => {
      try { return localStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
    })()
    if (!token) return
    setActionState("loading")
    setActionMessage("")
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok || !data?.url) {
        setActionState("error")
        setActionMessage(data?.error || "Couldn't open the management portal. Try again.")
        return
      }
      window.location.href = data.url
    } catch {
      setActionState("error")
      setActionMessage("Couldn't open the management portal. Try again.")
    }
  }

  function handleSignOut() {
    try { localStorage.removeItem(TOKEN_STORAGE_KEY) } catch {}
    window.location.href = "/send-check"
  }

  return (
    <main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
      <header className="mb-16 sm:mb-20 flex items-center justify-between">
        <Link
          href="/"
          className="font-sans text-[14px] font-medium tracking-wordmark text-ink lowercase hover:text-ink-dimmed transition-colors duration-200"
        >
          lenss
        </Link>
        <Link
          href="/send-check"
          className="font-sans text-[12px] tracking-[0.04em] lowercase text-ink-dimmed hover:text-ink transition-colors duration-200"
        >
          ← draft check
        </Link>
      </header>

      <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
        account
      </p>
      <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.3] text-ink mb-12">
        Your Lenss account.
      </h1>

      {upgradeBanner === "success" && (
        <div className="mb-10 rounded-md border border-divider bg-paper/60 px-5 py-4 animate-reveal">
          <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-2 flex items-center gap-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[#efd356]" />
            you&rsquo;re on pro
          </p>
          <p className="font-serif text-[15px] leading-[1.55] text-ink">
            Your subscription is active. The next charge happens at the end of
            your trial. Welcome.
          </p>
        </div>
      )}

      {loading && (
        <p className="font-serif italic text-[15px] text-ink-dimmed">Loading…</p>
      )}

      {!loading && me?.plan === "anon" && (
        <div className="space-y-6">
          <p className="font-serif text-[16px] leading-[1.6] text-ink-dimmed">
            You&rsquo;re not signed in on this device.
          </p>
          <Link
            href="/send-check"
            className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-sans text-[14px] font-medium rounded-md hover:bg-ink/85 transition-colors duration-200"
          >
            Go to draft check
          </Link>
        </div>
      )}

      {!loading && me && me.plan !== "anon" && (
        <div className="space-y-10">
          <section>
            <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
              email
            </p>
            <p className="font-serif text-[17px] text-ink">{me.email}</p>
          </section>

          <section>
            <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
              plan
            </p>
            <PlanLine me={me} />
          </section>

          <section>
            <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
              usage today
            </p>
            <p className="font-serif text-[16px] text-ink-dimmed">
              {me.reveals_today ?? 0} of {me.caps?.daily_reveals ?? 0} reveals.
            </p>
          </section>

          <section>
            <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
              history
            </p>
            <Link
              href="/history"
              className="font-serif text-[16px] text-ink underline decoration-divider underline-offset-2 hover:text-ink-dimmed transition-colors"
            >
              See your past draft checks →
            </Link>
          </section>

          <section className="pt-4 border-t border-divider">
            <PlanActions
              me={me}
              actionState={actionState}
              onStartTrial={handleStartTrial}
              onSwitchToFree={handleSwitchToFree}
              onUpgrade={handleUpgrade}
              onManageSubscription={handleManageSubscription}
              onSignOut={handleSignOut}
            />
            {actionState === "error" && (
              <p className="mt-3 font-sans text-[12px] text-ink-dimmed italic">{actionMessage}</p>
            )}
          </section>
        </div>
      )}

      <Footer />
    </main>
  )
}

function formatTrialEnd(d: Date | null): string {
  if (!d) return "trial end"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function PlanActions({
  me,
  actionState,
  onStartTrial,
  onSwitchToFree,
  onUpgrade,
  onManageSubscription,
  onSignOut,
}: {
  me: MeResponse
  actionState: "idle" | "loading" | "error"
  onStartTrial: () => void
  onSwitchToFree: () => void
  onUpgrade: () => void
  onManageSubscription: () => void
  onSignOut: () => void
}) {
  const loading = actionState === "loading"
  const trialEnds = me.trial_ends_at ? new Date(me.trial_ends_at) : null
  const trialInFuture = trialEnds ? trialEnds.getTime() > Date.now() : false
  const daysLeft = trialEnds
    ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  const primary =
    "inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-sans text-[14px] font-medium rounded-md hover:bg-ink/85 transition-colors duration-200 disabled:opacity-50"
  const secondary =
    "inline-flex items-center gap-2 px-6 py-3 border border-divider text-ink font-sans text-[14px] font-medium rounded-md hover:border-ink-dimmed transition-colors duration-200 disabled:opacity-50"
  const signOut =
    "px-6 py-3 border border-divider text-ink-dimmed font-sans text-[14px] rounded-md hover:text-ink hover:border-ink-dimmed transition-colors duration-200"

  return (
    <div>
      {me.plan === "trial" && trialInFuture && (
        <p className="font-sans text-[12px] text-ink-dimmed mb-4 leading-[1.55]">
          You already have Pro features for the next {daysLeft} {daysLeft === 1 ? "day" : "days"} — no card needed. The button below lets you keep them after {formatTrialEnd(trialEnds)}. Your trial keeps running, no charge until then, cancel anytime before for free.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
      {/* Free + never used trial */}
      {me.plan === "free" && !trialEnds && (
        <>
          <button type="button" onClick={onStartTrial} disabled={loading} className={primary}>
            {loading ? "Starting…" : "Try Pro free for 10 days"}
          </button>
          <button type="button" onClick={onUpgrade} disabled={loading} className={secondary}>
            Or upgrade to Pro — $19/mo
          </button>
        </>
      )}

      {/* Free + trial paused, time remaining */}
      {me.plan === "free" && trialInFuture && (
        <>
          <button type="button" onClick={onStartTrial} disabled={loading} className={primary}>
            {loading ? "Resuming…" : `Resume Pro — ${daysLeft} ${daysLeft === 1 ? "day" : "days"} free left`}
          </button>
          <button type="button" onClick={onUpgrade} disabled={loading} className={secondary}>
            Or upgrade to Pro — $19/mo
          </button>
        </>
      )}

      {/* Free + trial expired */}
      {me.plan === "free" && trialEnds && !trialInFuture && (
        <button type="button" onClick={onUpgrade} disabled={loading} className={primary}>
          {loading ? "Opening…" : "Upgrade to Pro — $19/mo"}
        </button>
      )}

      {/* Trial — user already has Pro features; the action is "lock it in"
          so they keep them after trial ends. Stripe collects card today,
          first $19 charge is deferred until trial_end (set on checkout). */}
      {me.plan === "trial" && (
        <>
          <button type="button" onClick={onUpgrade} disabled={loading} className={primary}>
            {loading ? "Opening…" : `Stay on Pro after ${formatTrialEnd(trialEnds)}`}
          </button>
          <button type="button" onClick={onSwitchToFree} disabled={loading} className={secondary}>
            {loading ? "Switching…" : "Switch back to Free"}
          </button>
        </>
      )}

      {/* Active */}
      {me.plan === "active" && (
        <button type="button" onClick={onManageSubscription} disabled={loading} className={primary}>
          {loading ? "Opening…" : "Manage subscription"}
        </button>
      )}

      {/* Lapsed */}
      {me.plan === "lapsed" && (
        <button type="button" onClick={onManageSubscription} disabled={loading} className={primary}>
          {loading ? "Opening…" : "Fix billing"}
        </button>
      )}

      <button type="button" onClick={onSignOut} className={signOut}>
        Sign out
      </button>
      </div>
    </div>
  )
}

function PlanLine({ me }: { me: MeResponse }) {
  const trialEnds = me.trial_ends_at ? new Date(me.trial_ends_at) : null
  const trialInFuture = trialEnds ? trialEnds.getTime() > Date.now() : false
  const daysLeft = trialEnds
    ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  if (me.plan === "trial" && trialInFuture) {
    return (
      <p className="font-serif text-[17px] text-ink">
        Pro · <span className="text-ink-dimmed">{daysLeft} {daysLeft === 1 ? "day" : "days"} free remaining, no charge yet</span>
      </p>
    )
  }
  if (me.plan === "active") {
    return <p className="font-serif text-[17px] text-ink">Pro · $19/mo</p>
  }
  if (me.plan === "lapsed") {
    return (
      <p className="font-serif text-[17px] text-ink">
        Pro · <span className="text-ink-dimmed">payment issue</span>
      </p>
    )
  }
  // Free
  if (trialInFuture) {
    return (
      <p className="font-serif text-[17px] text-ink">
        Free · <span className="text-ink-dimmed">Pro paused — {daysLeft} {daysLeft === 1 ? "day" : "days"} free left to resume</span>
      </p>
    )
  }
  return <p className="font-serif text-[17px] text-ink">Free</p>
}
