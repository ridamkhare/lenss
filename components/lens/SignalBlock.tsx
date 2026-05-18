"use client"

import { useState } from "react"
import type { Signal } from "@/lib/types"
import type { DepthKey } from "@/lib/useDepthSelection"

export type { DepthKey }

const DEPTH_FIELDS: { key: DepthKey; trigger: string; label: string }[] = [
  { key: "why_it_matters", trigger: "why this matters", label: "Why this matters" },
  { key: "audience_effect", trigger: "audience effect", label: "Audience effect" },
  { key: "alternative_framing", trigger: "alternative framing", label: "Alternative framing" },
  { key: "different_steering", trigger: "different steering path", label: "Different steering path" },
  { key: "likely_next_concerns", trigger: "likely next concerns", label: "Likely next concerns" },
  { key: "hidden_intent_branching", trigger: "hidden intent branching", label: "Hidden intent branching" },
  { key: "framing_pull", trigger: "framing pull", label: "Framing pull" },
  { key: "alternate_reader_realities", trigger: "alternate reader realities", label: "Alternate reader realities" },
  { key: "conversational_trajectory", trigger: "conversational trajectory", label: "Conversational trajectory" },
]

/**
 * Per-section reveal pacing inside a signal. Each section fades in
 * with its own animation-delay so the reader sees Observation first,
 * then Consequence, then Steering, then any inline secondary layers —
 * never all at once, never racing. Each section animates as a whole
 * (no token-by-token, no partial sentences). The duration is long
 * enough to feel composed.
 */
const SECTION_DURATION_MS = 700
const STEP_MS = 700 // pause between sections
const ALT_OFFSET_MS = 350 // alt wording fades in after steering settles
const COMPRESSION_OFFSET_MS = 1100 // crystallization lands after steering finishes
const DEPTH_OFFSET_MS = 1500 // depth triggers appear last, quietly

export function SignalBlock({
  signal,
  delayMs,
  revealed: revealedProp,
  onToggle,
}: {
  signal: Signal
  delayMs: number
  /**
   * Optional controlled expansion state. When omitted, SignalBlock
   * keeps its own internal state (legacy mode — still used by
   * ArchiveList). When provided, the parent owns the state so other
   * components (e.g. NoticedMore for clipboard copy) can read it.
   */
  revealed?: Set<DepthKey>
  onToggle?: (key: DepthKey) => void
}) {
  const [localRevealed, setLocalRevealed] = useState<Set<DepthKey>>(new Set())
  const isControlled = revealedProp !== undefined && onToggle !== undefined
  const revealed = isControlled ? revealedProp : localRevealed

  const present = DEPTH_FIELDS.filter((f) => !!signal[f.key])

  function toggle(key: DepthKey) {
    if (isControlled) {
      onToggle!(key)
      return
    }
    setLocalRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const obsDelay = delayMs
  const conDelay = delayMs + STEP_MS
  const steerDelay = delayMs + STEP_MS * 2
  const altDelay = steerDelay + ALT_OFFSET_MS
  const compDelay = steerDelay + COMPRESSION_OFFSET_MS
  const depthDelay = steerDelay + DEPTH_OFFSET_MS

  return (
    <section data-clarity-mask="True">
      <div className="space-y-6">
        <div
          className="animate-reveal"
          style={{
            animationDelay: `${obsDelay}ms`,
            animationDuration: `${SECTION_DURATION_MS}ms`,
            animationFillMode: "both",
          }}
        >
          <p className="font-sans text-[10px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
            Observation
          </p>
          <p className="font-serif text-[17px] leading-[1.6] text-ink">
            {signal.observation}
          </p>
        </div>

        <div
          className="animate-reveal"
          style={{
            animationDelay: `${conDelay}ms`,
            animationDuration: `${SECTION_DURATION_MS}ms`,
            animationFillMode: "both",
          }}
        >
          <p className="font-sans text-[10px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
            Consequence
          </p>
          <p className="font-serif text-[16px] leading-[1.65] text-ink-dimmed">
            {signal.consequence}
          </p>
        </div>

        <div
          className="animate-reveal"
          style={{
            animationDelay: `${steerDelay}ms`,
            animationDuration: `${SECTION_DURATION_MS}ms`,
            animationFillMode: "both",
          }}
        >
          <p className="font-sans text-[10px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
            Steering
          </p>
          <p className="font-serif text-[16px] leading-[1.65] text-ink">
            {signal.steering}
          </p>
          {signal.alternate_wording && (
            <p
              className="mt-3 pl-6 sm:pl-8 font-serif italic text-[15px] leading-[1.6] text-ink-dimmed animate-reveal"
              style={{
                animationDelay: `${altDelay}ms`,
                animationDuration: `${SECTION_DURATION_MS}ms`,
                animationFillMode: "both",
              }}
            >
              {signal.alternate_wording}
            </p>
          )}
        </div>

        {signal.perceptual_compression && (
          <div
            className="pl-4 border-l-2 border-divider/70 animate-reveal"
            style={{
              animationDelay: `${compDelay}ms`,
              animationDuration: `${SECTION_DURATION_MS}ms`,
              animationFillMode: "both",
            }}
          >
            <p className="font-serif italic text-[16px] leading-[1.6] text-ink-dimmed">
              {signal.perceptual_compression}
            </p>
          </div>
        )}

        {present.length > 0 && (
          <div
            className="pt-1 animate-reveal"
            style={{
              animationDelay: `${depthDelay}ms`,
              animationDuration: `${SECTION_DURATION_MS}ms`,
              animationFillMode: "both",
            }}
          >
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
