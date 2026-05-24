"use client"

import { useEffect, useState } from "react"
import { InputView } from "@/components/lens/InputView"
import { ResultView } from "@/components/lens/ResultView"
import { MessageView } from "@/components/lens/MessageView"
import { ModeNav } from "@/components/lens/ModeNav"
import { Footer } from "@/components/lens/Footer"
import { NoticedMore } from "@/components/lens/NoticedMore"
import { HeroExample, type HeroTier } from "@/components/lens/HeroExample"
import { streamRequest } from "@/lib/streamClient"
import type { RevealResult } from "@/lib/types"
import { useDepthSelection } from "@/lib/useDepthSelection"

const VISIT_FLAG_KEY = "lenss-has-visited"

type Status =
  | "empty"
  | "revealing" // model called, no signals yet
  | "streaming" // first signal arrived, more may follow
  | "shown" // stream complete
  | "declined"
  | "error"

export default function Page() {
  const [status, setStatus] = useState<Status>("empty")
  const [text, setText] = useState("")
  const [result, setResult] = useState<RevealResult | null>(null)
  const [message, setMessage] = useState<string>("")
  const [heroTier, setHeroTier] = useState<HeroTier>("first")
  const depth = useDepthSelection()

  // Detect returning visitor for the hero's progressive condensation.
  // First render shows the full "first" hero so cold traffic isn't
  // starved of orientation; if localStorage says they've been here
  // before, the hero gently condenses to a residue line on mount.
  useEffect(() => {
    try {
      if (localStorage.getItem(VISIT_FLAG_KEY)) {
        setHeroTier("returning")
      } else {
        localStorage.setItem(VISIT_FLAG_KEY, "1")
      }
    } catch {
      // localStorage disabled (private mode, quota, etc.) — stay on
      // "first" tier. Better to over-orient than under-orient.
    }
  }, [])

  async function handleReveal(input: string) {
    const trimmed = input.trim()
    if (trimmed.length === 0) return

    setStatus("revealing")
    setResult({ signals: [] })
    setMessage("")

    try {
      for await (const event of streamRequest("/api/reveal", {
        text: trimmed,
      })) {
        if (event.type === "signal") {
          setResult((prev) => ({
            signals: [...(prev?.signals || []), event.signal],
          }))
          setStatus((prev) => (prev === "revealing" ? "streaming" : prev))
        } else if (event.type === "declined") {
          setMessage(event.reason)
          setStatus("declined")
          return
        } else if (event.type === "error") {
          setMessage(event.reason)
          setStatus((prev) =>
            prev === "streaming" || prev === "shown" ? "shown" : "error"
          )
          return
        } else if (event.type === "done") {
          setStatus("shown")
          return
        }
      }
    } catch {
      setMessage("That didn't come through. Try again in a moment.")
      setStatus("error")
    }
  }

  function handleReset() {
    setStatus("empty")
    setText("")
    setResult(null)
    setMessage("")
    depth.reset()
  }

  const isEmpty = status === "empty" || status === "revealing"
  const isResult =
    (status === "streaming" || status === "shown") &&
    result !== null &&
    result.signals.length > 0
  const streaming = status === "streaming"

  return (
    <main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
      <header className="mb-12 sm:mb-14 flex items-center justify-between">
        <span className="font-sans text-[14px] font-medium tracking-wordmark text-ink lowercase">
          lenss
        </span>
        <ModeNav />
      </header>

      {isEmpty && (
        <>
          <HeroExample tier={heroTier} />

          <p className="mt-10 sm:mt-12 mb-3 font-serif text-[15px] leading-[1.55] text-ink-dimmed">
            Paste an AI answer. See what shaped it, and where it leads.
          </p>

          <InputView
            value={text}
            onChange={setText}
            onReveal={handleReveal}
            revealing={status === "revealing"}
          />
        </>
      )}

      {isResult && result && (
        <ResultView
          source={text}
          result={result}
          onReset={handleReset}
          streaming={streaming}
          revealedBySignal={depth.revealedBySignal}
          onDepthToggle={depth.toggle}
        />
      )}

      {status === "shown" && result && result.signals.length > 0 && (
        <NoticedMore
          mode="read"
          source={text}
          signals={result.signals}
          revealedBySignal={depth.revealedBySignal}
        />
      )}

      {status === "declined" && (
        <MessageView
          message={message}
          resetLabel="Another"
          onReset={handleReset}
        />
      )}

      {status === "error" && (
        <MessageView
          message={message}
          resetLabel="Start over"
          onReset={handleReset}
        />
      )}

      <Footer />
    </main>
  )
}
