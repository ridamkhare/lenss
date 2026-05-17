/**
 * V2 — client-side fetch helper. Calls the V2 endpoint and returns
 * either a NoticeResult or a NoticeDeclined. No retry, no caching.
 * The affordance keeps it simple: one click, one response.
 */

import type {
  NoticeMode,
  NoticeRequest,
  NoticeResponse,
} from "@/v2/lib/noticeTypes"

export async function fetchNotice(args: {
  mode: NoticeMode
  text: string
  textB?: string
  v1Observations: string[]
}): Promise<NoticeResponse> {
  const body: NoticeRequest = {
    mode: args.mode,
    text: args.text,
    textB: args.textB,
    v1Observations: args.v1Observations,
  }

  try {
    const res = await fetch("/api/v2/notice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok && res.status !== 400) {
      return {
        declined: true,
        reason: "That didn't come through. Try again in a moment.",
      }
    }

    const data: NoticeResponse = await res.json()
    return data
  } catch {
    return {
      declined: true,
      reason: "That didn't come through. Try again in a moment.",
    }
  }
}
