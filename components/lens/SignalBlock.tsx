"use client"

import { useState } from "react"
import type { Signal } from "@/lib/types"

/**
 * One Signal — three labeled blocks plus optional click-to-expand
 * alternate wording. Same typographic system as the rest of the product.
 */
export function SignalBlock({
  signal,
  delayMs,
}: {
  signal: Signal
  delayMs: number
}) {
  const [expanded, setExpanded] = useState(false)
  const hasAlt = !!signal.alternate_wording

  return (
    <section
      className="animate-reveal"
      style={{ animationDelay: `${delayMs}ms`, animationDuration: "520ms" }}
    >
      <div className="space-y-6">
        <div>
          <p className="font-sans text-[10px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
            Observation
          </p>
          <p className="font-serif text-[17px] leading-[1.6] text-ink">
            {signal.observation}
          </p>
        </div>

        <div>
          <p className="font-sans text-[10px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
            Consequence
          </p>
          <p className="font-serif text-[16px] leading-[1.65] text-ink-dimmed">
            {signal.consequence}
          </p>
        </div>

        <div>
          <p className="font-sans text-[10px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
            Steering
          </p>
          <p className="font-serif text-[16px] leading-[1.65] text-ink">
            {signal.steering}
          </p>
        </div>

        {hasAlt && !expanded && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="font-sans text-[11px] text-accent hover:text-accent-hover transition-colors duration-200"
            >
              Show alternate wording
            </button>
          </div>
        )}

        {hasAlt && expanded && (
          <div className="pt-1 animate-reveal">
            <p className="font-sans text-[10px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
              Alternate wording
            </p>
            <p className="font-serif italic text-[16px] leading-[1.65] text-ink">
              {signal.alternate_wording}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
