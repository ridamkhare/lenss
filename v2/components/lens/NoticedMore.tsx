"use client"

import { useState } from "react"
import { fetchNotice } from "@/v2/lib/noticeClient"
import { isNoticeDeclined } from "@/v2/lib/noticeTypes"
import type {
  NoticeMode,
  NoticeResponse,
} from "@/v2/lib/noticeTypes"

type State =
  | { phase: "idle" }
  | { phase: "looking" }
  | { phase: "shown"; result: NoticeResponse }

/**
 * NoticedMore — the V2 affordance.
 *
 * Calm by design. No divider, lots of whitespace, italic centered reveal.
 * Lives below V1's Save / Another row but does not visually compete
 * with V1's structure: the affordance is one quiet clickable phrase,
 * the reveal is a single italic line in dimmed serif.
 *
 * onResultChange is invoked whenever the internal state lands on a
 * model response — lets the parent capture the notice for saving
 * alongside V1 in the archive.
 */
export function NoticedMore({
  mode,
  source,
  sourceB,
  v1Observations,
  onResultChange,
}: {
  mode: NoticeMode
  source: string
  sourceB?: string
  v1Observations: string[]
  onResultChange?: (r: NoticeResponse | null) => void
}) {
  const [state, setState] = useState<State>({ phase: "idle" })

  async function handleShow() {
    if (state.phase !== "idle") return
    setState({ phase: "looking" })
    const result = await fetchNotice({
      mode,
      text: source,
      textB: sourceB,
      v1Observations,
    })
    setState({ phase: "shown", result })
    onResultChange?.(result)
  }

  return (
    <div style={{ marginTop: "5rem" }}>
      {state.phase === "idle" && (
        <div
          className="text-center animate-reveal"
          style={{ animationDuration: "600ms", animationDelay: "200ms" }}
        >
          <button
            type="button"
            onClick={handleShow}
            className="font-sans text-[12px] text-ink-dimmed hover:text-ink transition-colors duration-300"
            style={{ opacity: 0.75 }}
          >
            Lenss noticed one more thing — show
          </button>
        </div>
      )}

      {state.phase === "looking" && (
        <p className="font-sans text-[12px] text-ink-dimmed text-center">
          <span className="animate-breathe">Looking once more</span>
        </p>
      )}

      {state.phase === "shown" && <NoticeReveal result={state.result} />}
    </div>
  )
}

function NoticeReveal({ result }: { result: NoticeResponse }) {
  if (isNoticeDeclined(result)) {
    return (
      <p
        className="font-sans text-[12px] text-ink-dimmed text-center animate-reveal"
        style={{ opacity: 0.85 }}
      >
        {result.reason}
      </p>
    )
  }

  return (
    <div
      className="animate-reveal text-center"
      style={{
        maxWidth: "34rem",
        marginLeft: "auto",
        marginRight: "auto",
        animationDuration: "700ms",
      }}
    >
      <p
        className="font-sans text-[10px] font-medium uppercase tracking-label text-ink-dimmed"
        style={{ marginBottom: "1rem", opacity: 0.6 }}
      >
        One more thing
      </p>
      <p
        className="font-serif italic text-ink-dimmed"
        style={{ fontSize: "15px", lineHeight: "1.7" }}
      >
        {result.notice}
      </p>
    </div>
  )
}
