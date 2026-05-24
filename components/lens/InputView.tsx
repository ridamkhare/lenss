"use client"

import { useRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { LoadingPhrase } from "./LoadingPhrase"
import { ModKey } from "./ModKey"

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
        placeholder="Paste an AI answer — from ChatGPT, Claude, Gemini, anything."
        disabled={revealing}
        rows={8}
      />

      <div className="mt-8 flex items-center justify-between">
        <span className="font-sans text-[12px] text-ink-dimmed">
          {revealing ? (
            <LoadingPhrase initial="Reading" />
          ) : (
            <>
              <ModKey />
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
    </div>
  )
}
