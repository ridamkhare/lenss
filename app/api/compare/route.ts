import { NextRequest, NextResponse } from "next/server"
import { analyzeCompare } from "@/lib/analyze"
import { detectInjection, detectShape, wordSetSimilarity } from "@/lib/heuristics"

const PARAPHRASE_THRESHOLD = 0.6

export const runtime = "nodejs"

const MIN_CHARS = 40
const MAX_CHARS = 8000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const a = typeof body?.a === "string" ? body.a.trim() : ""
    const b = typeof body?.b === "string" ? body.b.trim() : ""

    if (a.length === 0 || b.length === 0) {
      return NextResponse.json(
        { declined: true, reason: "Both passages are needed to compare." },
        { status: 400 }
      )
    }

    if (a.length < MIN_CHARS || b.length < MIN_CHARS) {
      return NextResponse.json({
        declined: true,
        reason: "One of the passages is too short to read.",
      })
    }

    if (a.length > MAX_CHARS || b.length > MAX_CHARS) {
      return NextResponse.json({
        declined: true,
        reason:
          "One of the passages is longer than the instrument was built for. Try tighter excerpts.",
      })
    }

    if (a === b) {
      return NextResponse.json({
        declined: true,
        reason: "These are the same passage.",
      })
    }

    const injectionA = detectInjection(a)
    const injectionB = detectInjection(b)
    if (injectionA || injectionB) {
      return NextResponse.json({
        declined: true,
        reason:
          "One of the passages reads as an instruction to the instrument, not a passage to read.",
      })
    }

    const shapeA = detectShape(a)
    const shapeB = detectShape(b)
    if (shapeA || shapeB) {
      return NextResponse.json({
        declined: true,
        reason:
          "One of the passages doesn't carry prose to read. Compare works when both sides are responses to the same question.",
      })
    }

    if (wordSetSimilarity(a, b) > PARAPHRASE_THRESHOLD) {
      return NextResponse.json({
        declined: true,
        reason:
          "These are close enough that the difference is in the words, not the shape.",
      })
    }

    const result = await analyzeCompare(a, b)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[compare] error:", err)
    return NextResponse.json(
      { error: "Something went quiet on our side. Try again in a moment." },
      { status: 500 }
    )
  }
}
