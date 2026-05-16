"use client"

import { useState } from "react"
import { requestDeeper, type DeeperRequestBody } from "@/lib/deeperClient"
import type { Signal } from "@/lib/types"

/**
 * V2 — ONE optional deeper interaction layer surfaced after the existing
 * response has finished rendering. Strictly additive:
 *
 *   - Renders only when the main response is "shown" (caller decides).
 *   - Disabled when NEXT_PUBLIC_LENS_DEEPER === "false" (compile-time
 *     client kill). Server-side kill is LENS_DISABLE_DEEPER on the API.
 *   - One subtle affordance, one fade-in reveal, no loaders, no labels.
 *
 * The affordance must visually recede. The deeper line, when revealed,
 * must inherit the same emotional tone as the main response.
 */

const AFFORDANCE_OPTIONS = [
  "Another angle",
  "Go deeper",
  "Another reading",
  "Different trajectory",
] as const

type AffordanceLabel = (typeof AFFORDANCE_OPTIONS)[number]

type Props =
  | {
      mode: "read" | "yours"
      source: string
      signals: Signal[]
      affordance?: AffordanceLabel
    }
  | {
      mode: "compare"
      sourceA: string
      sourceB: string
      signals: Signal[]
      affordance?: AffordanceLabel
    }

type State =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "revealed"; body: string }
  | { kind: "quiet"; reason: string }

export function DeeperLayer(props: Props) {
  const enabled = process.env.NEXT_PUBLIC_LENS_DEEPER !== "false"
  const [state, setState] = useState<State>({ kind: "idle" })

  if (!enabled) return null

  async function go() {
    if (state.kind === "asking" || state.kind === "revealed") return
    setState({ kind: "asking" })

    const body: DeeperRequestBody =
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

    const r = await requestDeeper(body)
    if (r.kind === "deeper") {
      setState({ kind: "revealed", body: r.body })
    } else if (r.kind === "declined") {
      setState({ kind: "quiet", reason: r.reason })
    } else {
      // Error: stay silent. The affordance simply disappears.
      setState({ kind: "quiet", reason: "" })
    }
  }

  const label = props.affordance || "Another angle"

  if (state.kind === "revealed") {
    return (
      <div
        className="mt-12 animate-reveal"
        style={{ animationDuration: "700ms" }}
        data-clarity-mask="True"
      >
        <p className="font-serif text-[15px] leading-[1.65] text-ink-dimmed">
          {state.body}
        </p>
      </div>
    )
  }

  if (state.kind === "quiet") {
    if (!state.reason) return null
    return (
      <div
        className="mt-12 animate-reveal"
        style={{ animationDuration: "700ms" }}
      >
        <p className="font-serif text-[14px] leading-[1.6] text-ink-dimmed/80">
          {state.reason}
        </p>
      </div>
    )
  }

  const asking = state.kind === "asking"

  return (
    <div className="mt-12">
      <button
        type="button"
        onClick={go}
        disabled={asking}
        aria-label={label}
        className={
          asking
            ? "font-sans text-[12px] tracking-label text-ink-dimmed/70 animate-breathe cursor-default"
            : "font-sans text-[12px] tracking-label text-ink-dimmed/70 hover:text-ink-dimmed transition-colors duration-200"
        }
      >
        {label}
      </button>
    </div>
  )
}
