/**
 * Landing hero. Shows a short AI-style passage, a lenss reading of it,
 * and the next message that follows from the reading.
 *
 * Two tiers based on visit familiarity (passed in via `tier` prop):
 *   - "first": full onboarding arc (passage + observation + try asking)
 *     rendered at reduced visual dominance — supporting context for
 *     the textarea, not the featured content itself.
 *   - "returning": a single faded residue line. The user is assumed to
 *     remember the ritual; the hero stays present but recedes to a
 *     whisper. No hide/show controls, no toggles — quiet condensation.
 *
 * Three whisper-level labels in "first" tier orient perception. The
 * "returning" tier shows only the observation as a remembered echo.
 */

const EXAMPLE_PASSAGE =
  "Procrastination usually comes from feeling overwhelmed. Try breaking tasks into smaller steps, removing distractions, and starting with just five minutes. Most importantly, be kind to yourself."

const EXAMPLE_OBSERVATION =
  "The reply offers four general fixes without asking what you're avoiding."

const EXAMPLE_CONSEQUENCE =
  "Useful-sounding, but slightly beside the point."

const EXAMPLE_NEXT_MESSAGE =
  "What is it about this task that I keep avoiding?"

export type HeroTier = "first" | "returning"

export function HeroExample({ tier }: { tier: HeroTier }) {
  if (tier === "returning") {
    return (
      <section
        aria-label="A remembered reading"
        className="animate-reveal"
      >
        <p className="font-sans text-[11px] text-ink-dimmed/60 mb-2">
          lenss noticed
        </p>
        <p className="font-serif italic text-[14px] leading-[1.6] text-ink-dimmed/80 pl-4 border-l-2 border-divider/40">
          {EXAMPLE_OBSERVATION}
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="A sample reading"
      className="animate-reveal"
    >
      <p className="font-sans text-[11px] text-ink-dimmed/70 mb-3">
        AI response
      </p>
      <p className="font-serif text-[15px] leading-[1.6] text-ink-dimmed whitespace-pre-wrap">
        {EXAMPLE_PASSAGE}
      </p>

      <p className="font-sans text-[11px] text-ink-dimmed/70 mt-6 mb-3">
        lenss noticed
      </p>
      <div className="pl-4 border-l-2 border-divider/60 space-y-3">
        <p className="font-serif italic text-[14px] leading-[1.6] text-ink-dimmed">
          {EXAMPLE_OBSERVATION}
        </p>
        <p className="font-serif text-[14px] leading-[1.6] text-ink-dimmed">
          {EXAMPLE_CONSEQUENCE}
        </p>
      </div>

      <p className="font-sans text-[11px] text-ink-dimmed/70 mt-6 mb-3">
        Try asking
      </p>
      <p className="font-serif italic text-[14px] leading-[1.6] text-ink/75">
        &ldquo;{EXAMPLE_NEXT_MESSAGE}&rdquo;
      </p>
    </section>
  )
}
