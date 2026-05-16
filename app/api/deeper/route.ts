import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { checkSecurity } from "@/lib/security"
import {
  DEEPER_READ_PROMPT,
  DEEPER_SELF_PROMPT,
  DEEPER_COMPARE_PROMPT,
} from "@/lib/deeperPrompt"
import type { Signal } from "@/lib/types"

export const runtime = "nodejs"

const MIN_CHARS = 40
const MAX_CHARS = 8000

/* ────────────────────────────────────────────────────────────────────
   Model routing — mirrors lib/analyze.ts so V2 inherits the same model
   config (OPENROUTER_MODEL, OPENROUTER_SELF_MODEL) without touching it.
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
  modelOverride?: string
): Promise<string | null> {
  if (openRouterClient) {
    const r = await openRouterClient.chat.completions.create({
      model: modelOverride || OPENROUTER_MODEL,
      max_tokens: 400,
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
      max_tokens: 400,
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
   Validation — same anchor + banned-phrase guards as the main pipeline.
   Kept local so the existing analyze.ts is not touched.
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

const BANNED_PATTERNS: RegExp[] = [
  /\bsemantic gravity\b/i,
  /\bontolog(y|ical)\b/i,
  /\binterpretive structure\b/i,
  /\bshape of meaning\b/i,
  /\bpassage is really about\b/i,
  /\bunderneath its (?:surface )?topic\b/i,
  /the center of (?:meaning|the passage|\w+) sits on/i,
  /\*[^*\n]{1,40}\*/,
  /operates inside (?:a |an )?[\w-]+ frame/i,
  /\bframe[, ]+where\b/i,
  /\bframe in which\b/i,
  /shaped less by .+ (?:than|and) more by/i,
  /less interested in .+ than in/i,
  /felt (?:obligation|need|imperative|urgency)/i,
  /treats the question as/i,
  /\btreats? .+ as given\b/i,
  /the passage is more interested in/i,
  /\b(epistemic|ontological|hegemonic|problematizes|interrogates|valorizes|instantiates)\b/i,
  /\b(perhaps|arguably|it could be (?:said|argued)|some might say|one could argue)\b/i,
  /^(?:remember[:,]|truth is[:,]?|at the end of the day[,]?|the bottom line is)/i,
  // prompt-leakage signatures
  /\b(perceptual_compression|hidden_intent_branching|alternate_reader_realities|conversational_trajectory|likely_next_concerns|why_it_matters|audience_effect|alternative_framing|different_steering|alternate_wording|framing_pull)\b/,
  /\bMATERIALITY RULE\b/,
  /\bSIGNAL[_ ]SHAPE\b/,
  /\bBANNED VOCABULARY\b/,
  /\bVOICE RULES\b/,
  /\bREFUSAL RULES\b/,
  /\bNON-DUPLICATION\b/,
  /\bANCHOR\b/,
  /communication-feedback instrument/i,
  /Return JSON with one field/i,
]

function hasBannedPhrase(text: string): boolean {
  return BANNED_PATTERNS.some((p) => p.test(text))
}

/* ────────────────────────────────────────────────────────────────────
   Request shape
   ──────────────────────────────────────────────────────────────────── */

type Mode = "read" | "yours" | "compare"

interface DeeperRequestBase {
  mode: Mode
  signals?: Signal[]
}
interface DeeperRequestSingle extends DeeperRequestBase {
  mode: "read" | "yours"
  text: string
}
interface DeeperRequestCompare extends DeeperRequestBase {
  mode: "compare"
  a: string
  b: string
}
type DeeperRequest = DeeperRequestSingle | DeeperRequestCompare

interface DeeperResult {
  deeper: string
}
interface DeeperDeclined {
  declined: true
  reason: string
}
type DeeperResponse = DeeperResult | DeeperDeclined

/* ────────────────────────────────────────────────────────────────────
   Handler
   ──────────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const sec = checkSecurity(req)
  if (!sec.ok) {
    return NextResponse.json(
      { error: sec.reason || "forbidden" },
      { status: sec.status || 403 }
    )
  }

  // Independent V2 kill switch — runtime, no rebuild required.
  if (process.env.LENS_DISABLE_DEEPER === "true") {
    return NextResponse.json(
      { declined: true, reason: "Service temporarily paused." },
      { status: 503 }
    )
  }

  const body = (await req.json().catch(() => ({}))) as Partial<DeeperRequest>
  const mode: Mode | undefined = body.mode

  if (mode !== "read" && mode !== "yours" && mode !== "compare") {
    return NextResponse.json(
      { declined: true, reason: "Unknown mode." },
      { status: 400 }
    )
  }

  // Signals are optional context for the model — pass through any that arrived,
  // but never trust their shape for validation.
  const signals = Array.isArray(body.signals) ? body.signals : []

  let userMessage = ""
  let sources: string[] = []
  let systemPrompt = ""
  let modelOverride: string | undefined

  if (mode === "compare") {
    const cb = body as Partial<DeeperRequestCompare>
    const a = typeof cb.a === "string" ? cb.a.trim() : ""
    const b = typeof cb.b === "string" ? cb.b.trim() : ""
    if (
      a.length < MIN_CHARS ||
      b.length < MIN_CHARS ||
      a.length > MAX_CHARS ||
      b.length > MAX_CHARS
    ) {
      return NextResponse.json(
        { declined: true, reason: "Passages out of range." },
        { status: 400 }
      )
    }
    sources = [a, b]
    systemPrompt = DEEPER_COMPARE_PROMPT
    userMessage = `PASSAGE A:\n${a}\n\n---\n\nPASSAGE B:\n${b}\n\n---\n\nSIGNALS ALREADY SHOWN:\n${signalsToContext(signals)}`
  } else {
    const sb = body as Partial<DeeperRequestSingle>
    const text = typeof sb.text === "string" ? sb.text.trim() : ""
    if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
      return NextResponse.json(
        { declined: true, reason: "Passage out of range." },
        { status: 400 }
      )
    }
    sources = [text]
    systemPrompt = mode === "yours" ? DEEPER_SELF_PROMPT : DEEPER_READ_PROMPT
    if (mode === "yours") modelOverride = OPENROUTER_SELF_MODEL
    userMessage = `PASSAGE:\n${text}\n\n---\n\nSIGNALS ALREADY SHOWN:\n${signalsToContext(signals)}`
  }

  if (!hasModelAccess()) {
    return NextResponse.json(
      { declined: true, reason: "Nothing more to point at right now." },
      { status: 200 }
    )
  }

  try {
    const raw = await callModel(systemPrompt, userMessage, modelOverride)
    const parsed = extractJson<DeeperResponse>(raw)

    if (parsed && "declined" in parsed && parsed.declined) {
      return NextResponse.json(parsed, { status: 200 })
    }

    if (
      parsed &&
      "deeper" in parsed &&
      typeof parsed.deeper === "string" &&
      parsed.deeper.trim().length > 0
    ) {
      const line = parsed.deeper.trim()
      const anchored = sources.some((s) => containsAnchorFromSource(line, s))
      if (!anchored || hasBannedPhrase(line)) {
        return NextResponse.json(
          {
            declined: true,
            reason: "Nothing specific enough to point at past what's already there.",
          },
          { status: 200 }
        )
      }
      return NextResponse.json({ deeper: line }, { status: 200 })
    }

    return NextResponse.json(
      {
        declined: true,
        reason: "Nothing specific enough to point at past what's already there.",
      },
      { status: 200 }
    )
  } catch (err) {
    console.error("[deeper] error:", err)
    return NextResponse.json(
      { error: "Something went quiet on our side. Try again in a moment." },
      { status: 500 }
    )
  }
}

function signalsToContext(signals: Signal[]): string {
  if (signals.length === 0) return "(none)"
  return signals
    .slice(0, 4)
    .map((s, i) => {
      const lines = [`(${i + 1})`]
      if (s.observation) lines.push(`  observation: ${s.observation}`)
      if (s.consequence) lines.push(`  consequence: ${s.consequence}`)
      if (s.steering) lines.push(`  steering: ${s.steering}`)
      return lines.join("\n")
    })
    .join("\n\n")
}
