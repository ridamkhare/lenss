import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { checkSecurity } from "@/lib/security"
import {
  NOTICE_READ_PROMPT,
  NOTICE_SELF_PROMPT,
  NOTICE_COMPARE_PROMPT,
} from "@/lib/noticePrompt"
import type { Signal } from "@/lib/types"
import { logInteraction } from "@/lib/eventLog"

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
  // mechanism vocabulary — the systemic-sounding words v3 bans
  /\binstalls? (?:a |an )?\w+ (?:trigger|point|mechanism)/i,
  /\bescalation point\b/i,
  /\bconditional escalation\b/i,
  /\binstantiates?\b/i,
  /\benacts? (?:a |an )/i,
  /\boperates as (?:a |an )/i,
  // prompt-leakage signatures
  /\b(perceptual_compression|hidden_intent_branching|alternate_reader_realities|conversational_trajectory|likely_next_concerns|why_it_matters|audience_effect|alternative_framing|different_steering|alternate_wording|framing_pull)\b/,
  /\bMATERIALITY RULE\b/,
  /\bSIGNAL[_ ]SHAPE\b/,
  /\bBANNED VOCABULARY\b/,
  /\bMECHANISM VOCABULARY\b/,
  /\bPLAIN LANGUAGE FLOOR\b/,
  /\bWHAT QUALIFIES AS AN INTERACTION DYNAMIC\b/,
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

interface NoticeRequestBase {
  mode: Mode
  signals?: Signal[]
}
interface NoticeRequestSingle extends NoticeRequestBase {
  mode: "read" | "yours"
  text: string
}
interface NoticeRequestCompare extends NoticeRequestBase {
  mode: "compare"
  a: string
  b: string
}
type NoticeRequest = NoticeRequestSingle | NoticeRequestCompare

interface NoticeResult {
  notice: string
}
interface NoticeDeclined {
  declined: true
  reason: string
}
type NoticeResponse = NoticeResult | NoticeDeclined

/* ────────────────────────────────────────────────────────────────────
   Handler
   ──────────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const sec = checkSecurity(req)
  if (!sec.ok) {
    // Hostile / unauthorized — don't log content.
    return NextResponse.json(
      { error: sec.reason || "forbidden" },
      { status: sec.status || 403 }
    )
  }

  const startedAt = Date.now()
  let loggedMode: "read" | "yours" | "compare" = "read"
  let loggedInput = ""
  let loggedInputB: string | undefined
  let loggedOutcome:
    | "notice"
    | "declined"
    | "input_rejected"
    | "error" = "input_rejected"
  let loggedNotice: string | undefined
  let loggedDecline: string | undefined

  try {
    // Independent V2 kill switch — runtime, no rebuild required.
    if (process.env.LENS_DISABLE_NOTICE === "true") {
      loggedOutcome = "declined"
      loggedDecline = "Service temporarily paused."
      return NextResponse.json(
        { declined: true, reason: loggedDecline },
        { status: 503 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as Partial<NoticeRequest>
    const mode: Mode | undefined = body.mode

    if (mode !== "read" && mode !== "yours" && mode !== "compare") {
      loggedDecline = "Unknown mode."
      return NextResponse.json(
        { declined: true, reason: loggedDecline },
        { status: 400 }
      )
    }
    loggedMode = mode

    // Signals are optional context for the model — pass through any that arrived,
    // but never trust their shape for validation.
    const signals = Array.isArray(body.signals) ? body.signals : []

    let userMessage = ""
    let sources: string[] = []
    let systemPrompt = ""
    let modelOverride: string | undefined

    if (mode === "compare") {
      const cb = body as Partial<NoticeRequestCompare>
      const a = typeof cb.a === "string" ? cb.a.trim() : ""
      const b = typeof cb.b === "string" ? cb.b.trim() : ""
      loggedInput = a
      loggedInputB = b
      if (
        a.length < MIN_CHARS ||
        b.length < MIN_CHARS ||
        a.length > MAX_CHARS ||
        b.length > MAX_CHARS
      ) {
        loggedDecline = "Passages out of range."
        return NextResponse.json(
          { declined: true, reason: loggedDecline },
          { status: 400 }
        )
      }
      sources = [a, b]
      systemPrompt = NOTICE_COMPARE_PROMPT
      userMessage = `PASSAGE A:\n${a}\n\n---\n\nPASSAGE B:\n${b}\n\n---\n\nSIGNALS ALREADY SHOWN:\n${signalsToContext(signals)}`
    } else {
      const sb = body as Partial<NoticeRequestSingle>
      const text = typeof sb.text === "string" ? sb.text.trim() : ""
      loggedInput = text
      if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
        loggedDecline = "Passage out of range."
        return NextResponse.json(
          { declined: true, reason: loggedDecline },
          { status: 400 }
        )
      }
      sources = [text]
      systemPrompt = mode === "yours" ? NOTICE_SELF_PROMPT : NOTICE_READ_PROMPT
      if (mode === "yours") modelOverride = OPENROUTER_SELF_MODEL
      userMessage = `PASSAGE:\n${text}\n\n---\n\nSIGNALS ALREADY SHOWN:\n${signalsToContext(signals)}`
    }

    if (!hasModelAccess()) {
      loggedOutcome = "declined"
      loggedDecline = "Nothing more to point at right now."
      return NextResponse.json(
        { declined: true, reason: loggedDecline },
        { status: 200 }
      )
    }

    try {
      const raw = await callModel(systemPrompt, userMessage, modelOverride)
      const parsed = extractJson<NoticeResponse>(raw)

      if (parsed && "declined" in parsed && parsed.declined) {
        loggedOutcome = "declined"
        loggedDecline = parsed.reason
        return NextResponse.json(parsed, { status: 200 })
      }

      if (
        parsed &&
        "notice" in parsed &&
        typeof parsed.notice === "string" &&
        parsed.notice.trim().length > 0
      ) {
        const line = parsed.notice.trim()
        const anchored = sources.some((s) => containsAnchorFromSource(line, s))
        if (!anchored || hasBannedPhrase(line)) {
          loggedOutcome = "declined"
          loggedDecline =
            "Nothing specific enough to point at past what's already there."
          return NextResponse.json(
            { declined: true, reason: loggedDecline },
            { status: 200 }
          )
        }
        loggedOutcome = "notice"
        loggedNotice = line
        return NextResponse.json({ notice: line }, { status: 200 })
      }

      loggedOutcome = "declined"
      loggedDecline =
        "Nothing specific enough to point at past what's already there."
      return NextResponse.json(
        { declined: true, reason: loggedDecline },
        { status: 200 }
      )
    } catch (err) {
      console.error("[notice] error:", err)
      loggedOutcome = "error"
      loggedDecline = "Something went quiet on our side. Try again in a moment."
      return NextResponse.json(
        { error: loggedDecline },
        { status: 500 }
      )
    }
  } finally {
    await logInteraction(req, {
      route: "notice",
      mode: loggedMode,
      outcome: loggedOutcome,
      duration_ms: Date.now() - startedAt,
      input: loggedInput,
      input_b: loggedInputB,
      notice: loggedNotice,
      decline_reason: loggedDecline,
    })
  }
}

function signalsToContext(signals: Signal[]): string {
  if (signals.length === 0) return "(none)"
  return signals
    .map((s, i) => {
      const lines = [`(${i + 1})`]
      if (s.observation) lines.push(`  observation: ${s.observation}`)
      if (s.consequence) lines.push(`  consequence: ${s.consequence}`)
      if (s.steering) lines.push(`  steering: ${s.steering}`)
      return lines.join("\n")
    })
    .join("\n\n")
}
