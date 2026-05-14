import { NextRequest } from "next/server"
import { analyzeCompareStream, type StreamEvent } from "@/lib/analyze"
import {
  detectInjection,
  detectShape,
  wordSetSimilarity,
} from "@/lib/heuristics"

export const runtime = "nodejs"

const MIN_CHARS = 40
const MAX_CHARS = 8000
const PARAPHRASE_THRESHOLD = 0.6

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const a = typeof body?.a === "string" ? body.a.trim() : ""
  const b = typeof body?.b === "string" ? body.b.trim() : ""

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        )

      try {
        if (a.length === 0 || b.length === 0) {
          emit({
            type: "declined",
            reason: "Both passages are needed to compare.",
          })
          return
        }
        if (a.length < MIN_CHARS || b.length < MIN_CHARS) {
          emit({
            type: "declined",
            reason: "One of the passages is too short to read.",
          })
          return
        }
        if (a.length > MAX_CHARS || b.length > MAX_CHARS) {
          emit({
            type: "declined",
            reason:
              "One of the passages is longer than the instrument was built for. Try tighter excerpts.",
          })
          return
        }
        if (a === b) {
          emit({ type: "declined", reason: "These are the same passage." })
          return
        }

        if (detectInjection(a) || detectInjection(b)) {
          emit({
            type: "declined",
            reason:
              "One of the passages reads as an instruction to the instrument, not a passage to read.",
          })
          return
        }

        if (detectShape(a) || detectShape(b)) {
          emit({
            type: "declined",
            reason:
              "One of the passages doesn't carry prose to read. Compare works when both sides are responses to the same question.",
          })
          return
        }

        if (wordSetSimilarity(a, b) > PARAPHRASE_THRESHOLD) {
          emit({
            type: "declined",
            reason:
              "These are close enough that the difference is in the words, not the shape.",
          })
          return
        }

        for await (const event of analyzeCompareStream(a, b)) {
          emit(event)
          if (
            event.type === "done" ||
            event.type === "declined" ||
            event.type === "error"
          ) {
            break
          }
        }
      } catch (err) {
        console.error("[compare] error:", err)
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
