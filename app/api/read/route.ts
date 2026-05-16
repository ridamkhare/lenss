import { NextRequest, NextResponse } from "next/server"
import { analyzeSelfStream, type StreamEvent } from "@/lib/analyze"
import { detectInjection, detectShape } from "@/lib/heuristics"
import { checkSecurity } from "@/lib/security"

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
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        )

      try {
        if (text.length === 0) {
          emit({ type: "declined", reason: "No passage was provided." })
          return
        }
        if (text.length < MIN_CHARS) {
          emit({
            type: "declined",
            reason: "This passage is too short to read.",
          })
          return
        }
        if (text.length > MAX_CHARS) {
          emit({
            type: "declined",
            reason:
              "This is longer than the instrument was built for. Try a tighter excerpt.",
          })
          return
        }

        const injection = detectInjection(text)
        if (injection) {
          emit({ type: "declined", reason: injection.reason })
          return
        }

        const shape = detectShape(text)
        if (shape) {
          emit({ type: "declined", reason: shape.reason })
          return
        }

        for await (const event of analyzeSelfStream(text)) {
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
        console.error("[read] error:", err)
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
