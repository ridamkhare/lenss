"use client"

import { useState } from "react"
import { requestNotice, type NoticeRequestBody } from "@/lib/noticeClient"
import type { Signal } from "@/lib/types"

/**
 * V2 — Lenss noticed one more thing.
 *
 * Two interaction layers stacked beneath the V1 reading:
 *
 *   1. A quiet continuation cue (always visible). Clicking it copies
 *      the currently-explored insights to the user's clipboard so
 *      they can carry them back into their AI conversation. If the
 *      V2 reveal is open, the notice body is included; otherwise just
 *      the V1 signals.
 *
 *   2. The "Lenss noticed one more thing — show" affordance. Clicking
 *      it requests the V2 endpoint and replaces itself with the
 *      grounded one-line notice. Independent from the cue.
 *
 * Disabled when NEXT_PUBLIC_LENS_NOTICE === "false" (compile-time
 * client kill). Server-side kill is LENS_DISABLE_NOTICE on the API.
 *
 * The cue is intentionally NOT a button. It reads as a quiet line of
 * prose; hover surfaces a dotted underline only. The clipboard write
 * is the action; the visual feedback is a brief text swap to
 * "Copied." for ~1.8s, then back to the cue. No toast, no animation
 * beyond the swap.
 */

type Props =
  | {
      mode: "read" | "yours"
      source: string
      signals: Signal[]
    }
  | {
      mode: "compare"
      sourceA: string
      sourceB: string
      signals: Signal[]
    }

type State =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "revealed"; body: string }
  | { kind: "quiet"; reason: string }

const CONTINUATION_CUE = "Carry these insights back into the conversation and see what changes."
const COPIED_LABEL = "Copied."
const COPIED_FEEDBACK_MS = 1800

export function NoticedMore(props: Props) {
  const enabled = process.env.NEXT_PUBLIC_LENS_NOTICE !== "false"
  const [state, setState] = useState<State>({ kind: "idle" })
  const [copied, setCopied] = useState(false)

  if (!enabled) return null

  async function go() {
    if (state.kind === "asking" || state.kind === "revealed") return
    setState({ kind: "asking" })

    const body: NoticeRequestBody =
      props.mode === "compare"
        ? {
            mode: "compare",
            a: props.sourceA,
            b: props.sourceB,
            signals: props.signals,
          }
        : {
            mode: props.mode,
            text: props.source,
            signals: props.signals,
          }

    const r = await requestNotice(body)
    if (r.kind === "notice") {
      setState({ kind: "revealed", body: r.body })
    } else if (r.kind === "declined") {
      setState({ kind: "quiet", reason: r.reason })
    } else {
      // Error: stay silent. The affordance simply disappears.
      setState({ kind: "quiet", reason: "" })
    }
  }

  /**
   * Build the clipboard payload from currently-explored insights.
   *
   * Per V1 signal: observation + consequence joined as one paragraph.
   * Steering and depth fields are skipped — those are tactical
   * suggestions, not the perceptual insight worth carrying back.
   *
   * If the V2 reveal is open, the notice body is appended as a final
   * paragraph. No labels, no separators, no UI chrome.
   */
  function buildCopyText(): string {
    const parts: string[] = []
    for (const s of props.signals) {
      const obs = s.observation?.trim()
      const cons = s.consequence?.trim()
      if (obs && cons) parts.push(`${obs} ${cons}`)
      else if (obs) parts.push(obs)
      else if (cons) parts.push(cons)
    }
    if (state.kind === "revealed" && state.body) {
      parts.push(state.body.trim())
    }
    return parts.join("\n\n")
  }

  async function copyInsights() {
    if (copied) return
    const text = buildCopyText()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    } catch {
      // Clipboard API failure (permissions, http context, etc.) — stay silent.
    }
  }

  const showCue = state.kind !== "quiet"
  const asking = state.kind === "asking"

  return (
    <div className="mt-6 animate-reveal" style={{ animationDelay: "300ms" }}>
      {showCue && (
        <button
          type="button"
          onClick={copyInsights}
          aria-label="Carry these insights back into the conversation"
          className="block font-serif italic text-[13px] text-ink-dimmed hover:text-ink hover:underline hover:decoration-dotted hover:underline-offset-4 transition-colors duration-300 text-left"
          style={{ opacity: 0.7, lineHeight: "1.6" }}
        >
          {copied ? COPIED_LABEL : CONTINUATION_CUE}
        </button>
      )}

      {(state.kind === "idle" || state.kind === "asking") && (
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            onClick={go}
            disabled={asking}
            aria-label="Lenss noticed one more thing"
            className={
              asking
                ? "font-serif italic text-[14px] text-ink-dimmed/70 animate-breathe cursor-default"
                : "font-serif italic text-[14px] text-ink-dimmed/85 hover:text-ink hover:underline hover:decoration-dotted hover:underline-offset-4 transition-colors duration-300"
            }
          >
            Lenss noticed one more thing — show
          </button>
        </div>
      )}

      {state.kind === "revealed" && (
        <div
          className="animate-reveal text-center mx-auto"
          style={{
            marginTop: "2rem",
            maxWidth: "34rem",
            animationDuration: "700ms",
          }}
          data-clarity-mask="True"
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
            {state.body}
          </p>
        </div>
      )}

      {state.kind === "quiet" && state.reason && (
        <div
          className="mt-12 animate-reveal text-center"
          style={{ animationDuration: "700ms" }}
        >
          <p
            className="font-sans text-[12px] text-ink-dimmed mx-auto"
            style={{ maxWidth: "34rem", opacity: 0.85 }}
          >
            {state.reason}
          </p>
        </div>
      )}
    </div>
  )
}
