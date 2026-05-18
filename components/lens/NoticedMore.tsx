"use client"

import { useEffect, useRef, useState } from "react"
import { requestNotice, type NoticeRequestBody } from "@/lib/noticeClient"
import type { Signal } from "@/lib/types"
import type { DepthKey } from "@/lib/useDepthSelection"

/**
 * V2 — Lenss noticed one more thing.
 *
 * Two interaction layers stacked beneath the V1 reading:
 *
 *   1. A quiet continuation cue (always visible, except on decline).
 *      Clicking it copies the user's currently-explored insights to
 *      the clipboard — every visible field of every V1 signal, the
 *      contents of any depth fields the user has expanded, and the
 *      V2 notice body if it's been revealed. The cue is a clickable
 *      line of prose, not a button. Hover surfaces a dotted underline.
 *
 *   2. The "Lenss noticed one more thing — show" affordance. Clicking
 *      it requests the V2 endpoint and replaces itself with the
 *      grounded one-line notice. Independent from the cue.
 *
 * Auto-recopy: if the user has clicked the cue at least once, and then
 * the V2 reveal arrives, the clipboard is automatically rewritten to
 * include the new notice. The cue flashes "Copied." to indicate the
 * update. Browser clipboard permissions may make this fail silently
 * outside a user-gesture window — in that case the original V1-only
 * payload remains in the clipboard and the user can click the cue
 * again to refresh it.
 *
 * Disabled when NEXT_PUBLIC_LENS_NOTICE === "false" (compile-time
 * client kill). Server-side kill is LENS_DISABLE_NOTICE on the API.
 */

type Props =
  | {
      mode: "read" | "yours"
      source: string
      signals: Signal[]
      revealedBySignal?: Record<number, Set<DepthKey>>
    }
  | {
      mode: "compare"
      sourceA: string
      sourceB: string
      signals: Signal[]
      revealedBySignal?: Record<number, Set<DepthKey>>
    }

type State =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "revealed"; body: string }
  | { kind: "quiet"; reason: string }

const CONTINUATION_CUE =
  "Carry these insights back into the conversation and see what changes."
const COPIED_LABEL = "Copied."
const COPIED_FEEDBACK_MS = 1800

const DEPTH_KEYS: DepthKey[] = [
  "why_it_matters",
  "audience_effect",
  "alternative_framing",
  "different_steering",
  "likely_next_concerns",
  "hidden_intent_branching",
  "framing_pull",
  "alternate_reader_realities",
  "conversational_trajectory",
]

export function NoticedMore(props: Props) {
  const enabled = process.env.NEXT_PUBLIC_LENS_NOTICE !== "false"
  const [state, setState] = useState<State>({ kind: "idle" })
  const [copied, setCopied] = useState(false)

  // Tracks whether the user has copied at least once in this session.
  // Used to decide whether to auto-rewrite the clipboard when V2 lands.
  const hasCopiedOnceRef = useRef(false)

  // Tracks the previous state.kind to detect the asking→revealed
  // transition that should trigger the auto-recopy.
  const prevStateKindRef = useRef<State["kind"]>(state.kind)

  // Always read the freshest copy of state inside the auto-recopy effect.
  const stateRef = useRef(state)
  stateRef.current = state

  // Always read the freshest props inside the auto-recopy effect.
  const propsRef = useRef(props)
  propsRef.current = props

  /**
   * Build the clipboard payload from currently-visible insights.
   *
   * Per V1 signal: every always-rendered field (observation,
   * consequence, steering, alternate_wording, perceptual_compression),
   * plus any depth fields the user has actually expanded. Skipped
   * depth fields are NOT included — the payload reflects exactly the
   * depth the user explored.
   *
   * If the V2 reveal is open, the notice body is appended as a final
   * paragraph. Plain prose, blank-line paragraph separators, no
   * labels, no chrome.
   */
  function buildCopyText(): string {
    const liveState = stateRef.current
    const liveProps = propsRef.current
    const revealedBySignal = liveProps.revealedBySignal ?? {}
    const parts: string[] = []

    liveProps.signals.forEach((s, i) => {
      const lines: string[] = []
      if (s.observation?.trim()) lines.push(s.observation.trim())
      if (s.consequence?.trim()) lines.push(s.consequence.trim())
      if (s.steering?.trim()) lines.push(s.steering.trim())
      if (s.alternate_wording?.trim()) lines.push(s.alternate_wording.trim())
      if (s.perceptual_compression?.trim())
        lines.push(s.perceptual_compression.trim())

      const expanded = revealedBySignal[i]
      if (expanded && expanded.size > 0) {
        for (const key of DEPTH_KEYS) {
          if (!expanded.has(key)) continue
          const text = s[key]
          if (typeof text === "string" && text.trim().length > 0) {
            lines.push(text.trim())
          }
        }
      }

      if (lines.length > 0) parts.push(lines.join(" "))
    })

    if (liveState.kind === "revealed" && liveState.body) {
      parts.push(liveState.body.trim())
    }

    return parts.join("\n\n")
  }

  async function writeToClipboard(): Promise<boolean> {
    const text = buildCopyText()
    if (!text) return false
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  async function copyInsights() {
    if (copied) return
    const ok = await writeToClipboard()
    if (!ok) return
    hasCopiedOnceRef.current = true
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  // Auto-recopy: when the V2 reveal arrives AND the user has already
  // copied once, rewrite the clipboard to include the new notice.
  useEffect(() => {
    const prev = prevStateKindRef.current
    const next = state.kind
    prevStateKindRef.current = next

    if (
      prev !== "revealed" &&
      next === "revealed" &&
      hasCopiedOnceRef.current
    ) {
      void (async () => {
        const ok = await writeToClipboard()
        if (ok) {
          setCopied(true)
          setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind])

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

  const showCue = state.kind !== "quiet"
  const asking = state.kind === "asking"

  return (
    <div className="mt-4 animate-reveal" style={{ animationDelay: "300ms" }}>
      {showCue && (
        <button
          type="button"
          onClick={copyInsights}
          aria-label="Carry these insights back into the conversation"
          className="block font-serif italic text-[12px] text-ink-dimmed hover:opacity-80 transition-opacity duration-300 text-left"
          style={{ opacity: 0.5, lineHeight: "1.55" }}
        >
          {copied ? COPIED_LABEL : CONTINUATION_CUE}
        </button>
      )}

      {(state.kind === "idle" || state.kind === "asking") && (
        <div style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            onClick={go}
            disabled={asking}
            aria-label="Lenss noticed one more thing"
            className={
              asking
                ? "font-serif italic text-[14px] text-ink-dimmed/70 animate-breathe cursor-default"
                : "font-serif italic text-[14px] text-ink-dimmed hover:text-ink hover:underline hover:decoration-dotted hover:underline-offset-4 transition-colors duration-300"
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
