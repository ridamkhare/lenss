/**
 * Signal is the unit of analysis. Every mode returns between 1 and 4
 * signals — but the count is governed by materiality, not a quota.
 * Surface a signal only when it adds a distinct perceptual or
 * strategic insight. Refuse rather than pad. Hard ceiling is 4.
 */
export interface Signal {
  /** What's observable in the text. Anchored with a verbatim quote. */
  observation: string
  /** Likely effect on a reader. Pragmatic, concrete. */
  consequence: string
  /**
   * EXPERIMENT: a differently-shaped rewrite of the passage. Not a
   * polish, paraphrase, or "improvement" — a genuinely different
   * communicative posture that creates a different conversational
   * future. Preserves the factual content; changes the shape.
   *
   * Only required in the experiment branch. Optional in the schema
   * for graceful degradation against older archived items.
   */
  alternate_answer?: {
    text: string
    tradeoff?: string
  }
  /* Legacy fields kept optional so older archived items still
     deserialize. The experiment prompt no longer produces these. */
  steering?: string
  alternate_wording?: string
  perceptual_compression?: string
  why_it_matters?: string
  audience_effect?: string
  alternative_framing?: string
  different_steering?: string
  likely_next_concerns?: string
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
