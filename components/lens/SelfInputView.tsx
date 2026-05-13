"use client"

import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

export function SelfInputView({
  value,
  onChange,
  onRead,
  reading,
}: {
  value: string
  onChange: (v: string) => void
  onRead: (v: string) => void
  reading: boolean
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      if (value.trim().length > 0 && !reading) onRead(value)
    }
  }

  const canRead = value.trim().length > 0 && !reading

  return (
    <div className="animate-reveal">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste anything you wrote, however rough."
        disabled={reading}
        rows={9}
        autoFocus
      />

      <div className="mt-8 flex items-center justify-between">
        <span className="font-sans text-[12px] text-ink-dimmed">
          {reading ? (
            <span className="animate-breathe">Reading</span>
          ) : (
            <>
              <kbd className="font-sans">⌘</kbd>
              <span> + </span>
              <kbd className="font-sans">↵</kbd>
              <span> to read</span>
            </>
          )}
        </span>

        <Button onClick={() => onRead(value)} disabled={!canRead}>
          {reading ? "Reading" : "Read"}
        </Button>
      </div>
    </div>
  )
}
