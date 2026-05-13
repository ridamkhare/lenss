/**
 * Signal is the unit of analysis. Every mode returns 1 or 2 Signals —
 * never zero (refuse instead), never three or more.
 */
export interface Signal {
  /** What's observable in the text. Anchored with a verbatim quote. */
  observation: string
  /** Likely effect on a reader. Pragmatic, concrete. */
  consequence: string
  /** A small, specific steering suggestion. */
  steering: string
  /** Optional concrete rewrite. Shown only on user expand. */
  alternate_wording?: string
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
