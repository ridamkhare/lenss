"use client"

import { DimensionBlock } from "./DimensionBlock"
import { Button } from "@/components/ui/button"
import { SaveButton } from "./SaveButton"
import { saveReveal } from "@/lib/storage"
import type { RevealResult, DimensionKey } from "@/lib/types"

const DIMENSIONS: { key: DimensionKey; label: string }[] = [
  { key: "dominant_framing", label: "Dominant Framing" },
  { key: "hidden_assumptions", label: "Hidden Assumptions" },
  { key: "suppressed_alternatives", label: "Suppressed Alternatives" },
  { key: "semantic_gravity", label: "Semantic Gravity" },
  { key: "alternate_framing", label: "Alternate Framing" },
]

export function ResultView({
  source,
  result,
  onReset,
}: {
  source: string
  result: RevealResult
  onReset: () => void
}) {
  return (
    <div>
      <section
        className="animate-reveal"
        style={{ animationDuration: "500ms" }}
      >
        <p className="font-serif text-[15px] leading-[1.6] text-ink-dimmed whitespace-pre-wrap">
          {source}
        </p>
      </section>

      <hr
        className="my-12 border-0 border-t border-divider animate-reveal"
        style={{ animationDelay: "120ms" }}
      />

      <div>
        {DIMENSIONS.map((d, i) => (
          <DimensionBlock
            key={d.key}
            label={d.label}
            body={result[d.key]}
            delayMs={240 + i * 160}
            emphasized={d.key === "alternate_framing"}
          />
        ))}
      </div>

      <div
        className="mt-16 flex flex-wrap justify-center items-center gap-x-8 gap-y-3 animate-reveal"
        style={{ animationDelay: "1300ms" }}
      >
        <SaveButton onSave={() => saveReveal(source, result)} />
        <Button variant="ghost" size="link" onClick={onReset}>
          Reveal another
        </Button>
      </div>
    </div>
  )
}
