"use client"

import { useRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { LoadingPhrase } from "./LoadingPhrase"

export function InputView({
  value,
  onChange,
  onReveal,
  revealing,
}: {
  value: string
  onChange: (v: string) => void
  onReveal: (v: string) => void
  revealing: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      if (value.trim().length > 0 && !revealing) {
        onReveal(value)
      }
    }
  }

  const canReveal = value.trim().length > 0 && !revealing
  const isEmpty = value.trim().length === 0

  return (
    <div className="animate-reveal">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste an AI answer — from ChatGPT, Claude, Gemini, anything."
        disabled={revealing}
        rows={8}
        autoFocus
      />

      <div className="mt-8 flex items-center justify-between">
        <span className="font-sans text-[12px] text-ink-dimmed">
          {revealing ? (
            <LoadingPhrase initial="Reading" />
          ) : (
            <>
              <kbd className="font-sans">⌘</kbd>
              <span> + </span>
              <kbd className="font-sans">↵</kbd>
              <span> to read closely</span>
            </>
          )}
        </span>

        <Button onClick={() => onReveal(value)} disabled={!canReveal}>
          {revealing ? "Reading" : "Read closely"}
        </Button>
      </div>

      {isEmpty && !revealing && (
        <div className="mt-16 pl-4 border-l-2 border-divider/60">
          <p className="font-serif italic text-[15px] leading-[1.65] text-ink-dimmed">
            &ldquo;The closing pivots from substance to a four-item menu —
            handing the reader a buffet rather than a recommendation.&rdquo;
          </p>
          <p className="mt-3 font-sans text-[11px] text-ink-dimmed/80">
            an example reading.
          </p>
        </div>
      )}
    </div>
  )
}
