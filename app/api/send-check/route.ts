import { NextRequest, NextResponse } from "next/server"
import { sendCheckStream } from "@/lib/sendCheckAnalyze"
import { checkSecurity } from "@/lib/security"
import { gate, recordCheck } from "@/lib/sendCheckGate"
import type {
  MetaSynthesis,
  RecipientInput,
  RecipientReading,
  SendCheckStreamEvent,
} from "@/lib/types"

export const runtime = "nodejs"

// Input limits for v1
const MIN_SUBJECT = 3
const MAX_SUBJECT = 200
const MIN_BODY = 30
const MAX_BODY = 4000
const MIN_RECIPIENTS = 1
const MAX_RECIPIENTS = 4
const MAX_CONTEXT = 200

// Archetype label: must start with a letter, 1-30 chars total, alphanumeric +
// space + hyphen + apostrophe. Covers predefined chips (boss/peer/etc.) plus
// user-typed customs (co-founder, ex-partner, thesis advisor, etc.) without
// opening the door to prompt injection via weird characters.
const ARCHETYPE_RE = /^[a-zA-Z][a-zA-Z0-9 \-']{0,29}$/

function normalizeArchetype(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase()
  if (!ARCHETYPE_RE.test(trimmed)) return null
  // collapse internal whitespace
  return trimmed.replace(/\s+/g, " ")
}

function sanitizeRecipients(raw: unknown): RecipientInput[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<string>()
  const out: RecipientInput[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const r = item as { archetype?: unknown; context?: unknown }
    if (typeof r.archetype !== "string") continue
    const normalized = normalizeArchetype(r.archetype)
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    let context: string | null = null
    if (typeof r.context === "string") {
      const trimmed = r.context.trim().slice(0, MAX_CONTEXT)
      if (trimmed.length > 0) context = trimmed
    }
    out.push({ archetype: normalized, context })
    if (out.length >= MAX_RECIPIENTS) break
  }
  return out.length >= MIN_RECIPIENTS ? out : null
}

export async function POST(req: NextRequest) {
  const sec = checkSecurity(req)
  if (!sec.ok) {
    return NextResponse.json(
      { error: sec.reason || "forbidden" },
      { status: sec.status || 403 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const subject =
    typeof body?.subject === "string" ? body.subject.trim() : ""
  const draftBody =
    typeof body?.body === "string" ? body.body.trim() : ""
  const recipients = sanitizeRecipients(body?.recipients)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const collectedRecipients: RecipientReading[] = []
      let collectedMeta: MetaSynthesis | null = null
      let outcome: "completed" | "declined" | "error" = "declined"

      const emit = (event: SendCheckStreamEvent) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        )

      try {
        // Input validation first (cheap; no DB hit, no model call)
        if (subject.length < MIN_SUBJECT) {
          emit({ type: "declined", reason: "A subject line helps the reading. Add one." })
          return
        }
        if (subject.length > MAX_SUBJECT) {
          emit({ type: "declined", reason: "That subject is longer than the instrument was built for." })
          return
        }
        if (draftBody.length < MIN_BODY) {
          emit({ type: "declined", reason: "The body is too short to read meaningfully." })
          return
        }
        if (draftBody.length > MAX_BODY) {
          emit({ type: "declined", reason: "That email is longer than the instrument was built for. Try a tighter version." })
          return
        }
        if (!recipients) {
          emit({ type: "declined", reason: "Pick at least one recipient." })
          return
        }

        // Gate (anon IP daily cap OR authed daily cap)
        const gateResult = await gate(req)
        if (!gateResult.allow) {
          if (gateResult.reason === "anon_used") {
            emit({
              type: "rate_limited",
              kind: "anon_used",
              reason: `You've used today's ${gateResult.capDaily} free reveals. Sign up free to unlock 5 every day, plus saved personas and full history.`,
            })
          } else if (gateResult.reason === "daily_cap_reached") {
            const isPro = gateResult.plan === "trial" || gateResult.plan === "active"
            emit({
              type: "rate_limited",
              kind: "daily_cap_reached",
              reason: isPro
                ? `You've used today's ${gateResult.capDaily} reveals. Resets at midnight UTC.`
                : `You've used today's ${gateResult.capDaily} free reveals. Try Pro free for 10 days for unlimited reveals, or come back tomorrow.`,
            })
          } else {
            emit({
              type: "error",
              reason: "Something went quiet on our side. Try again in a moment.",
            })
          }
          return
        }

        // Recipient cap by tier: anon + free → 3, pro (trial or active) → 4
        const isProTier =
          gateResult.mode === "user" &&
          (gateResult.user.plan === "trial" || gateResult.user.plan === "active")
        const maxRecipients = isProTier ? 4 : 3
        if (recipients.length > maxRecipients) {
          emit({
            type: "rate_limited",
            kind: "anon_used",
            reason: `Up to ${maxRecipients} recipients per check on your plan. Pro reads against 4 at once.`,
          })
          return
        }

        // Run the analysis
        for await (const event of sendCheckStream(subject, draftBody, recipients)) {
          if (event.type === "recipient") collectedRecipients.push(event.reading)
          if (event.type === "meta") collectedMeta = event.meta
          if (event.type === "done") outcome = "completed"
          if (event.type === "declined") outcome = "declined"
          if (event.type === "error") outcome = "error"
          emit(event)
          if (event.type === "done" || event.type === "declined" || event.type === "error") {
            break
          }
        }

        // Persist the check (async, doesn't block response). For anon, this
        // just records the IP hash so the next call gets blocked. For authed,
        // it stores the full check for history + daily-cap counting.
        try {
          await recordCheck({
            gateResult,
            subject,
            body: draftBody,
            recipients,
            results: {
              per_recipient: collectedRecipients,
              meta: collectedMeta,
            },
            outcome,
          })
        } catch (err) {
          console.error("[send-check] recordCheck failed:", err)
          // Don't surface — the user already has their result.
        }
      } catch (err) {
        console.error("[send-check] error:", err)
        emit({
          type: "error",
          reason: "Something went quiet on our side. Try again in a moment.",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
