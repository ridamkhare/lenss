import { NextRequest, NextResponse } from "next/server"
import { analyzeNotice } from "@/v2/server/noticeAnalyze"
import type {
  NoticeMode,
  NoticeRequest,
} from "@/v2/lib/noticeTypes"

const MIN_CHARS = 40
const MAX_CHARS = 8000

function isMode(v: unknown): v is NoticeMode {
  return v === "reveal" || v === "self" || v === "compare"
}

export async function handleNoticeRequest(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<NoticeRequest>

    const mode = isMode(body?.mode) ? body.mode : "reveal"
    const text = typeof body?.text === "string" ? body.text.trim() : ""
    const textB =
      typeof body?.textB === "string" ? body.textB.trim() : undefined
    const v1Observations = Array.isArray(body?.v1Observations)
      ? body.v1Observations
          .filter((s): s is string => typeof s === "string")
          .slice(0, 4)
      : []

    if (text.length === 0) {
      return NextResponse.json(
        { declined: true, reason: "No passage was provided." },
        { status: 400 }
      )
    }

    if (text.length < MIN_CHARS) {
      return NextResponse.json({
        declined: true,
        reason: "Too little wording for a second look.",
      })
    }

    if (text.length > MAX_CHARS) {
      return NextResponse.json({
        declined: true,
        reason: "Longer than the second pass was built for.",
      })
    }

    if (mode === "compare") {
      if (!textB || textB.length < MIN_CHARS) {
        return NextResponse.json({
          declined: true,
          reason: "Compare needs both passages to look again.",
        })
      }
      if (textB.length > MAX_CHARS) {
        return NextResponse.json({
          declined: true,
          reason: "Longer than the second pass was built for.",
        })
      }
    }

    const result = await analyzeNotice({
      mode,
      text,
      textB,
      v1Observations,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error("[v2/notice] error:", err)
    return NextResponse.json(
      { declined: true, reason: "Something went quiet. Try again in a moment." },
      { status: 500 }
    )
  }
}
