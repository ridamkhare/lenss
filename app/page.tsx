"use client"

import { useState } from "react"
import { InputView } from "@/components/lens/InputView"
import { ResultView } from "@/components/lens/ResultView"
import { MessageView } from "@/components/lens/MessageView"
import { ModeNav } from "@/components/lens/ModeNav"
import { Footer } from "@/components/lens/Footer"
import { streamRequest } from "@/lib/streamClient"
import type { RevealResult } from "@/lib/types"

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
        <p className="mb-12 sm:mb-14 font-serif text-[17px] leading-[1.55] text-ink-dimmed">
          Paste an AI answer. See what shaped it, and where it leads.
        </p>
      )}

      {isEmpty && (
        <InputView
          value={text}
          onChange={setText}
          onReveal={handleReveal}
          revealing={status === "revealing"}
        />
      )}

      {isResult && result && (
        <ResultView
          source={text}
          result={result}
          onReset={handleReset}
          streaming={streaming}
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
