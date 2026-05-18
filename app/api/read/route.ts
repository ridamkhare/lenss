import { NextRequest, NextResponse } from "next/server"
import { analyzeSelfStream, type StreamEvent } from "@/lib/analyze"
import { detectInjection, detectShape } from "@/lib/heuristics"
import { checkSecurity } from "@/lib/security"
import { logInteraction } from "@/lib/eventLog"
import type { Signal } from "@/lib/types"

export const runtime = "nodejs"

const MIN_CHARS = 40
const MAX_CHARS = 8000

export async function POST(req: NextRequest) {
  const sec = checkSecurity(req)
  if (!sec.ok) {
    return NextResponse.json(
      { error: sec.reason || "forbidden" },
      { status: sec.status || 403 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const text = typeof body?.text === "string" ? body.text.trim() : ""

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
        if (text.length === 0) {
          declineReason = "No passage was provided."
          emit({ type: "declined", reason: declineReason })
          return
        }
        if (text.length < MIN_CHARS) {
          declineReason = "This passage is too short to read."
          emit({ type: "declined", reason: declineReason })
          return
        }
        if (text.length > MAX_CHARS) {
          declineReason =
            "This is longer than the instrument was built for. Try a tighter excerpt."
          emit({ type: "declined", reason: declineReason })
          return
        }

        const injection = detectInjection(text)
        if (injection) {
          declineReason = injection.reason
          emit({ type: "declined", reason: declineReason })
          return
        }

        const shape = detectShape(text)
        if (shape) {
          declineReason = shape.reason
          emit({ type: "declined", reason: declineReason })
          return
        }

        for await (const event of analyzeSelfStream(text)) {
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
        console.error("[read] error:", err)
        outcome = "error"
        declineReason = "Something went quiet on our side. Try again in a moment."
        emit({ type: "error", reason: declineReason })
      } finally {
        controller.close()
        await logInteraction(req, {
          route: "read",
          mode: "yours",
          outcome,
          duration_ms: Date.now() - startedAt,
          input: text,
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
