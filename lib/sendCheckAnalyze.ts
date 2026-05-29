import OpenAI from "openai"
import {
  PRESEND_EMAIL_RECIPIENT_PROMPT,
  PRESEND_EMAIL_META_PROMPT,
} from "./prompt"
import type {
  MetaSynthesis,
  RecipientArchetype,
  RecipientInput,
  RecipientReading,
  ReplyAction,
  SendCheckStreamEvent,
  SendReadiness,
} from "./types"

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5"

const openRouter = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "lens",
      },
    })
  : null

const MAX_TOKENS_PER_RECIPIENT = 700
const MAX_TOKENS_META = 500

const VALID_ACTIONS: ReplyAction[] = [
  "reply",
  "ignore",
  "escalate",
  "push_back",
  "ghost",
]
const VALID_VERDICTS: SendReadiness[] = ["ship", "review", "reconsider"]

function extractJson<T>(raw: string | null | undefined): T | null {
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

function buildRecipientUserMessage(
  subject: string,
  body: string,
  recipient: RecipientInput
): string {
  const contextLine = recipient.context
    ? `\nCONTEXT ABOUT THIS RECIPIENT: ${recipient.context}`
    : ""
  return `SUBJECT: ${subject}\n\nBODY:\n${body}\n\nRECIPIENT ARCHETYPE: ${recipient.archetype}${contextLine}`
}

function buildMetaUserMessage(
  subject: string,
  body: string,
  perRecipient: RecipientReading[]
): string {
  return `EMAIL (the same one read by each recipient):\n\nSUBJECT: ${subject}\n\nBODY:\n${body}\n\nPER-RECIPIENT READINGS:\n${JSON.stringify(perRecipient, null, 2)}`
}

async function callPerRecipient(
  subject: string,
  body: string,
  recipient: RecipientInput
): Promise<
  | { ok: true; reading: RecipientReading }
  | { ok: false; declined: string }
  | { ok: false; error: string }
> {
  if (!openRouter) return { ok: false, error: "Server is not configured." }

  let raw: string | null = null
  try {
    const r = await openRouter.chat.completions.create({
      model: OPENROUTER_MODEL,
      max_tokens: MAX_TOKENS_PER_RECIPIENT,
      messages: [
        { role: "system", content: PRESEND_EMAIL_RECIPIENT_PROMPT },
        {
          role: "user",
          content: buildRecipientUserMessage(subject, body, recipient),
        },
      ],
    })
    raw = r.choices[0]?.message?.content ?? null
  } catch (err) {
    console.error("[send-check] per-recipient fetch failed:", err)
    return { ok: false, error: "model_call_failed" }
  }

  const parsed = extractJson<{
    subject_notice?: string
    body_notice?: string
    reply_likelihood?: { action?: string; reason?: string }
    declined?: boolean
    reason?: string
  }>(raw)
  if (!parsed) return { ok: false, error: "parse_failed" }

  if (parsed.declined) {
    return {
      ok: false,
      declined: parsed.reason || "Nothing specific enough to read here.",
    }
  }

  if (
    typeof parsed.subject_notice !== "string" ||
    typeof parsed.body_notice !== "string" ||
    !parsed.reply_likelihood ||
    typeof parsed.reply_likelihood.action !== "string" ||
    typeof parsed.reply_likelihood.reason !== "string"
  ) {
    return { ok: false, error: "shape_invalid" }
  }

  const action = parsed.reply_likelihood.action as ReplyAction
  if (!VALID_ACTIONS.includes(action)) {
    return { ok: false, error: "invalid_action" }
  }

  return {
    ok: true,
    reading: {
      recipient: recipient.archetype,
      context: recipient.context ?? null,
      subject_notice: parsed.subject_notice.trim(),
      body_notice: parsed.body_notice.trim(),
      reply_likelihood: {
        action,
        reason: parsed.reply_likelihood.reason.trim(),
      },
    },
  }
}

async function callMeta(
  subject: string,
  body: string,
  perRecipient: RecipientReading[]
): Promise<MetaSynthesis | null> {
  if (!openRouter || perRecipient.length === 0) return null

  let raw: string | null = null
  try {
    const r = await openRouter.chat.completions.create({
      model: OPENROUTER_MODEL,
      max_tokens: MAX_TOKENS_META,
      messages: [
        { role: "system", content: PRESEND_EMAIL_META_PROMPT },
        { role: "user", content: buildMetaUserMessage(subject, body, perRecipient) },
      ],
    })
    raw = r.choices[0]?.message?.content ?? null
  } catch (err) {
    console.error("[send-check] meta fetch failed:", err)
    return null
  }

  const parsed = extractJson<{
    meta_pattern?: string
    send_readiness?: string
    send_readiness_reason?: string
  }>(raw)
  if (!parsed) return null

  if (
    typeof parsed.meta_pattern !== "string" ||
    typeof parsed.send_readiness !== "string" ||
    typeof parsed.send_readiness_reason !== "string"
  ) {
    return null
  }

  const verdict = parsed.send_readiness as SendReadiness
  if (!VALID_VERDICTS.includes(verdict)) return null

  return {
    meta_pattern: parsed.meta_pattern.trim(),
    send_readiness: verdict,
    send_readiness_reason: parsed.send_readiness_reason.trim(),
  }
}

/**
 * Streaming send-check: fires all per-recipient model calls in parallel,
 * yields each reading as it lands, then yields the meta-synthesis once
 * the recipient calls have settled. Final event is `done` with a server-
 * generated check_id.
 */
export async function* sendCheckStream(
  subject: string,
  body: string,
  recipients: RecipientInput[]
): AsyncGenerator<SendCheckStreamEvent, void, void> {
  if (!openRouter) {
    yield { type: "error", reason: "Server is not configured." }
    return
  }

  const checkId = crypto.randomUUID()
  const collected: RecipientReading[] = []

  // Fire all per-recipient calls in parallel
  const settled = await Promise.all(
    recipients.map(async (r) => ({
      recipient: r.archetype,
      result: await callPerRecipient(subject, body, r),
    }))
  )

  for (const { recipient, result } of settled) {
    if (result.ok) {
      collected.push(result.reading)
      yield { type: "recipient", reading: result.reading }
    } else if ("declined" in result) {
      yield { type: "recipient_declined", recipient, reason: result.declined }
    } else {
      yield {
        type: "recipient_declined",
        recipient,
        reason: "That recipient reading didn't come through cleanly.",
      }
    }
  }

  if (collected.length === 0) {
    yield {
      type: "declined",
      reason: "No recipient readings came through cleanly.",
    }
    return
  }

  // Meta synthesis only worth running if ≥2 recipients
  if (collected.length >= 2) {
    const meta = await callMeta(subject, body, collected)
    if (meta) {
      yield { type: "meta", meta }
    }
  }

  yield { type: "done", check_id: checkId }
}
