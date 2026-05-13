"use client"

import { useEffect, useState } from "react"
import { CompareInputView } from "@/components/lens/CompareInputView"
import { CompareResultView } from "@/components/lens/CompareResultView"
import { MessageView } from "@/components/lens/MessageView"
import { ModeNav } from "@/components/lens/ModeNav"
import { Footer } from "@/components/lens/Footer"
import { takeComparePrefill } from "@/lib/storage"
import type { CompareResult, CompareResponse } from "@/lib/types"
import { isDeclined } from "@/lib/types"

type Status = "empty" | "comparing" | "shown" | "declined" | "error"

export default function ComparePage() {
  const [status, setStatus] = useState<Status>("empty")
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const [result, setResult] = useState<CompareResult | null>(null)
  const [message, setMessage] = useState<string>("")

  useEffect(() => {
    const prefill = takeComparePrefill()
    if (prefill) setA(prefill)
  }, [])

  async function handleCompare(textA: string, textB: string) {
    if (textA.trim().length === 0 || textB.trim().length === 0) return

    setStatus("comparing")

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: textA.trim(), b: textB.trim() }),
      })

      if (!res.ok && res.status !== 400) {
        setMessage("That didn't come through. Try again in a moment.")
        setStatus("error")
        return
      }

      const data: CompareResponse = await res.json()

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
    setA("")
    setB("")
    setResult(null)
    setMessage("")
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
      <header className="mb-12 sm:mb-14 flex items-center justify-between">
        <a
          href="/"
          className="font-sans text-[14px] font-medium tracking-wordmark text-ink lowercase hover:text-ink-dimmed transition-colors duration-200"
        >
          lenss
        </a>
        <ModeNav />
      </header>

      {(status === "empty" || status === "comparing") && (
        <p className="mb-12 sm:mb-14 font-serif text-[17px] leading-[1.55] text-ink-dimmed">
          Paste two AI answers to the same question. See how each shapes the reader.
        </p>
      )}

      {(status === "empty" || status === "comparing") && (
        <CompareInputView
          a={a}
          b={b}
          onChangeA={setA}
          onChangeB={setB}
          onCompare={handleCompare}
          comparing={status === "comparing"}
        />
      )}

      {status === "shown" && result && (
        <CompareResultView
          sourceA={a}
          sourceB={b}
          result={result}
          onReset={handleReset}
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
