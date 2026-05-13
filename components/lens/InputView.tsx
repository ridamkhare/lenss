"use client"

import { useRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

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

  return (
    <div className="animate-reveal">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste an AI answer."
        disabled={revealing}
        rows={8}
        autoFocus
      />

      <div className="mt-8 flex items-center justify-between">
        <span className="font-sans text-[12px] text-ink-dimmed">
          {revealing ? (
            <span className="animate-breathe">Revealing</span>
          ) : (
            <>
              <kbd className="font-sans">⌘</kbd>
              <span> + </span>
              <kbd className="font-sans">↵</kbd>
              <span> to reveal</span>
            </>
          )}
        </span>

        <Button onClick={() => onReveal(value)} disabled={!canReveal}>
          {revealing ? "Revealing" : "Reveal"}
        </Button>
      </div>
    </div>
  )
}
