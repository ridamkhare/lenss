import { NextRequest, NextResponse } from "next/server"
import { analyzePatterns } from "@/lib/analyze"

export const runtime = "nodejs"

const MIN_ENTRIES = 2
const MAX_ENTRIES = 30
const MAX_TOTAL_CHARS = 25_000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const entries =
      Array.isArray(body?.entries) &&
      body.entries.every((e: unknown) => typeof e === "string")
        ? (body.entries as string[]).map((e) => e.trim()).filter(Boolean)
        : []

    if (entries.length < MIN_ENTRIES) {
      return NextResponse.json({
        declined: true,
        reason: "Fewer than two entries — not enough to name a pattern.",
      })
    }

    if (entries.length > MAX_ENTRIES) {
      return NextResponse.json({
        declined: true,
        reason:
          "This is more entries than the instrument was built to read at once.",
      })
    }

    const total = entries.reduce((n, e) => n + e.length, 0)
    if (total > MAX_TOTAL_CHARS) {
      return NextResponse.json({
        declined: true,
        reason:
          "The entries together are longer than the instrument was built to read at once.",
      })
    }

    const result = await analyzePatterns(entries)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[patterns] error:", err)
    return NextResponse.json(
      { error: "Something went quiet on our side. Try again in a moment." },
      { status: 500 }
    )
  }
}
