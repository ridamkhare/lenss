export type DimensionKey =
  | "dominant_framing"
  | "hidden_assumptions"
  | "suppressed_alternatives"
  | "semantic_gravity"
  | "alternate_framing"

export interface RevealResult {
  dominant_framing: string
  hidden_assumptions: string
  suppressed_alternatives: string
  semantic_gravity: string
  alternate_framing: string
}

export interface DeclinedResult {
  declined: true
  reason: string
}

export type AnalyzeResponse = RevealResult | DeclinedResult

export interface Reading {
  lens: string
  frame: string
}

export interface CompareResult {
  shared_question: string
  left: Reading
  right: Reading
}

export type CompareResponse = CompareResult | DeclinedResult

export interface SelfReadingResult {
  noticing: string
  question: string
}

export type SelfResponse = SelfReadingResult | DeclinedResult

export function isDeclined(
  r: AnalyzeResponse | CompareResponse | SelfResponse
): r is DeclinedResult {
  return "declined" in r && r.declined === true
}
