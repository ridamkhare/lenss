"use client"

import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { LoadingPhrase } from "./LoadingPhrase"

export function CompareInputView({
  a,
  b,
  onChangeA,
  onChangeB,
  onCompare,
  comparing,
}: {
  a: string
  b: string
  onChangeA: (v: string) => void
  onChangeB: (v: string) => void
  onCompare: (a: string, b: string) => void
  comparing: boolean
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      if (canCompare) onCompare(a, b)
    }
  }

  const canCompare =
    a.trim().length > 0 && b.trim().length > 0 && !comparing

  return (
    <div className="animate-reveal">
      <div className="grid gap-6 sm:gap-8 sm:grid-cols-2">
        <div>
          <label
            htmlFor="answer-a"
            className="block font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3"
          >
            Answer A
          </label>
          <Textarea
            id="answer-a"
            value={a}
            onChange={(e) => onChangeA(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste an AI answer."
            disabled={comparing}
            rows={6}
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="answer-b"
            className="block font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3"
          >
            Answer B
          </label>
          <Textarea
            id="answer-b"
            value={b}
            onChange={(e) => onChangeB(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a second AI answer to the same question."
            disabled={comparing}
            rows={6}
          />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <span className="font-sans text-[12px] text-ink-dimmed">
          {comparing ? (
            <LoadingPhrase initial="Comparing" />
          ) : (
            <>
              <kbd className="font-sans">⌘</kbd>
              <span> + </span>
              <kbd className="font-sans">↵</kbd>
              <span> to compare</span>
            </>
          )}
        </span>

        <Button onClick={() => onCompare(a, b)} disabled={!canCompare}>
          {comparing ? "Comparing" : "Compare"}
        </Button>
      </div>
    </div>
  )
}
