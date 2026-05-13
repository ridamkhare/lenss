"use client"

import { useState } from "react"
import { InputView } from "@/components/lens/InputView"
import { ResultView } from "@/components/lens/ResultView"
import { MessageView } from "@/components/lens/MessageView"
import { ModeNav } from "@/components/lens/ModeNav"
import { Footer } from "@/components/lens/Footer"
import type { RevealResult, AnalyzeResponse } from "@/lib/types"
import { isDeclined } from "@/lib/types"

type Status = "empty" | "revealing" | "shown" | "declined" | "error"

export default function Page() {
  const [status, setStatus] = useState<Status>("empty")
  const [text, setText] = useState("")
  const [result, setResult] = useState<RevealResult | null>(null)
  const [message, setMessage] = useState<string>("")

  async function handleReveal(input: string) {
    const trimmed = input.trim()
    if (trimmed.length === 0) return

    setStatus("revealing")

    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      })

      if (!res.ok && res.status !== 400) {
        setMessage("That didn't come through. Try again in a moment.")
        setStatus("error")
        return
      }

      const data: AnalyzeResponse = await res.json()

      if (isDeclined(data)) {
        setMessage(data.reason)
        setStatus("declined")
        return
      }

      setResult(data)
      setStatus("shown")
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

  return (
    <main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
      <header className="mb-12 sm:mb-14 flex items-center justify-between">
        <span className="font-sans text-[14px] font-medium tracking-wordmark text-ink lowercase">
          lens
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

      {status === "shown" && result && (
        <ResultView source={text} result={result} onReset={handleReset} />
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
