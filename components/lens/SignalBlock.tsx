"use client"

import { useState } from "react"
import type { Signal } from "@/lib/types"

type DepthKey =
  | "why_it_matters"
  | "audience_effect"
  | "alternative_framing"
  | "different_steering"
  | "likely_next_concerns"

const DEPTH_FIELDS: { key: DepthKey; trigger: string; label: string }[] = [
  { key: "why_it_matters", trigger: "why this matters", label: "Why this matters" },
  { key: "audience_effect", trigger: "audience effect", label: "Audience effect" },
  { key: "alternative_framing", trigger: "alternative framing", label: "Alternative framing" },
  { key: "different_steering", trigger: "different steering path", label: "Different steering path" },
  { key: "likely_next_concerns", trigger: "likely next concerns", label: "Likely next concerns" },
]

export function SignalBlock({
  signal,
  delayMs,
}: {
  signal: Signal
  delayMs: number
}) {
  const [revealed, setRevealed] = useState<Set<DepthKey>>(new Set())

  const present = DEPTH_FIELDS.filter((f) => !!signal[f.key])

  function toggle(key: DepthKey) {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
          {signal.alternate_wording && (
            <p className="mt-3 pl-6 sm:pl-8 font-serif italic text-[15px] leading-[1.6] text-ink-dimmed">
              {signal.alternate_wording}
            </p>
          )}
        </div>

        {present.length > 0 && (
          <div className="pt-1">
            <div className="font-sans text-[11px] text-ink-dimmed">
              {present.map((f, i) => {
                const isOpen = revealed.has(f.key)
                return (
                  <span key={f.key}>
                    {i > 0 && (
                      <span className="mx-3 text-ink-dimmed/50">·</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(f.key)}
                      className={
                        isOpen
                          ? "text-ink transition-colors duration-200"
                          : "hover:text-ink transition-colors duration-200"
                      }
                    >
                      {f.trigger}
                    </button>
                  </span>
                )
              })}
            </div>

            <div className="space-y-5">
              {present.map((f) =>
                revealed.has(f.key) ? (
                  <div key={`${f.key}-body`} className="mt-5 animate-reveal">
                    <p className="font-sans text-[10px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
                      {f.label}
                    </p>
                    <p className="font-serif text-[15px] leading-[1.65] text-ink-dimmed">
                      {signal[f.key]}
                    </p>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
