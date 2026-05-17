"use client"

import { useState } from "react"
import { requestNotice, type NoticeRequestBody } from "@/lib/noticeClient"
import type { Signal } from "@/lib/types"

/**
 * V2 — Lenss noticed one more thing.
 *
 * A single optional affordance surfaced after the main response has
 * finished rendering. Strictly additive:
 *
 *   - Renders only when the main response is "shown" (caller decides).
 *   - Disabled when NEXT_PUBLIC_LENS_NOTICE === "false" (compile-time
 *     client kill). Server-side kill is LENS_DISABLE_NOTICE on the API.
 *   - One fixed affordance line, one fade-in reveal, no loaders.
 *
 * The affordance reads "Lenss noticed one more thing — show" and lives
 * in the quiet space below the main response. On click, the V2 endpoint
 * returns one grounded line — a single interaction dynamic the main
 * response did not surface — or declines.
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

export function NoticedMore(props: Props) {
  const enabled = process.env.NEXT_PUBLIC_LENS_NOTICE !== "false"
  const [state, setState] = useState<State>({ kind: "idle" })

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

  if (state.kind === "revealed") {
    return (
      <div
        className="mt-12 animate-reveal text-center mx-auto"
        style={{
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
    )
  }

  if (state.kind === "quiet") {
    if (!state.reason) return null
    return (
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
    )
  }

  const asking = state.kind === "asking"

  return (
    <div className="mt-12 text-center">
      <button
        type="button"
        onClick={go}
        disabled={asking}
        aria-label="Lenss noticed one more thing"
        className={
          asking
            ? "font-sans text-[12px] tracking-label text-ink-dimmed/70 animate-breathe cursor-default"
            : "font-sans text-[12px] tracking-label text-ink-dimmed/70 hover:text-ink-dimmed transition-colors duration-300"
        }
        style={{ opacity: 0.75 }}
      >
        Lenss noticed one more thing — show
      </button>
    </div>
  )
}
