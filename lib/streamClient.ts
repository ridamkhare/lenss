import type { Signal } from "./types"

export type ClientStreamEvent =
  | { type: "signal"; signal: Signal }
  | { type: "declined"; reason: string }
  | { type: "error"; reason: string }
  | { type: "done" }

/**
 * POSTs to an SSE endpoint and yields parsed events one at a time.
 * The server emits `data: {json}\n\n` per event; this consumer
 * accumulates partial reads and yields each complete frame.
 */
export async function* streamRequest(
  url: string,
  body: unknown
): AsyncGenerator<ClientStreamEvent, void, void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok || !res.body) {
    yield {
      type: "error",
      reason: "That didn't come through. Try again in a moment.",
    }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split("\n\n")
    buffer = frames.pop() || ""

    for (const frame of frames) {
      const dataLine = frame
        .split("\n")
        .find((l) => l.startsWith("data: "))
      if (!dataLine) continue
      try {
        const parsed = JSON.parse(dataLine.slice(6)) as ClientStreamEvent
        yield parsed
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}
