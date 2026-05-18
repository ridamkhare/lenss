/**
 * Signal is the unit of analysis. Every mode returns one or more
 * signals — the count is governed by materiality, not a quota. Surface
 * a signal only when it adds a distinct perceptual or strategic
 * insight. Refuse rather than pad. No numerical cap — the prompt's
 * MATERIALITY_RULE is the only gate.
 */
export interface Signal {
  /** What's observable in the text. Anchored with a verbatim quote. */
  observation: string
  /** Likely effect on a reader. Pragmatic, concrete. */
  consequence: string
  /** A small, specific steering suggestion. */
  steering: string
  /** Optional concrete rewrite. Rendered inline beneath steering. */
  alternate_wording?: string
  /**
   * Optional perceptual-compression layer — one terse behavioral
   * realization that compresses the signal into an immediate insight.
   * Rendered inline (italic, lighter, subtly bordered). Not all
   * signals warrant one.
   */
  perceptual_compression?: string
  /**
   * Optional depth fields. Cap of 2 per signal — used sparingly,
   * surfaced only when the user clicks to expand. Each must add a
   * different angle, not restate consequence or steering.
   */
  why_it_matters?: string
  audience_effect?: string
  alternative_framing?: string
  different_steering?: string
  likely_next_concerns?: string
  /** Secondary inference layer — bounded, observable, never speculative. */
  hidden_intent_branching?: string
  framing_pull?: string
  alternate_reader_realities?: string
  conversational_trajectory?: string
}

export interface RevealResult {
  signals: Signal[]
}

export interface DeclinedResult {
  declined: true
  reason: string
}

export type AnalyzeResponse = RevealResult | DeclinedResult

export interface CompareResult {
  signals: Signal[]
}

export type CompareResponse = CompareResult | DeclinedResult

export interface SelfReadingResult {
  signals: Signal[]
}

export type SelfResponse = SelfReadingResult | DeclinedResult

export function isDeclined(
  r: AnalyzeResponse | CompareResponse | SelfResponse
): r is DeclinedResult {
  return "declined" in r && r.declined === true
}
