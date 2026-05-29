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


/* ────────────────────────────────────────────────────────────────────
   Pre-Send (Email vertical) types
   ──────────────────────────────────────────────────────────────────── */

/**
 * Recipient archetype. The form surfaces 8 quick-pick chips (boss, peer,
 * customer, investor, team, family, stranger, hostile) but accepts any
 * user-typed label too — co-founder, ex-partner, thesis advisor, etc.
 * API-side validation: 1-30 chars, alphanumeric + space/hyphen/apostrophe,
 * must start with a letter.
 */
export type RecipientArchetype = string

export const PREDEFINED_ARCHETYPES = [
  "boss",
  "peer",
  "customer",
  "investor",
  "team",
  "family",
  "stranger",
  "hostile",
] as const

export interface RecipientInput {
  archetype: RecipientArchetype
  context?: string | null
}

export type ReplyAction = "reply" | "ignore" | "escalate" | "push_back" | "ghost"

export interface RecipientReading {
  recipient: RecipientArchetype
  context?: string | null
  subject_notice: string
  body_notice: string
  reply_likelihood: {
    action: ReplyAction
    reason: string
  }
}

export type SendReadiness = "ship" | "review" | "reconsider"

export interface MetaSynthesis {
  meta_pattern: string
  send_readiness: SendReadiness
  send_readiness_reason: string
}

export interface SendCheckResult {
  per_recipient: RecipientReading[]
  meta?: MetaSynthesis
  declined?: { recipient?: RecipientArchetype; reason: string }
}

export type RateLimitKind = "anon_used" | "daily_cap_reached"

export type SendCheckStreamEvent =
  | { type: "recipient"; reading: RecipientReading }
  | { type: "recipient_declined"; recipient: RecipientArchetype; reason: string }
  | { type: "meta"; meta: MetaSynthesis }
  | { type: "declined"; reason: string }
  | { type: "rate_limited"; kind: RateLimitKind; reason: string; cooldown_ends_at?: string }
  | { type: "error"; reason: string }
  | { type: "done"; check_id: string }
