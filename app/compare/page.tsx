"use client"

import { useEffect, useState } from "react"
import { CompareInputView } from "@/components/lens/CompareInputView"
import { CompareResultView } from "@/components/lens/CompareResultView"
import { MessageView } from "@/components/lens/MessageView"
import { ModeNav } from "@/components/lens/ModeNav"
import { Footer } from "@/components/lens/Footer"
import { DeeperLayer } from "@/components/lens/DeeperLayer"
import { takeComparePrefill } from "@/lib/storage"
import { streamRequest } from "@/lib/streamClient"
import type { CompareResult } from "@/lib/types"

type Status =
  | "empty"
  | "comparing"
  | "streaming"
  | "shown"
  | "declined"
  | "error"

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
    setResult({ signals: [] })
    setMessage("")

    try {
      for await (const event of streamRequest("/api/compare", {
        a: textA.trim(),
        b: textB.trim(),
      })) {
        if (event.type === "signal") {
          setResult((prev) => ({
            signals: [...(prev?.signals || []), event.signal],
          }))
          setStatus((prev) => (prev === "comparing" ? "streaming" : prev))
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
    setA("")
    setB("")
    setResult(null)
    setMessage("")
  }

  const isEmpty = status === "empty" || status === "comparing"
  const isResult =
    (status === "streaming" || status === "shown") &&
    result !== null &&
    result.signals.length > 0
  const streaming = status === "streaming"

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

      {isEmpty && (
        <p className="mb-12 sm:mb-14 font-serif text-[17px] leading-[1.55] text-ink-dimmed">
          Paste two AI answers to the same question. See how each shapes the
          reader.
        </p>
      )}

      {isEmpty && (
        <CompareInputView
          a={a}
          b={b}
          onChangeA={setA}
          onChangeB={setB}
          onCompare={handleCompare}
          comparing={status === "comparing"}
        />
      )}

      {isResult && result && (
        <CompareResultView
          sourceA={a}
          sourceB={b}
          result={result}
          onReset={handleReset}
          streaming={streaming}
        />
      )}

      {status === "shown" && result && result.signals.length > 0 && (
        <DeeperLayer
          mode="compare"
          sourceA={a}
          sourceB={b}
          signals={result.signals}
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
