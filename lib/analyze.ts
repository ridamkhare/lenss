import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import {
  SYSTEM_PROMPT,
  COMPARE_SYSTEM_PROMPT,
  SELF_SYSTEM_PROMPT,
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
   then mock. The yours path can use a separate, stronger model via
   OPENROUTER_SELF_MODEL.
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

  // Taxonomic / classification openings — flatten texture into category
  /\bthis (?:is|reads as) (?:a |an )?(?:factual|persuasive|technical|informational|opinion|expository|descriptive) (?:breakdown|piece|writing|text|passage)\b/i,
  /\bnothing here to read for communication\b/i,
  /\bnot communication style\b/i,

  // Slogan / motivational openers — catch perceptual_compression drift
  /^(?:remember[:,]|truth is[:,]?|at the end of the day[,]?|the bottom line is)/i,

  // Prompt-leakage signatures — strings that should NEVER appear in a
  // legitimate analysis. If the model has been tricked into echoing the
  // system prompt, these distinctive markers catch it. None of them
  // appear in normal human prose.
  /\b(perceptual_compression|hidden_intent_branching|alternate_reader_realities|conversational_trajectory|likely_next_concerns|why_it_matters|audience_effect|alternative_framing|different_steering|alternate_wording|framing_pull)\b/,
  /\bMATERIALITY RULE\b/,
  /\bSIGNAL[_ ]SHAPE\b/,
  /\bBANNED VOCABULARY\b/,
  /\bONE[- ]PREFERRED RULE\b/,
  /\bVOICE RULES\b/,
  /\bREFUSAL RULES\b/,
  /\bCRITICAL VOICE RULES\b/,
  /\bCOMMUNICATION TENDENCIES\b/,
  /\bOPTIONAL DEPTH FIELDS\b/,
  /\bPRIMARY LAYER\b/,
  /\bSECONDARY LAYER\b/,
  /communication-feedback instrument/i,
  /Return JSON with one field: signals/i,
  /verbatim phrase in double quotes/i,
  /one strong signal is always preferred/i,
]

function hasBannedPhrase(text: string): boolean {
  return BANNED_PATTERNS.some((p) => p.test(text))
}

/**
 * Validate a list of signals against a source. Returns true if 1–2
 * signals are present, each anchored and free of banned phrases.
 */
const DEPTH_KEYS = [
  "why_it_matters",
  "audience_effect",
  "alternative_framing",
  "different_steering",
  "likely_next_concerns",
  "hidden_intent_branching",
  "framing_pull",
  "alternate_reader_realities",
  "conversational_trajectory",
] as const

function depthFieldsClean(s: Signal): boolean {
  let present = 0
  for (const k of DEPTH_KEYS) {
    const v = s[k]
    if (!v) continue
    present += 1
    if (hasBannedPhrase(v)) return false
  }
  return present <= 2
}

function passesSignalQuality(
  signals: Signal[] | undefined,
  source: string
): boolean {
  if (!Array.isArray(signals)) return false
  if (signals.length < 1) return false
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
    if (s.perceptual_compression && hasBannedPhrase(s.perceptual_compression)) {
      return false
    }
    if (!depthFieldsClean(s)) return false
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
  if (signals.length < 1) return false
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
    if (s.perceptual_compression && hasBannedPhrase(s.perceptual_compression)) {
      return false
    }
    if (!depthFieldsClean(s)) return false
  }
  return true
}

/**
 * No numerical cap on signal count — materiality is the only gate.
 * Still enforces the depth-field cap of 2 per signal so each signal's
 * UI shape stays consistent. If we ever need a defensive ceiling (cost,
 * latency, payload size), add it here, but the MATERIALITY_RULE in the
 * prompt is the intended limiter.
 */
function clampSignals(signals: Signal[]): Signal[] {
  return signals.map(clampDepth)
}

function clampDepth(s: Signal): Signal {
  const present = DEPTH_KEYS.filter((k) => !!s[k])
  if (present.length <= 2) return s
  const keep = new Set(present.slice(0, 2))
  const out: Signal = {
    observation: s.observation,
    consequence: s.consequence,
    steering: s.steering,
  }
  if (s.alternate_wording) out.alternate_wording = s.alternate_wording
  for (const k of present) {
    if (keep.has(k)) out[k] = s[k]
  }
  return out
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
   Crisis detection — used by yours-mode mock and (server-side) by any
   future safety surface.
   ──────────────────────────────────────────────────────────────────── */

const CRISIS_PATTERNS: RegExp[] = [
  /\b(suicide|suicidal|kill myself|end (?:it|my life)|don'?t want to (?:be alive|live|exist))\b/i,
  /\b(self[- ]?harm|cut myself|hurting myself)\b/i,
  /\b(want to die|wish (?:i were|i was) dead|better off (?:dead|without me))\b/i,
]

function looksLikeCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text))
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

/* ────────────────────────────────────────────────────────────────────
   Streaming layer
   ────────────────────────────────────────────────────────────────────
   The non-streaming functions above wait for the model to assemble a
   full JSON response, then validate and (sometimes) retry. That makes
   perceived latency ~3x the actual latency, because Opus generates at
   ~25-35 tok/s and a full response can run 600-1000 tokens.

   The streaming layer below:
   - Pipes raw tokens out of the LLM
   - Incrementally parses signal objects from the buffer as they
     complete (brace-counter — robust to prose preceding the JSON
     and to internal escaped quotes)
   - Validates each signal individually and emits it via an
     async-generator of StreamEvent objects
   - Drops the retry-once pattern (impossible mid-stream); trusts the
     prompt + per-signal validator to maintain quality
   ──────────────────────────────────────────────────────────────────── */

export type StreamEvent =
  | { type: "signal"; signal: Signal }
  | { type: "declined"; reason: string }
  | { type: "error"; reason: string }
  | { type: "done" }

async function* callModelStream(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  modelOverride?: string
): AsyncGenerator<string, void, void> {
  if (openRouterClient) {
    const stream = await openRouterClient.chat.completions.create({
      model: modelOverride || OPENROUTER_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: true,
    })
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (typeof delta === "string" && delta.length > 0) yield delta
    }
    return
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new Anthropic()
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text
      }
    }
  }
}

/**
 * Walks the partial JSON buffer with a depth-aware brace counter and
 * returns every complete top-level object that lives inside the
 * `"signals": [ ... ]` array. Robust to: prose preceding the JSON,
 * escaped quotes inside strings, and nested objects (for depth fields).
 */
function extractCompletedSignals(buffer: string): unknown[] {
  const arrayKey = buffer.indexOf('"signals"')
  if (arrayKey === -1) return []
  const bracketIdx = buffer.indexOf("[", arrayKey)
  if (bracketIdx === -1) return []

  let i = bracketIdx + 1
  let depth = 0
  let objStart = -1
  let inString = false
  let escaped = false
  const signals: unknown[] = []

  while (i < buffer.length) {
    const c = buffer[i]
    if (escaped) {
      escaped = false
    } else if (c === "\\") {
      escaped = true
    } else if (c === '"') {
      inString = !inString
    } else if (!inString) {
      if (c === "{") {
        if (depth === 0) objStart = i
        depth++
      } else if (c === "}") {
        depth--
        if (depth === 0 && objStart >= 0) {
          try {
            signals.push(JSON.parse(buffer.slice(objStart, i + 1)))
          } catch {
            /* ignore malformed object — wait for more bytes */
          }
          objStart = -1
        }
      } else if (c === "]" && depth === 0) {
        break
      }
    }
    i++
  }
  return signals
}

/**
 * Detects a {"declined": true, "reason": "..."} response before the
 * stream completes, so we can short-circuit refusals quickly.
 */
function detectDeclined(
  buffer: string
): { declined: true; reason: string } | null {
  if (!/"declined"\s*:\s*true/i.test(buffer)) return null
  const m = buffer.match(/"reason"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  if (!m) return null
  return { declined: true, reason: m[1] }
}

function validateSingleSignal(
  raw: unknown,
  sources: string[]
): Signal | null {
  if (!raw || typeof raw !== "object") return null
  const s = raw as Record<string, unknown>
  if (
    typeof s.observation !== "string" ||
    typeof s.consequence !== "string" ||
    typeof s.steering !== "string"
  ) {
    return null
  }
  const anchored = sources.some((src) =>
    containsAnchorFromSource(s.observation as string, src)
  )
  if (!anchored) return null
  if (
    hasBannedPhrase(s.observation) ||
    hasBannedPhrase(s.consequence) ||
    hasBannedPhrase(s.steering)
  ) {
    return null
  }
  if (
    typeof s.alternate_wording === "string" &&
    hasBannedPhrase(s.alternate_wording)
  ) {
    return null
  }
  if (
    typeof s.perceptual_compression === "string" &&
    hasBannedPhrase(s.perceptual_compression)
  ) {
    return null
  }
  // Depth fields cap and banned check
  const present = DEPTH_KEYS.filter((k) => typeof s[k] === "string" && s[k])
  if (present.length > 2) return null
  for (const k of present) {
    if (hasBannedPhrase(s[k] as string)) return null
  }
  return clampDepth(s as unknown as Signal)
}

async function* runStream(
  systemPrompt: string,
  userMessage: string,
  sources: string[],
  maxTokens: number,
  modelOverride?: string
): AsyncGenerator<StreamEvent, void, void> {
  let buffer = ""
  let emittedCount = 0
  let signalsEmitted = 0
  let declinedSeen = false

  try {
    for await (const chunk of callModelStream(
      systemPrompt,
      userMessage,
      maxTokens,
      modelOverride
    )) {
      buffer += chunk

      if (!declinedSeen) {
        const decl = detectDeclined(buffer)
        if (decl) {
          declinedSeen = true
          yield { type: "declined", reason: decl.reason }
          return
        }
      }

      const candidates = extractCompletedSignals(buffer)
      for (let i = emittedCount; i < candidates.length; i++) {
        emittedCount++
        if (signalsEmitted >= 4) break
        const valid = validateSingleSignal(candidates[i], sources)
        if (valid) {
          signalsEmitted++
          yield { type: "signal", signal: valid }
        }
      }
    }

    if (!declinedSeen && signalsEmitted === 0) {
      yield {
        type: "error",
        reason: "The reading didn't come through cleanly. Try again.",
      }
      return
    }

    yield { type: "done" }
  } catch {
    yield {
      type: "error",
      reason: "Something went quiet on our side. Try again in a moment.",
    }
  }
}

export async function* analyzeStream(
  text: string
): AsyncGenerator<StreamEvent, void, void> {
  if (!hasModelAccess()) {
    yield* mockToStream(mockAnalyze(text))
    return
  }
  yield* runStream(SYSTEM_PROMPT, text, [text], 1200)
}

export async function* analyzeCompareStream(
  a: string,
  b: string
): AsyncGenerator<StreamEvent, void, void> {
  if (!hasModelAccess()) {
    yield* mockToStream(mockCompare(a, b))
    return
  }
  const userContent = `PASSAGE A:\n${a}\n\n---\n\nPASSAGE B:\n${b}`
  yield* runStream(COMPARE_SYSTEM_PROMPT, userContent, [a, b], 1200)
}

export async function* analyzeSelfStream(
  text: string
): AsyncGenerator<StreamEvent, void, void> {
  if (!hasModelAccess()) {
    yield* mockToStream(mockSelf(text))
    return
  }
  yield* runStream(SELF_SYSTEM_PROMPT, text, [text], 800, OPENROUTER_SELF_MODEL)
}

async function* mockToStream(
  result: RevealResult | CompareResult | SelfResponse
): AsyncGenerator<StreamEvent, void, void> {
  if ("declined" in result) {
    yield { type: "declined", reason: result.reason }
    return
  }
  for (const s of result.signals) {
    yield { type: "signal", signal: s }
  }
  yield { type: "done" }
}

