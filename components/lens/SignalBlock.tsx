"use client"

import type { Signal } from "@/lib/types"

export function SignalBlock({
  signal,
  delayMs,
}: {
  signal: Signal
  delayMs: number
}) {
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
      </div>
    </section>
  )
}
