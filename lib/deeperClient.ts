import type { Signal } from "./types"

export type DeeperRequestBody =
  | { mode: "read"; text: string; signals: Signal[] }
  | { mode: "yours"; text: string; signals: Signal[] }
  | { mode: "compare"; a: string; b: string; signals: Signal[] }

export type DeeperResult =
  | { kind: "deeper"; body: string }
  | { kind: "declined"; reason: string }
  | { kind: "error" }

export async function requestDeeper(
  body: DeeperRequestBody
): Promise<DeeperResult> {
  try {
    const res = await fetch("/api/deeper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok && res.status !== 200) {
      // The endpoint may also return non-200 with a JSON body (503, 400).
      // Fall through to JSON parsing; if that fails, treat as error.
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
      | { deeper?: string }
      | { declined?: boolean; reason?: string }

    if ("deeper" in parsed && typeof parsed.deeper === "string") {
      return { kind: "deeper", body: parsed.deeper }
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
