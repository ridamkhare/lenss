import { NextRequest, NextResponse } from "next/server"
import { analyzeCompareStream, type StreamEvent } from "@/lib/analyze"
import {
  detectInjection,
  detectShape,
  wordSetSimilarity,
} from "@/lib/heuristics"
import { checkSecurity } from "@/lib/security"
import { logInteraction } from "@/lib/eventLog"
import type { Signal } from "@/lib/types"

export const runtime = "nodejs"

const MIN_CHARS = 40
const MAX_CHARS = 8000
const PARAPHRASE_THRESHOLD = 0.6

export async function POST(req: NextRequest) {
  const sec = checkSecurity(req)
  if (!sec.ok) {
    return NextResponse.json(
      { error: sec.reason || "forbidden" },
      { status: sec.status || 403 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const a = typeof body?.a === "string" ? body.a.trim() : ""
  const b = typeof body?.b === "string" ? body.b.trim() : ""

  const encoder = new TextEncoder()
  const startedAt = Date.now()
  const collectedSignals: Signal[] = []
  let outcome: "signals" | "declined" | "input_rejected" | "error" =
    "input_rejected"
  let declineReason: string | undefined

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        )

      try {
        if (a.length === 0 || b.length === 0) {
          declineReason = "Both passages are needed to compare."
          emit({ type: "declined", reason: declineReason })
          return
        }
        if (a.length < MIN_CHARS || b.length < MIN_CHARS) {
          declineReason = "One of the passages is too short to read."
          emit({ type: "declined", reason: declineReason })
          return
        }
        if (a.length > MAX_CHARS || b.length > MAX_CHARS) {
          declineReason =
            "One of the passages is longer than the instrument was built for. Try tighter excerpts."
          emit({ type: "declined", reason: declineReason })
          return
        }
        if (a === b) {
          declineReason = "These are the same passage."
          emit({ type: "declined", reason: declineReason })
          return
        }

        if (detectInjection(a) || detectInjection(b)) {
          declineReason =
            "One of the passages reads as an instruction to the instrument, not a passage to read."
          emit({ type: "declined", reason: declineReason })
          return
        }

        if (detectShape(a) || detectShape(b)) {
          declineReason =
            "One of the passages doesn't carry prose to read. Compare works when both sides are responses to the same question."
          emit({ type: "declined", reason: declineReason })
          return
        }

        if (wordSetSimilarity(a, b) > PARAPHRASE_THRESHOLD) {
          declineReason =
            "These are close enough that the difference is in the words, not the shape."
          emit({ type: "declined", reason: declineReason })
          return
        }

        for await (const event of analyzeCompareStream(a, b)) {
          emit(event)
          if (event.type === "signal") collectedSignals.push(event.signal)
          if (event.type === "done") {
            outcome = "signals"
            break
          }
          if (event.type === "declined") {
            outcome = "declined"
            declineReason = event.reason
            break
          }
          if (event.type === "error") {
            outcome = "error"
            declineReason = event.reason
            break
          }
        }
      } catch (err) {
        console.error("[compare] error:", err)
        outcome = "error"
        declineReason = "Something went quiet on our side. Try again in a moment."
        emit({ type: "error", reason: declineReason })
      } finally {
        controller.close()
        await logInteraction(req, {
          route: "compare",
          mode: "compare",
          outcome,
          duration_ms: Date.now() - startedAt,
          input: a,
          input_b: b,
          signals: outcome === "signals" ? collectedSignals : undefined,
          decline_reason: declineReason,
        })
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
