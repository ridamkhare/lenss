"use client"

import { useEffect, useState } from "react"

const PHRASES = [
  "Tracing emphasis",
  "Following conversational direction",
  "Looking for what the answer avoids",
  "Watching where the answer leads",
  "Reading for what becomes more likely",
]

const DOT_INTERVAL_MS = 650
const PHRASE_LEAD_MS = 2200
const PHRASE_INTERVAL_MS = 4200
const PHRASE_FADE_MS = 700

/**
 * Loading indicator for the pre-first-signal wait. Three layers of
 * unobtrusive motion:
 *   - A slow dot cycle (Reading / Reading. / Reading.. / Reading...)
 *     that keeps the indicator feeling alive without performing.
 *   - After ~2s, perceptual phrases fade through, describing what the
 *     instrument is attending to. Calm, observational, never theatrical.
 *   - Phrase swaps use a soft opacity transition; nothing moves
 *     spatially, nothing scales, nothing slides.
 */
export function LoadingPhrase({ initial = "Reading" }: { initial?: string }) {
  const [dotCount, setDotCount] = useState(0)
  const [phraseIndex, setPhraseIndex] = useState(-1)
  const [phraseOpacity, setPhraseOpacity] = useState(1)

  useEffect(() => {
    const id = setInterval(() => {
      setDotCount((d) => (d + 1) % 4)
    }, DOT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setPhraseIndex(0), PHRASE_LEAD_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (phraseIndex < 0) return
    const id = setInterval(() => {
      setPhraseOpacity(0)
      setTimeout(() => {
        setPhraseIndex((p) => (p + 1) % PHRASES.length)
        setPhraseOpacity(1)
      }, PHRASE_FADE_MS)
    }, PHRASE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [phraseIndex >= 0])

  const dots = ".".repeat(dotCount)
  const showPhrase = phraseIndex >= 0
  const label = showPhrase ? PHRASES[phraseIndex] : initial

  return (
    <span
      className="font-sans text-[12px] text-ink-dimmed"
      aria-live="polite"
    >
      <span
        style={{
          opacity: phraseOpacity,
          transition: `opacity ${PHRASE_FADE_MS}ms ease-in-out`,
        }}
      >
        {label}
      </span>
      <span aria-hidden>{dots}</span>
    </span>
  )
}
