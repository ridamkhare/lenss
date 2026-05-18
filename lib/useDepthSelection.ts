"use client"

import { useCallback, useState } from "react"

/**
 * Keys for the optional depth fields a Signal may carry. Mirrors the
 * optional fields in lib/types.ts → Signal that the SignalBlock UI
 * exposes via expandable triggers.
 */
export type DepthKey =
  | "why_it_matters"
  | "audience_effect"
  | "alternative_framing"
  | "different_steering"
  | "likely_next_concerns"
  | "hidden_intent_branching"
  | "framing_pull"
  | "alternate_reader_realities"
  | "conversational_trajectory"

/**
 * Tracks which depth fields the user has expanded, per signal index.
 *
 * Lives at the V1-page level so the same state is visible both to
 * SignalBlock (which renders the triggers + bodies) and to NoticedMore
 * (which copies the currently-explored insights to the clipboard).
 *
 * Reset on every fresh analysis — the page calls reset() inside its
 * handleReset to wipe any expanded depth carried over from a prior
 * passage.
 */
export function useDepthSelection() {
  const [revealedBySignal, setRevealedBySignal] = useState<
    Record<number, Set<DepthKey>>
  >({})

  const toggle = useCallback((signalIndex: number, key: DepthKey) => {
    setRevealedBySignal((prev) => {
      const next = { ...prev }
      const current = new Set(next[signalIndex] ?? [])
      if (current.has(key)) current.delete(key)
      else current.add(key)
      next[signalIndex] = current
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setRevealedBySignal({})
  }, [])

  return { revealedBySignal, toggle, reset }
}
