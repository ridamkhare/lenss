import type { Signal } from "./types"

export type NoticeRequestBody =
  | { mode: "read"; text: string; signals: Signal[] }
  | { mode: "yours"; text: string; signals: Signal[] }
  | { mode: "compare"; a: string; b: string; signals: Signal[] }

export type NoticeResult =
  | { kind: "notice"; body: string }
  | { kind: "declined"; reason: string }
  | { kind: "error" }

export async function requestNotice(
  body: NoticeRequestBody
): Promise<NoticeResult> {
  try {
    const res = await fetch("/api/notice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok && res.status !== 200) {
      try {
        const parsed = (await res.json()) as
          | { declined?: boolean; reason?: string }
          | { error?: string }
        if ("declined" in parsed && parsed.declined && parsed.reason) {
          return { kind: "declined", reason: parsed.reason }
        }
      } catch {
        /* fall through */
      }
      return { kind: "error" }
    }

    const parsed = (await res.json()) as
      | { notice?: string }
      | { declined?: boolean; reason?: string }

    if ("notice" in parsed && typeof parsed.notice === "string") {
      return { kind: "notice", body: parsed.notice }
    }
    if (
      "declined" in parsed &&
      parsed.declined &&
      typeof parsed.reason === "string"
    ) {
      return { kind: "declined", reason: parsed.reason }
    }
    return { kind: "error" }
  } catch {
    return { kind: "error" }
  }
}
