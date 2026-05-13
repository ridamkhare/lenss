"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { SignalBlock } from "./SignalBlock"
import { listSelfEntries } from "@/lib/storage"
import type { SelfReadingResult } from "@/lib/types"

type Status = "idle" | "loading" | "shown" | "declined" | "error"

/**
 * Cross-entry pattern read for self-mode. Only renders when ≥3 saved
 * self entries exist. Opt-in per click: nothing happens automatically.
 */
export function PatternsPanel({ minEntries = 3 }: { minEntries?: number }) {
  const [count, setCount] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [result, setResult] = useState<SelfReadingResult | null>(null)
  const [message, setMessage] = useState<string>("")

  useEffect(() => {
    setCount(listSelfEntries().length)
  }, [])

  if (count === null || count < minEntries) {
    return null
  }

  async function handleLookAcross() {
    setStatus("loading")
    setMessage("")
    const entries = listSelfEntries().map((e) => e.source)
    try {
      const res = await fetch("/api/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      })
      const data = await res.json()
      if ("declined" in data && data.declined) {
        setMessage(data.reason)
        setStatus("declined")
        return
      }
      setResult(data as SelfReadingResult)
      setStatus("shown")
    } catch {
      setMessage("That didn't come through. Try again in a moment.")
      setStatus("error")
    }
  }

  function handleDismiss() {
    setStatus("idle")
    setResult(null)
    setMessage("")
  }

  if (status === "idle") {
    return (
      <div className="mb-12 pb-10 border-b border-divider">
        <Button variant="ghost" size="link" onClick={handleLookAcross}>
          Look across your saved entries
        </Button>
        <p className="mt-2 font-sans text-[11px] text-ink-dimmed">
          Sends your saved entries to the instrument once. Nothing is stored
          on the server.
        </p>
      </div>
    )
  }

  if (status === "loading") {
    return (
      <div className="mb-12 pb-10 border-b border-divider">
        <span className="font-sans text-[12px] text-ink-dimmed animate-breathe">
          Looking across
        </span>
      </div>
    )
  }

  if (status === "shown" && result) {
    return (
      <div className="mb-12 pb-10 border-b border-divider animate-reveal">
        <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-6">
          across your saved entries
        </p>
        <div className="space-y-10 mb-8">
          {result.signals.map((s, i) => (
            <SignalBlock key={i} signal={s} delayMs={i * 200} />
          ))}
        </div>
        <Button variant="ghost" size="link" onClick={handleDismiss}>
          Close
        </Button>
      </div>
    )
  }

  return (
    <div className="mb-12 pb-10 border-b border-divider animate-reveal">
      <p className="font-serif text-[16px] leading-[1.6] text-ink-dimmed mb-4">
        {message}
      </p>
      <Button variant="ghost" size="link" onClick={handleDismiss}>
        Close
      </Button>
    </div>
  )
}
