"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { Footer } from "@/components/lens/Footer"
import { SendCheckResults } from "@/components/lens/SendCheckResults"
import type {
  MetaSynthesis,
  RecipientArchetype,
  RecipientReading,
} from "@/lib/types"

interface CheckRow {
  id: string
  subject: string
  recipients: Array<{ archetype: string; context: string | null }>
  results: {
    per_recipient?: RecipientReading[]
    meta?: MetaSynthesis | null
  } | null
  outcome: "completed" | "declined" | "error"
  created_at: string
}

interface HistoryResponse {
  checks: CheckRow[]
  cap: number
  plan: string
}

const TOKEN_STORAGE_KEY = "lenss-session-token"

export default function HistoryPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20" />}>
      <HistoryInner />
    </Suspense>
  )
}

function HistoryInner() {
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    const token = (() => {
      try { return localStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
    })()
    if (!token) {
      setData(null)
      setLoading(false)
      return
    }
    fetch(`/api/history?_=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`history ${r.status}`)
        return (await r.json()) as HistoryResponse
      })
      .then((d) => setData(d))
      .catch(() => setError("Couldn't load your history. Try again."))
      .finally(() => setLoading(false))
  }, [])

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
        history
      </p>
      <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.3] text-ink mb-10">
        Your past draft checks.
      </h1>

      {loading && (
        <p className="font-serif italic text-[15px] text-ink-dimmed">Loading…</p>
      )}

      {!loading && !data && (
        <div className="space-y-5">
          <p className="font-serif text-[16px] leading-[1.6] text-ink-dimmed">
            You&rsquo;re not signed in on this device. Sign in to see your past
            checks.
          </p>
          <Link
            href="/send-check"
            className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-sans text-[14px] font-medium rounded-md hover:bg-ink/85 transition-colors duration-200"
          >
            Go to draft check
          </Link>
        </div>
      )}

      {error && (
        <p className="font-serif italic text-[15px] text-ink-dimmed">{error}</p>
      )}

      {data && data.checks.length === 0 && (
        <div className="space-y-4">
          <p className="font-serif text-[16px] leading-[1.6] text-ink-dimmed">
            No checks yet. Once you run your first draft check, it shows up here.
          </p>
          <Link
            href="/send-check"
            className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-sans text-[14px] font-medium rounded-md hover:bg-ink/85 transition-colors duration-200"
          >
            Run your first check
          </Link>
        </div>
      )}

      {data && data.checks.length > 0 && (
        <>
          <p className="font-sans text-[12px] text-ink-dimmed mb-8">
            Showing your last {data.checks.length} of {data.cap}{" "}
            {data.plan === "free" || data.plan === "lapsed" ? "free-tier" : "pro-tier"} history slots.
          </p>
          <ul className="space-y-3">
            {data.checks.map((c) => (
              <li key={c.id}>
                <HistoryItem
                  check={c}
                  open={openId === c.id}
                  onToggle={() => setOpenId(openId === c.id ? null : c.id)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <Footer />
    </main>
  )
}

function HistoryItem({
  check,
  open,
  onToggle,
}: {
  check: CheckRow
  open: boolean
  onToggle: () => void
}) {
  const date = new Date(check.created_at)
  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  const recipientLabels = check.recipients
    .map((r) => r.archetype)
    .join(" · ")

  const verdict = check.results?.meta?.send_readiness ?? null
  const verdictLabel =
    verdict === "ship"
      ? "ship"
      : verdict === "review"
        ? "review"
        : verdict === "reconsider"
          ? "reconsider"
          : check.outcome === "declined"
            ? "declined"
            : check.outcome === "error"
              ? "error"
              : "—"

  return (
    <div className="rounded-md border border-divider bg-paper/40 hover:bg-paper/70 transition-colors duration-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4"
      >
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[16px] text-ink truncate">
            {check.subject || "(no subject)"}
          </p>
          <p className="font-sans text-[11px] text-ink-dimmed mt-1">
            {dateLabel} · {recipientLabels || "no recipients"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-sans text-[11px] uppercase tracking-label text-ink-dimmed">
            {verdictLabel}
          </span>
          <span aria-hidden className="text-ink-dimmed text-[14px]">
            {open ? "−" : "+"}
          </span>
        </div>
      </button>

      {open && check.results && (
        <div className="px-5 pb-5 border-t border-divider">
          <SendCheckResults
            perRecipient={check.results.per_recipient ?? []}
            declined={[]}
            meta={check.results.meta ?? undefined}
            streaming={false}
          />
        </div>
      )}
    </div>
  )
}
