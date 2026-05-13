"use client"

import { Button } from "@/components/ui/button"

/**
 * Used for both refusal and error states. One calm sentence, one link.
 * No icons, no toasts, no color signaling.
 */
export function MessageView({
  message,
  resetLabel,
  onReset,
}: {
  message: string
  resetLabel: string
  onReset: () => void
}) {
  return (
    <div className="animate-reveal">
      <p className="font-serif text-[18px] leading-[1.65] text-ink-dimmed">
        {message}
      </p>
      <div className="mt-12">
        <Button variant="ghost" size="link" onClick={onReset}>
          {resetLabel}
        </Button>
      </div>
    </div>
  )
}
