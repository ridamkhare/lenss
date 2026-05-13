import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import {
  SYSTEM_PROMPT,
  COMPARE_SYSTEM_PROMPT,
  SELF_SYSTEM_PROMPT,
  PATTERNS_SYSTEM_PROMPT,
} from "./prompt"
import type {
  AnalyzeResponse,
  CompareResponse,
  CompareResult,
  DeclinedResult,
  RevealResult,
  SelfReadingResult,
  SelfResponse,
  Signal,
} from "./types"

/* ────────────────────────────────────────────────────────────────────
   Model routing — OpenRouter (preferred when key is set), then Anthropic,
   then mock. Self/patterns paths can use a separate, stronger model
   via OPENROUTER_SELF_MODEL.
   ──────────────────────────────────────────────────────────────────── */

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5"

const OPENROUTER_SELF_MODEL =
  process.env.OPENROUTER_SELF_MODEL || OPENROUTER_MODEL

const openRouterClient = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "lens",
      },
    })
  : null

function hasModelAccess(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY)
}

async function callModel(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  modelOverride?: string
): Promise<string | null> {
  if (openRouterClient) {
    const r = await openRouterClient.chat.completions.create({
      model: modelOverride || OPENROUTER_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    })
    const content = r.choices[0]?.message?.content
    return typeof content === "string" ? content : null
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new Anthropic()
    const r = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })
    const block = r.content[0]
    return block && block.type === "text" ? block.text : null
  }
  return null
}

function extractJson<T>(raw: string | null): T | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

/* ────────────────────────────────────────────────────────────────────
   Validators
   ──────────────────────────────────────────────────────────────────── */

function containsAnchorFromSource(field: string, source: string): boolean {
  if (!field || !source) return false
  const norm = (s: string) =>
    s.toLowerCase().replace(/[‘’“”]/g, "'").replace(/\s+/g, " ").trim()
  const haystack = " " + norm(source) + " "
  const matches = field.match(/["“]([^"”]{3,80})["”]|'([^']{3,80})'/g) || []
  for (const m of matches) {
    const inner = norm(m.replace(/^["'“‘]|["'”’]$/g, ""))
    if (inner.length >= 4 && haystack.includes(inner)) return true
  }
  return false
}

/**
 * Banned vocabulary. Hits indicate horoscope-grade or
 * interpretive-philosophical output — both are out of scope.
 */
const BANNED_PATTERNS: RegExp[] = [
  // Interpretive / philosophical
  /\bsemantic gravity\b/i,
  /\bontolog(y|ical)\b/i,
  /\binterpretive structure\b/i,
  /\bshape of meaning\b/i,
  /\bpassage is really about\b/i,
  /\bunderneath its (?:surface )?topic\b/i,
  /the center of (?:meaning|the passage|\w+) sits on/i,
  /\*[^*\n]{1,40}\*/, // any asterisk-italicized phrase

  // Older horoscope stems
  /operates inside (?:a |an )?[\w-]+ frame/i,
  /\bframe[, ]+where\b/i,
  /\bframe in which\b/i,
  /shaped less by .+ (?:than|and) more by/i,
  /less interested in .+ than in/i,
  /felt (?:obligation|need|imperative|urgency)/i,
  /treats the question as/i,
  /\btreats? .+ as given\b/i,
  /the passage is more interested in/i,

  // Jargon and hedging
  /\b(epistemic|ontological|hegemonic|problematizes|interrogates|valorizes|instantiates)\b/i,
  /\b(perhaps|arguably|it could be (?:said|argued)|some might say|one could argue)\b/i,
]

function hasBannedPhrase(text: string): boolean {
  return BANNED_PATTERNS.some((p) => p.test(text))
}

/**
 * Validate a list of signals against a source. Returns true if 1–2
 * signals are present, each anchored and free of banned phrases.
 */
function passesSignalQuality(
  signals: Signal[] | undefined,
  source: string
): boolean {
  if (!Array.isArray(signals)) return false
  if (signals.length < 1 || signals.length > 2) return false
  for (const s of signals) {
    if (!s || !s.observation || !s.consequence || !s.steering) return false
    if (!containsAnchorFromSource(s.observation, source)) return false
    if (
      hasBannedPhrase(s.observation) ||
      hasBannedPhrase(s.consequence) ||
      hasBannedPhrase(s.steering)
    )
      return false
    if (s.alternate_wording && hasBannedPhrase(s.alternate_wording)) {
      return false
    }
  }
  return true
}

/** For compare, observations may anchor to either passage. */
function passesCompareSignalQuality(
  signals: Signal[] | undefined,
  a: string,
  b: string
): boolean {
  if (!Array.isArray(signals)) return false
  if (signals.length < 1 || signals.length > 2) return false
  for (const s of signals) {
    if (!s || !s.observation || !s.consequence || !s.steering) return false
    const anchoredEither =
      containsAnchorFromSource(s.observation, a) ||
      containsAnchorFromSource(s.observation, b)
    if (!anchoredEither) return false
    if (
      hasBannedPhrase(s.observation) ||
      hasBannedPhrase(s.consequence) ||
      hasBannedPhrase(s.steering)
    )
      return false
    if (s.alternate_wording && hasBannedPhrase(s.alternate_wording)) {
      return false
    }
  }
  return true
}

/**
 * Hard cap: never let more than 2 signals reach the UI.
 */
function clampSignals(signals: Signal[]): Signal[] {
  return signals.slice(0, 2)
}

/* ────────────────────────────────────────────────────────────────────
   Reveal — one passage
   ──────────────────────────────────────────────────────────────────── */

export async function analyze(text: string): Promise<AnalyzeResponse> {
  if (hasModelAccess()) return analyzeWithClaude(text)
  return mockAnalyze(text)
}

async function analyzeWithClaude(text: string): Promise<AnalyzeResponse> {
  async function attempt(): Promise<AnalyzeResponse | null> {
    const raw = await callModel(SYSTEM_PROMPT, text, 1200)
    return extractJson<AnalyzeResponse>(raw)
  }

  let parsed = await attempt()
  if (parsed && "declined" in parsed) return parsed
  if (parsed && passesSignalQuality((parsed as RevealResult).signals, text)) {
    return { signals: clampSignals((parsed as RevealResult).signals) }
  }

  const retry = await attempt()
  if (retry && "declined" in retry) return retry
  const final =
    (retry as RevealResult | null) || (parsed as RevealResult | null)
  if (!final || !Array.isArray(final.signals)) {
    throw new Error("Could not parse a reading from the model.")
  }
  return { signals: clampSignals(final.signals) }
}

/* ────────────────────────────────────────────────────────────────────
   Compare — two passages
   ──────────────────────────────────────────────────────────────────── */

export async function analyzeCompare(
  a: string,
  b: string
): Promise<CompareResponse> {
  if (hasModelAccess()) return compareWithClaude(a, b)
  return mockCompare(a, b)
}

async function compareWithClaude(
  a: string,
  b: string
): Promise<CompareResponse> {
  const userContent = `PASSAGE A:\n${a}\n\n---\n\nPASSAGE B:\n${b}`

  async function attempt(): Promise<CompareResponse | null> {
    const raw = await callModel(COMPARE_SYSTEM_PROMPT, userContent, 1200)
    return extractJson<CompareResponse>(raw)
  }

  let parsed = await attempt()
  if (parsed && "declined" in parsed) return parsed
  if (
    parsed &&
    passesCompareSignalQuality((parsed as CompareResult).signals, a, b)
  ) {
    return { signals: clampSignals((parsed as CompareResult).signals) }
  }

  const retry = await attempt()
  if (retry && "declined" in retry) return retry
  const final =
    (retry as CompareResult | null) || (parsed as CompareResult | null)
  if (!final || !Array.isArray(final.signals)) {
    throw new Error("Could not parse a comparison from the model.")
  }
  return { signals: clampSignals(final.signals) }
}

/* ────────────────────────────────────────────────────────────────────
   Yours — self-mode
   ──────────────────────────────────────────────────────────────────── */

export async function analyzeSelf(text: string): Promise<SelfResponse> {
  if (hasModelAccess()) return selfWithClaude(text)
  return mockSelf(text)
}

async function selfWithClaude(text: string): Promise<SelfResponse> {
  async function attempt(): Promise<SelfResponse | null> {
    const raw = await callModel(
      SELF_SYSTEM_PROMPT,
      text,
      800,
      OPENROUTER_SELF_MODEL
    )
    return extractJson<SelfResponse>(raw)
  }

  let parsed = await attempt()
  if (parsed && "declined" in parsed) return parsed
  if (
    parsed &&
    passesSignalQuality((parsed as SelfReadingResult).signals, text)
  ) {
    return { signals: clampSignals((parsed as SelfReadingResult).signals) }
  }

  const retry = await attempt()
  if (retry && "declined" in retry) return retry
  const final =
    (retry as SelfReadingResult | null) ||
    (parsed as SelfReadingResult | null)
  if (!final || !Array.isArray(final.signals)) {
    throw new Error("Could not parse a reading from the model.")
  }
  return { signals: clampSignals(final.signals) }
}

/* ────────────────────────────────────────────────────────────────────
   Patterns — across saved self-entries
   ──────────────────────────────────────────────────────────────────── */

const CRISIS_PATTERNS: RegExp[] = [
  /\b(suicide|suicidal|kill myself|end (?:it|my life)|don'?t want to (?:be alive|live|exist))\b/i,
  /\b(self[- ]?harm|cut myself|hurting myself)\b/i,
  /\b(want to die|wish (?:i were|i was) dead|better off (?:dead|without me))\b/i,
]

function looksLikeCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text))
}

export async function analyzePatterns(
  entries: string[]
): Promise<SelfResponse> {
  if (entries.length < 2) {
    return {
      declined: true,
      reason: "Fewer than two entries — not enough to name a pattern.",
    }
  }
  if (entries.some((e) => looksLikeCrisis(e))) {
    return {
      declined: true,
      reason:
        "This is heavier than the instrument was built for. Please talk to someone you trust.",
    }
  }
  if (!hasModelAccess()) return mockPatterns(entries)
  return patternsWithClaude(entries)
}

async function patternsWithClaude(
  entries: string[]
): Promise<SelfResponse> {
  const userMessage = entries
    .map((e, i) => `ENTRY ${i + 1}:\n${e}`)
    .join("\n\n---\n\n")
  const raw = await callModel(
    PATTERNS_SYSTEM_PROMPT,
    userMessage,
    900,
    OPENROUTER_SELF_MODEL
  )
  const parsed = extractJson<SelfResponse>(raw)
  if (!parsed) {
    return {
      declined: true,
      reason: "The instrument couldn't find a pattern across these entries.",
    }
  }
  if ("declined" in parsed) return parsed
  const r = parsed as SelfReadingResult
  if (!Array.isArray(r.signals) || r.signals.length === 0) {
    return {
      declined: true,
      reason: "The instrument couldn't find a pattern across these entries.",
    }
  }
  return { signals: clampSignals(r.signals) }
}

/* ────────────────────────────────────────────────────────────────────
   Mocks — used only when no API key is configured. Kept minimal:
   they pull a phrase from the input so the Signal is genuinely anchored.
   ──────────────────────────────────────────────────────────────────── */

function shortQuote(text: string): string {
  const fragments = text
    .split(/[.,;:?!\n]+/)
    .map((s) => s.trim())
    .filter((s) => {
      const w = s.split(/\s+/).filter(Boolean).length
      return w >= 2 && w <= 7
    })
  if (fragments.length > 0) return fragments[0]
  const words = text.split(/\s+/).filter(Boolean)
  return words.slice(0, 5).join(" ")
}

function mockAnalyze(text: string): RevealResult {
  const quote = shortQuote(text)
  return {
    signals: [
      {
        observation: `The passage opens with "${quote}" — set up as the claim the rest of the piece will rest on.`,
        consequence:
          "A reader is positioned to accept the opening before any case has been made; later sentences confirm rather than test it.",
        steering:
          "If you want the opening to invite engagement instead of agreement, soften the verb or add a clause that admits exceptions.",
      },
    ],
  }
}

function mockCompare(a: string, b: string): CompareResult {
  const qa = shortQuote(a)
  const qb = shortQuote(b)
  return {
    signals: [
      {
        observation: `A opens with "${qa}"; B opens with "${qb}". A leads with a claim; B leads with a frame.`,
        consequence:
          "A reader of A receives the conclusion first and the evidence after; a reader of B is positioned to weigh before deciding.",
        steering:
          "If you want a decisive read, A's opening serves better. If you want the reader to deliberate, B's serves better.",
      },
    ],
  }
}

function mockSelf(text: string): SelfResponse {
  if (looksLikeCrisis(text)) {
    return {
      declined: true,
      reason:
        "This is heavier than the instrument was built for. Please talk to someone you trust.",
    }
  }
  const quote = shortQuote(text)
  return {
    signals: [
      {
        observation: `The entry opens with "${quote}" — a setup the rest of the entry returns to without resolving.`,
        consequence:
          "A reader receives the move twice: once as a claim, again as a circle. The repetition can read as honesty, or as stalling, depending on context.",
        steering:
          "If you want the second occurrence to land differently, name what changed between the two — even one phrase will do.",
      },
    ],
  }
}

function mockPatterns(entries: string[]): SelfResponse {
  const fragments = entries.flatMap((e) =>
    e
      .split(/[.,;:?!\n]+/)
      .map((s) => s.trim())
      .filter((s) => {
        const w = s.split(/\s+/).filter(Boolean).length
        return w >= 2 && w <= 5
      })
  )
  const seen = new Map<string, number>()
  let common: string | null = null
  for (const f of fragments) {
    const key = f.toLowerCase()
    const c = (seen.get(key) || 0) + 1
    seen.set(key, c)
    if (c >= 2 && !common) common = f
  }
  if (!common) {
    return {
      declined: true,
      reason: "These entries don't share enough to name a pattern across them.",
    }
  }
  return {
    signals: [
      {
        observation: `The phrase "${common}" appears across more than one entry, and tends to arrive where the entry is in its quieter half.`,
        consequence:
          "A reader of the entries together notices the move; a reader of any one entry would not.",
        steering:
          "If the recurrence is doing work, leave it. If you want the entries to feel more distinct, name the phrase in only one.",
      },
    ],
  }
}
