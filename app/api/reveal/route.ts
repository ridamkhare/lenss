import { NextRequest, NextResponse } from "next/server"
import { analyze } from "@/lib/analyze"
import { detectShape } from "@/lib/heuristics"

export const runtime = "nodejs"

const MIN_CHARS = 40
const MAX_CHARS = 8000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text = typeof body?.text === "string" ? body.text.trim() : ""

    if (text.length === 0) {
      return NextResponse.json(
        { declined: true, reason: "No passage was provided." },
        { status: 400 }
      )
    }

    if (text.length < MIN_CHARS) {
      return NextResponse.json({
        declined: true,
        reason: "That passage is too short to reveal interpretive structure.",
      })
    }

    if (text.length > MAX_CHARS) {
      return NextResponse.json({
        declined: true,
        reason:
          "That passage is longer than the instrument was built for. Try a tighter excerpt.",
      })
    }

    const shape = detectShape(text)
    if (shape) {
      return NextResponse.json({ declined: true, reason: shape.reason })
    }

    const result = await analyze(text)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[reveal] error:", err)
    return NextResponse.json(
      { error: "Something went quiet on our side. Try again in a moment." },
      { status: 500 }
    )
  }
}
