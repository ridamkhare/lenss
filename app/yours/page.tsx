"use client"

import { useState } from "react"
import { SelfInputView } from "@/components/lens/SelfInputView"
import { SelfResultView } from "@/components/lens/SelfResultView"
import { MessageView } from "@/components/lens/MessageView"
import { ModeNav } from "@/components/lens/ModeNav"
import { Footer } from "@/components/lens/Footer"
import type { SelfReadingResult, SelfResponse } from "@/lib/types"
import { isDeclined } from "@/lib/types"

type Status = "empty" | "reading" | "shown" | "declined" | "error"

export default function YoursPage() {
  const [status, setStatus] = useState<Status>("empty")
  const [text, setText] = useState("")
  const [result, setResult] = useState<SelfReadingResult | null>(null)
  const [message, setMessage] = useState<string>("")

  async function handleRead(input: string) {
    const trimmed = input.trim()
    if (trimmed.length === 0) return

    setText(trimmed)
    setStatus("reading")

    try {
      const res = await fetch("/api/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      })

      if (!res.ok && res.status !== 400) {
        setMessage("That didn't come through. Try again in a moment.")
        setStatus("error")
        return
      }

      const data: SelfResponse = await res.json()

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

  return (
    <main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
      <header className="mb-12 sm:mb-14 flex items-center justify-between">
        <span className="font-sans text-[14px] font-medium tracking-wordmark text-ink lowercase">
          lenss
        </span>
        <ModeNav />
      </header>

      {(status === "empty" || status === "reading") && (
        <p className="mb-12 sm:mb-14 font-serif text-[17px] leading-[1.55] text-ink-dimmed">
          Paste something you wrote. See how it reads beyond what you meant.
        </p>
      )}

      {(status === "empty" || status === "reading") && (
        <SelfInputView
          value={text}
          onChange={setText}
          onRead={handleRead}
          reading={status === "reading"}
        />
      )}

      {status === "shown" && result && (
        <SelfResultView source={text} result={result} onReset={handleReset} />
      )}

      {status === "declined" && (
        <MessageView
          message={message}
          resetLabel="Read something else"
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
