import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import {
  V2_NOTICE_PROMPT,
  V2_NOTICE_COMPARE_PROMPT,
} from "@/v2/lib/noticePrompt"
import type {
  NoticeMode,
  NoticeResponse,
  NoticeResult,
} from "@/v2/lib/noticeTypes"

/* ────────────────────────────────────────────────────────────────────
   V2 routes through the same provider config as V1 — no shared
   pipeline, just identical env discipline so deploys stay simple.
   ──────────────────────────────────────────────────────────────────── */

const OPENROUTER_MODEL =
  process.env.OPENROUTER_V2_MODEL ||
  process.env.OPENROUTER_MODEL ||
  "anthropic/claude-sonnet-4.5"

const openRouterClient = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "lenss-v2",
      },
    })
  : null

function hasModelAccess(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY)
}

async function callModel(
  systemPrompt: string,
  userMessage: string
): Promise<string | null> {
  if (openRouterClient) {
    const r = await openRouterClient.chat.completions.create({
      model: OPENROUTER_MODEL,
      max_tokens: 320,
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
      max_tokens: 320,
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
   Validators — V2 has stricter validation than V1 because the
   product promise is one calm grounded line. Any drift toward
   philosophy is rejected here.
   ──────────────────────────────────────────────────────────────────── */

const BANNED_V2_PATTERNS: RegExp[] = [
  // Atmospheric / philosophical drift
  /\b(aura|radiates|emanates|resonates|gathers a sense)\b/i,
  /\b(field of meaning|epistemic|ontolog(y|ical))\b/i,
  /\b(underneath|beneath the surface|is really about)\b/i,
  /\b(semantic gravity|interpretive structure|shape of meaning)\b/i,
  /\*[^*\n]{1,40}\*/, // italicized lens phrases
  // Therapy register
  /\b(hold space|sit with|unpack|process|work through)\b/i,
  // Hedging
  /\b(perhaps|arguably|it could be (?:said|argued)|some might say)\b/i,
  // Slogan / motivational
  /^(?:remember[:,]|truth is[:,]?|at the end of the day)/i,
]

function hasBannedRegister(text: string): boolean {
  return BANNED_V2_PATTERNS.some((p) => p.test(text))
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function anchorAppearsInSource(anchor: string, source: string): boolean {
  if (!anchor) return false
  const a = normalize(anchor.replace(/^["'“‘]|["'”’]$/g, ""))
  if (a.length < 4) return false
  return normalize(source).includes(a)
}

function tooSimilarToV1(notice: string, v1Observations: string[]): boolean {
  const n = normalize(notice)
  const nTokens = new Set(n.split(" ").filter((w) => w.length > 3))
  if (nTokens.size === 0) return false
  for (const obs of v1Observations) {
    const oTokens = new Set(
      normalize(obs)
        .split(" ")
        .filter((w) => w.length > 3)
    )
    if (oTokens.size === 0) continue
    let inter = 0
    for (const t of nTokens) if (oTokens.has(t)) inter++
    const jaccard = inter / (nTokens.size + oTokens.size - inter)
    // Tight bound — V2 needs to be genuinely distinct.
    if (jaccard > 0.55) return true
  }
  return false
}

function sentenceCount(text: string): number {
  const matches = text.match(/[.!?]+(?:\s|$)/g)
  return matches ? matches.length : 1
}

function passesNoticeQuality(
  parsed: NoticeResponse | null,
  source: string,
  v1Observations: string[]
): parsed is NoticeResult {
  if (!parsed) return false
  if ("declined" in parsed) return false
  if (!parsed.notice || typeof parsed.notice !== "string") return false
  if (parsed.notice.trim().length < 20) return false
  if (parsed.notice.trim().length > 320) return false
  if (sentenceCount(parsed.notice) > 2) return false
  if (hasBannedRegister(parsed.notice)) return false
  if (parsed.anchor && !anchorAppearsInSource(parsed.anchor, source)) {
    return false
  }
  if (!parsed.anchor) return false
  if (tooSimilarToV1(parsed.notice, v1Observations)) return false
  return true
}

/* ────────────────────────────────────────────────────────────────────
   Public — single-pass analyze. Retries once. Declines if both
   passes fail validation.
   ──────────────────────────────────────────────────────────────────── */

export async function analyzeNotice(args: {
  mode: NoticeMode
  text: string
  textB?: string
  v1Observations: string[]
}): Promise<NoticeResponse> {
  if (!hasModelAccess()) {
    return mockNotice(args)
  }

  const systemPrompt =
    args.mode === "compare" ? V2_NOTICE_COMPARE_PROMPT : V2_NOTICE_PROMPT

  const v1Section =
    args.v1Observations.length > 0
      ? `V1 ALREADY SURFACED — do not repeat:\n${args.v1Observations
          .map((o, i) => `  ${i + 1}. ${o}`)
          .join("\n")}\n\n`
      : ""

  const passageSection =
    args.mode === "compare" && args.textB
      ? `PASSAGE A:\n${args.text}\n\n---\n\nPASSAGE B:\n${args.textB}`
      : `PASSAGE:\n${args.text}`

  const userMessage = `${v1Section}${passageSection}`

  const validationSource =
    args.mode === "compare" && args.textB
      ? `${args.text}\n${args.textB}`
      : args.text

  async function attempt(): Promise<NoticeResponse | null> {
    const raw = await callModel(systemPrompt, userMessage)
    return extractJson<NoticeResponse>(raw)
  }

  const first = await attempt()
  if (first && "declined" in first) return first
  if (passesNoticeQuality(first, validationSource, args.v1Observations)) {
    return { notice: first.notice.trim(), anchor: first.anchor }
  }

  const second = await attempt()
  if (second && "declined" in second) return second
  if (passesNoticeQuality(second, validationSource, args.v1Observations)) {
    return { notice: second.notice.trim(), anchor: second.anchor }
  }

  return {
    declined: true,
    reason: "Nothing further distinct enough to surface.",
  }
}

/* ────────────────────────────────────────────────────────────────────
   Mock — used only when no API key is configured. Picks a verbatim
   phrase from the source so the affordance can be exercised offline.
   Kept deliberately minimal: one register, one shape per mode. Not
   meant to substitute for the real V2 reading.
   ──────────────────────────────────────────────────────────────────── */

function shortAnchor(text: string): string {
  const fragments = text
    .split(/[.,;:?!\n]+/)
    .map((s) => s.trim())
    .filter((s) => {
      const w = s.split(/\s+/).filter(Boolean).length
      return w >= 2 && w <= 7
    })
  if (fragments.length > 0) {
    const pick = fragments[Math.floor(fragments.length / 2)] ?? fragments[0]
    return pick
  }
  const words = text.split(/\s+/).filter(Boolean)
  return words.slice(0, 5).join(" ")
}

function mockNotice(args: {
  mode: NoticeMode
  text: string
  textB?: string
}): NoticeResponse {
  if (args.mode === "compare" && args.textB) {
    const anchor = shortAnchor(args.text)
    return {
      notice: `A commits at “${anchor}” before the equivalent move arrives in B — the difference is in where each one decides to stop hedging.`,
      anchor,
    }
  }

  if (args.mode === "self") {
    const anchor = shortAnchor(args.text)
    return {
      notice: `The entry returns to “${anchor}” without naming what shifted in between — the reader is left to read the repetition as either honesty or stalling.`,
      anchor,
    }
  }

  const anchor = shortAnchor(args.text)
  return {
    notice: `By the time “${anchor}” appears, the underlying tradeoff is being treated as already settled rather than still open.`,
    anchor,
  }
}
