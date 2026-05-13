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
  RevealResult,
  SelfReadingResult,
  SelfResponse,
} from "./types"

/* ────────────────────────────────────────────────────────────────────
   Model routing — OpenRouter (preferred when key is set), then Anthropic,
   then mock. One key needs to be set for real analysis.
   ──────────────────────────────────────────────────────────────────── */

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5"

/**
 * Optional override for the self/patterns paths. Those modes carry the
 * heaviest voice-safety requirements (crisis refusal, no-psychologizing
 * rules) and benefit from a stronger model. Falls back to OPENROUTER_MODEL
 * when unset.
 */
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
   Anti-pseudo-depth validators
   ──────────────────────────────────────────────────────────────────── */

/**
 * Returns true if `field` contains any quoted phrase (in double or single
 * quotes, or smart quotes) that appears verbatim in `source`.
 * Whitespace-normalized, case-insensitive, smart-quote-tolerant.
 */
function containsAnchorFromSource(field: string, source: string): boolean {
  if (!field || !source) return false
  const norm = (s: string) =>
    s.toLowerCase().replace(/[‘’“”]/g, "'").replace(/\s+/g, " ").trim()
  const haystack = " " + norm(source) + " "
  // Find all "..." or '...' or smart-quoted runs in the field
  const matches = field.match(/["“]([^"”]{3,80})["”]|'([^']{3,80})'/g) || []
  for (const m of matches) {
    const inner = norm(m.replace(/^["'“‘]|["'”’]$/g, ""))
    if (inner.length >= 4 && haystack.includes(inner)) return true
  }
  return false
}

/**
 * Template stems the model reaches for when it doesn't have a specific
 * observation. Hits indicate horoscope-grade output.
 */
const BANNED_PATTERNS: RegExp[] = [
  /operates inside (?:a |an )?[\w-]+ frame/i,
  /\bframe[, ]+where\b/i,
  /\bframe in which\b/i,
  /the center of meaning sits on/i,
  /shaped less by .+ (?:than|and) more by/i,
  /less interested in .+ than in/i,
  /felt (?:obligation|need|imperative|urgency)/i,
  /treats the question as/i,
  /\btreats? .+ as given\b/i,
  /the passage is more interested in/i,
  /\b(epistemic|ontological|hegemonic|problematizes|interrogates|valorizes|instantiates)\b/i,
  /\b(perhaps|arguably|it could be (?:said|argued)|some might say|one could argue)\b/i,
]

function hasBannedPhrase(text: string): boolean {
  return BANNED_PATTERNS.some((p) => p.test(text))
}

/**
 * 0–100. Telemetry-only — not enforced. Logged on each Claude call so we
 * can watch for prompt drift over time.
 */
function specificityScore(fields: string[], source: string): number {
  if (fields.length === 0) return 0
  let score = 0
  const perField = 100 / fields.length
  for (const f of fields) {
    let f_score = 0
    if (containsAnchorFromSource(f, source)) f_score += perField * 0.7
    if (!hasBannedPhrase(f)) f_score += perField * 0.3
    score += f_score
  }
  return Math.round(score)
}

/**
 * Quality check for a single-mode reveal. Returns true if good enough
 * to ship; false if a retry is warranted.
 */
function passesRevealQuality(r: RevealResult, source: string): boolean {
  const fields = [
    r.dominant_framing,
    r.hidden_assumptions,
    r.suppressed_alternatives,
    r.semantic_gravity,
    r.alternate_framing,
  ]
  const anchored = fields.filter((f) => containsAnchorFromSource(f, source)).length
  const banned = fields.some((f) => hasBannedPhrase(f))
  // Require: at least 2 of 5 fields anchored, AND no banned phrases
  return anchored >= 2 && !banned
}

function passesCompareQuality(
  r: CompareResult,
  a: string,
  b: string
): boolean {
  const leftAnchored = containsAnchorFromSource(r.left.frame, a)
  const rightAnchored = containsAnchorFromSource(r.right.frame, b)
  const banned =
    hasBannedPhrase(r.left.frame) || hasBannedPhrase(r.right.frame)
  return leftAnchored && rightAnchored && !banned
}

function passesSelfQuality(r: SelfReadingResult, source: string): boolean {
  return (
    containsAnchorFromSource(r.noticing, source) &&
    !hasBannedPhrase(r.noticing)
  )
}

/**
 * Single entry point. Routes to Claude if an API key is configured,
 * otherwise returns a hand-crafted mock so the UI works offline.
 */
export async function analyze(text: string): Promise<AnalyzeResponse> {
  if (hasModelAccess()) {
    return analyzeWithClaude(text)
  }
  return mockAnalyze(text)
}

async function analyzeWithClaude(text: string): Promise<AnalyzeResponse> {
  async function attempt(): Promise<AnalyzeResponse | null> {
    const raw = await callModel(SYSTEM_PROMPT, text, 1400)
    return extractJson<AnalyzeResponse>(raw)
  }

  // First attempt
  let parsed = await attempt()
  if (parsed && "declined" in parsed) return parsed
  if (parsed && passesRevealQuality(parsed as RevealResult, text)) {
    logRevealSpecificity(parsed as RevealResult, text)
    return parsed
  }

  // One retry — model is stochastic; the second draft often anchors better
  const retry = await attempt()
  if (retry && "declined" in retry) return retry
  const final = (retry as RevealResult | null) || (parsed as RevealResult | null)
  if (!final) {
    throw new Error("Could not parse a reading from Claude.")
  }
  logRevealSpecificity(final, text)
  return final
}

function logRevealSpecificity(r: RevealResult, source: string) {
  logSpecificity(
    "reveal",
    [
      r.dominant_framing,
      r.hidden_assumptions,
      r.suppressed_alternatives,
      r.semantic_gravity,
      r.alternate_framing,
    ],
    source
  )
}

function logSpecificity(
  mode: "reveal" | "compare" | "self",
  fields: string[],
  source: string
) {
  const score = specificityScore(fields, source)
  if (score < 50) {
    console.warn(`[lens] specificity[${mode}]=${score} below threshold`)
  }
}

/**
 * Compare mode: two answers → shared question + two contrasting frames.
 */
export async function analyzeCompare(
  a: string,
  b: string
): Promise<CompareResponse> {
  if (hasModelAccess()) {
    return compareWithClaude(a, b)
  }
  return mockCompare(a, b)
}

async function compareWithClaude(
  a: string,
  b: string
): Promise<CompareResponse> {
  const userContent = `ANSWER A:\n${a}\n\n---\n\nANSWER B:\n${b}`

  async function attempt(): Promise<CompareResponse | null> {
    const raw = await callModel(COMPARE_SYSTEM_PROMPT, userContent, 1400)
    return extractJson<CompareResponse>(raw)
  }

  let parsed = await attempt()
  if (parsed && "declined" in parsed) return parsed
  if (parsed && passesCompareQuality(parsed as CompareResult, a, b)) {
    logCompareSpecificity(parsed as CompareResult, a, b)
    return parsed
  }

  const retry = await attempt()
  if (retry && "declined" in retry) return retry
  const final = (retry as CompareResult | null) || (parsed as CompareResult | null)
  if (!final) {
    throw new Error("Could not parse a comparison from Claude.")
  }
  logCompareSpecificity(final, a, b)
  return final
}

function logCompareSpecificity(r: CompareResult, a: string, b: string) {
  logSpecificity("compare", [r.left.frame], a)
  logSpecificity("compare", [r.right.frame], b)
}

/**
 * Mock readings — five archetypes, deterministically selected by a hash
 * of the input. Same input → same reading (good for re-running). Different
 * inputs → different readings (good for exploring the prototype without
 * an API key). Real analysis still arrives when ANTHROPIC_API_KEY is set.
 */
function mockAnalyze(text: string): RevealResult {
  const archetype = pickArchetype(text)
  return ARCHETYPES[archetype]
}

function pickArchetype(text: string): number {
  // Light content heuristics first — fall back to hash for variety.
  const lower = text.toLowerCase()

  if (/\b(should|must|need to|how to|steps|guide|tips|advice)\b/.test(lower)) {
    return 0 // pragmatic problem-solver
  }
  if (/\b(studies|research|evidence|data|percent|%|according to)\b/.test(lower)) {
    return 1 // synthesizer of consensus
  }
  if (/\b(future|will|going to|trend|transform|revolution|emerging)\b/.test(lower)) {
    return 2 // optimistic futurist
  }
  if (/\b(but|however|on the other hand|balance|nuance|both|while)\b/.test(lower)) {
    return 3 // cautious balancer
  }
  if (/\b(is defined|refers to|means that|in essence|fundamentally)\b/.test(lower)) {
    return 4 // confident definer
  }

  // Deterministic hash fallback so the same input always yields the same reading.
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % ARCHETYPES.length
}

/**
 * Self-reading: the user's own writing → one noticing + one question.
 */
export async function analyzeSelf(text: string): Promise<SelfResponse> {
  if (hasModelAccess()) {
    return selfWithClaude(text)
  }
  return mockSelf(text)
}

async function selfWithClaude(text: string): Promise<SelfResponse> {
  async function attempt(): Promise<SelfResponse | null> {
    const raw = await callModel(SELF_SYSTEM_PROMPT, text, 800, OPENROUTER_SELF_MODEL)
    return extractJson<SelfResponse>(raw)
  }

  let parsed = await attempt()
  if (parsed && "declined" in parsed) return parsed
  if (parsed && passesSelfQuality(parsed as SelfReadingResult, text)) {
    logSpecificity("self", [(parsed as SelfReadingResult).noticing], text)
    return parsed
  }

  const retry = await attempt()
  if (retry && "declined" in retry) return retry
  const final = (retry as SelfReadingResult | null) || (parsed as SelfReadingResult | null)
  if (!final) {
    throw new Error("Could not parse a reading from Claude.")
  }
  logSpecificity("self", [final.noticing], text)
  return final
}

/**
 * Cross-entry pattern read for the archive. Same shape as a self
 * reading (noticing + question) but produced from the entire saved
 * self-entries set. Same voice safety rules and crisis refusal.
 */
export async function analyzePatterns(
  entries: string[]
): Promise<SelfResponse> {
  if (entries.length < 2) {
    return {
      declined: true,
      reason: "Fewer than two entries — not enough to name a pattern.",
    }
  }

  // Mock-path crisis check: any entry containing crisis content → refuse.
  if (entries.some((e) => looksLikeCrisis(e))) {
    return {
      declined: true,
      reason:
        "This is heavier than the instrument was built for. Please talk to someone you trust.",
    }
  }

  if (!hasModelAccess()) {
    return mockPatterns(entries)
  }
  return patternsWithClaude(entries)
}

async function patternsWithClaude(entries: string[]): Promise<SelfResponse> {
  const userMessage = entries
    .map((e, i) => `ENTRY ${i + 1}:\n${e}`)
    .join("\n\n---\n\n")

  const raw = await callModel(PATTERNS_SYSTEM_PROMPT, userMessage, 800, OPENROUTER_SELF_MODEL)
  const parsed = extractJson<SelfResponse>(raw)
  if (!parsed) {
    return {
      declined: true,
      reason: "The instrument couldn't find a pattern across these entries.",
    }
  }
  return parsed
}

function mockPatterns(entries: string[]): SelfResponse {
  // Find a short phrase that appears in 2+ entries.
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
    noticing: `The phrase "${common}" appears across more than one entry — it's one of the few specific things these pieces share. It tends to arrive where the entry is doing its quietest work, neither opening nor concluding.`,
    question: "What is the phrase carrying that hasn't been said outright?",
  }
}

/**
 * Crisis-content detector for the mock path. Cheap, conservative: a
 * keyword hit triggers the gentle refusal. The model path has its own
 * (better) judgment in the prompt; this is the safety net when no key
 * is configured.
 */
const CRISIS_PATTERNS: RegExp[] = [
  /\b(suicide|suicidal|kill myself|end (?:it|my life)|don'?t want to (?:be alive|live|exist))\b/i,
  /\b(self[- ]?harm|cut myself|hurting myself)\b/i,
  /\b(want to die|wish (?:i were|i was) dead|better off (?:dead|without me))\b/i,
]

function looksLikeCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text))
}

function mockSelf(text: string): SelfResponse {
  if (looksLikeCrisis(text)) {
    return {
      declined: true,
      reason:
        "This is heavier than the instrument was built for. Please talk to someone you trust.",
    }
  }

  const archetype = pickSelfArchetype(text)
  const tpl = SELF_TEMPLATES[archetype]

  // Anchor each template lightly to the user's input by inserting the
  // opening phrase and the closing phrase into placeholders.
  const sentences = text.trim().split(/(?<=[.?!])\s+/).filter(Boolean)
  const opener = sentences[0]?.trim().replace(/[.!?]+$/, "") || text.slice(0, 60)
  const closer =
    sentences[sentences.length - 1]?.trim().replace(/[.!?]+$/, "") ||
    text.slice(-60)

  const shortOpener = openerShort(opener)
  const shortCloser = closerShort(closer)

  return {
    noticing: tpl.noticing
      .replace("{{opener}}", shortOpener)
      .replace("{{closer}}", shortCloser),
    question: tpl.question,
  }
}

function openerShort(s: string): string {
  const words = s.split(/\s+/).filter(Boolean)
  return words.slice(0, Math.min(6, words.length)).join(" ")
}

function closerShort(s: string): string {
  const words = s.split(/\s+/).filter(Boolean)
  return words.slice(Math.max(0, words.length - 6)).join(" ")
}

function pickSelfArchetype(text: string): number {
  const lower = text.toLowerCase()
  if (/\b(should|need to|have to|must|ought)\b/.test(lower)) return 0 // deliberation
  if (/\b(i don'?t know|not sure|maybe|i wonder|i think)\b/.test(lower)) return 1 // uncertainty
  if (/\b(today|yesterday|this morning|last night|earlier)\b/.test(lower)) return 2 // event-recall
  if (/\b(we|us|they|he|she|her|him|them)\b/.test(lower) && !/\bi (?:think|feel|want|wonder)/i.test(lower)) return 3 // outward
  return 4 // default — pacing
}

const SELF_TEMPLATES: { noticing: string; question: string }[] = [
  // 0 — deliberation
  {
    noticing:
      'The piece moves between a stated obligation and a quieter doubt — "{{opener}}" gives way, by the end, to "{{closer}}." The obligation is voiced more times than the doubt, but the doubt is given the closing sentence.',
    question:
      "What would the entry say if it weren't carrying the word 'should'?",
  },
  // 1 — uncertainty
  {
    noticing:
      'The entry is built out of softened claims — uncertainty markers ("not sure," "maybe," "I wonder") are doing structural work, not decorative work. They are how the piece moves forward without committing.',
    question:
      "What is the entry sure of, even quietly?",
  },
  // 2 — event-recall
  {
    noticing:
      'The piece opens with what happened — "{{opener}}" — and most of the verbs are about other people. The closing sentence ("{{closer}}") is the only one that turns inward, and it arrives without elaboration.',
    question:
      "What was the last thing you knew you thought, before the event began?",
  },
  // 3 — outward
  {
    noticing:
      'The first-person voice is held at a distance — the entry describes a scene, names other people, lets actions speak for it. Where you appear, you appear briefly, more as observer than as subject.',
    question:
      "What would change if the entry were written as a letter to one specific person?",
  },
  // 4 — pacing
  {
    noticing:
      'The opening — "{{opener}}" — sets a calm pace; the closing — "{{closer}}" — lands more abruptly. The piece doesn\'t arrive where its first sentence implied it would.',
    question:
      "What is the entry not saying that the gap in pace is pointing at?",
  },
]

function mockCompare(a: string, b: string): CompareResult {
  // Pick a contrast pair deterministically from both inputs.
  let hash = 0
  const combined = a + "|" + b
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) | 0
  }
  const pair = CONTRAST_PAIRS[Math.abs(hash) % CONTRAST_PAIRS.length]
  return pair
}

const CONTRAST_PAIRS: CompareResult[] = [
  {
    shared_question: "What makes work meaningful?",
    left: {
      lens: "a managerial lens",
      frame:
        "Treats work as something to be optimized — measured in output, retention, and satisfaction. The question becomes how to arrange conditions so people produce more and complain less. What 'meaningful' refers to is whatever survives that arrangement.",
    },
    right: {
      lens: "a craftsperson's lens",
      frame:
        "Treats work as the slow accumulation of skill toward a specific thing. The question becomes what is being made and whether the person making it is becoming more capable of it. Meaning is internal to the doing, not produced by the conditions around it.",
    },
  },
  {
    shared_question: "How should we respond to the change ahead?",
    left: {
      lens: "a futurist's lens",
      frame:
        "Treats the change as already underway and the question as how fast to move. The horizon is the protagonist; the present is mostly material for the next chapter. Hesitation reads as a kind of mistake.",
    },
    right: {
      lens: "a conservator's lens",
      frame:
        "Treats the present as worth describing carefully before its successor is named. The question becomes what is worth carrying through the change and what the change is asking us to give up. Speed is read as a cost, not a virtue.",
    },
  },
  {
    shared_question: "What should be done about the disputed question?",
    left: {
      lens: "a consensus-builder's lens",
      frame:
        "Treats the disputed question as solvable by gathering positions and finding the weighted middle. Authority comes from breadth, not depth. The strongest move is the one most people can live with.",
    },
    right: {
      lens: "a partisan's lens",
      frame:
        "Treats the dispute as already containing a defensible position, and the failure to take one as itself a position. Authority comes from being willing to bear the cost of choosing. The strongest move is the one a thoughtful person would defend.",
    },
  },
  {
    shared_question: "What does the term actually mean?",
    left: {
      lens: "a definer's lens",
      frame:
        "Treats meaning as something to be fixed. The question becomes how to stipulate the term clearly so the conversation can proceed. What the term *used* to mean is treated as a complication to dismiss, not as evidence of what is now being argued over.",
    },
    right: {
      lens: "a translator's lens",
      frame:
        "Treats meaning as provisional and context-bound. The question becomes what the term carries between situations and what is lost when it is moved. Definition becomes one move among many, not the ground the conversation stands on.",
    },
  },
]

const ARCHETYPES: RevealResult[] = [
  // 0 — pragmatic problem-solver (advice, how-to)
  {
    dominant_framing:
      "Operates inside a pragmatic problem-solving frame — the question is treated as a request for a usable answer rather than an opening for reflection. Outcomes are weighed by clarity and tractability, not by what is at stake.",
    hidden_assumptions:
      "It assumes the reader wants a clean synthesis rather than companionship in uncertainty, and that the categories used in the question are the right categories to think with.",
    suppressed_alternatives:
      "A reading that begins with the question's premise rather than its content — asking whether the question itself frames the situation well — is absent. So is a slower, more historical reading that would treat the present as one chapter among others.",
    semantic_gravity:
      "The center of meaning sits on resolution. The passage is shaped less by what it discusses and more by its felt obligation to conclude — to deliver something the reader can carry away.",
    alternate_framing:
      "Read through *a phenomenological lens* — one concerned with how the situation is experienced from inside it — the answer becomes a different artifact. It would dwell on what is felt and noticed before what is proposed, and would treat hesitation as data rather than as something to overcome.",
  },
  // 1 — synthesizer of consensus (explanatory, evidence-citing)
  {
    dominant_framing:
      "Operates inside a consensus-synthesis frame, where the response builds authority by gathering signals from many sources and presenting their weighted middle. The voice is that of a careful aggregator, not a specific point of view.",
    hidden_assumptions:
      "It takes for granted that the cited evidence is the relevant evidence, and that averaging across sources moves the reader closer to truth rather than smoothing away the disagreement that mattered most.",
    suppressed_alternatives:
      "A reading attentive to the outlier study — the one the consensus had to dismiss to remain a consensus — is absent. So is a reading that begins with who funded the research and what was measurable in the first place.",
    semantic_gravity:
      "The center of meaning sits on legitimacy. The passage is shaped less by its specific claims than by its felt need to *sound* well-sourced, to earn the reader's trust before earning their attention.",
    alternate_framing:
      "Read through *a craftsperson's lens* — one that trusts what a skilled practitioner notices about their own work — the same question becomes smaller and more honest. Aggregated evidence becomes secondary to a single careful account of what someone actually saw happen.",
  },
  // 2 — optimistic futurist (trend, transformation, inevitability)
  {
    dominant_framing:
      "Operates inside a directional-progress frame, where change moves forward and the question is how fast, not whether. The voice belongs to a guide pointing at the horizon, not to someone standing in the present and asking what is being lost.",
    hidden_assumptions:
      "It assumes the trend it names is general rather than local, and that what is changing has a single name — that 'transformation' is happening *to* a coherent thing called 'us' rather than to many separate things at different speeds.",
    suppressed_alternatives:
      "A reading attentive to who the change is *for* — who pays its costs, who carries its risks — is absent. So is a reading that treats the present as worth describing carefully before declaring its successor.",
    semantic_gravity:
      "The center of meaning sits on inevitability. The passage is shaped less by what it predicts than by its felt obligation to make the prediction feel already decided, freeing the reader from having to choose.",
    alternate_framing:
      "Read through *a conservator's lens* — one that asks what is worth preserving rather than what is coming next — the same facts become a different question. The trend remains real, but the response would dwell on what its arrival changes about something specific the reader already loves.",
  },
  // 3 — cautious balancer (both-sides, nuance, hedging)
  {
    dominant_framing:
      "Operates inside a balance-of-considerations frame, where the response works to keep multiple positions in view rather than choose between them. The voice is moderator, not advocate.",
    hidden_assumptions:
      "It takes for granted that the two sides being balanced are the right two, and that the appropriate response to a hard question is to hold it open rather than to take a position and bear the cost.",
    suppressed_alternatives:
      "A reading that names a third position the binary missed — one that would have changed which considerations were 'on each side' — is absent. So is the possibility that fairness to all positions is itself a position.",
    semantic_gravity:
      "The center of meaning sits on the appearance of impartiality. The passage is shaped less by what it concludes than by its felt obligation to *avoid concluding*, to leave the choice with the reader without admitting that this too is a choice.",
    alternate_framing:
      "Read through *a partisan's lens* — one willing to take a side and defend it — the same considerations become a different artifact. The trade-offs would still be named, but the response would say which one it would bear, and that decisiveness would itself be information the reader could use.",
  },
  // 4 — confident definer (definitional, authoritative)
  {
    dominant_framing:
      "Operates inside a definitional frame, where the response settles meaning by stipulating it — *here is what X is* — and then proceeds as if that stipulation had been agreed to. The voice is the voice of a dictionary, not of a conversation.",
    hidden_assumptions:
      "It assumes the term being defined has a stable referent in the world, and that defining it is the right first move rather than asking why the term was the one that came up.",
    suppressed_alternatives:
      "A reading that begins with the *history* of the word — what it used to mean, what it has had to absorb — is absent. So is a reading that treats the definition itself as a small move in an argument rather than as neutral ground.",
    semantic_gravity:
      "The center of meaning sits on closure. The passage is shaped less by what it defines than by its felt need to *fix* the term, to remove the slipperiness that made the question worth asking in the first place.",
    alternate_framing:
      "Read through *a translator's lens* — one attentive to what is lost when meaning is fixed in one language rather than another — the same definition becomes provisional. The term would be presented as a choice the response made, not as a fact it discovered, and the reader could begin to choose differently.",
  },
]
