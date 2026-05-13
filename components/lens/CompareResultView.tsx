"use client"

import { ReadingPanel } from "./ReadingPanel"
import { Button } from "@/components/ui/button"
import { SaveButton } from "./SaveButton"
import { saveCompare } from "@/lib/storage"
import type { CompareResult } from "@/lib/types"

export function CompareResultView({
  sourceA,
  sourceB,
  result,
  onReset,
}: {
  sourceA: string
  sourceB: string
  result: CompareResult
  onReset: () => void
}) {
  return (
    <div>
      <section
        className="animate-reveal"
        style={{ animationDuration: "500ms" }}
      >
        <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
          the question both responses answered
        </p>
        <p className="font-serif italic text-[18px] leading-[1.55] text-ink-dimmed">
          {result.shared_question}
        </p>
      </section>

      <p
        className="mt-12 font-serif text-[15px] text-ink animate-reveal"
        style={{ animationDelay: "260ms" }}
      >
        Same question. Two shapes.
      </p>

      <hr
        className="my-10 border-0 border-t border-divider animate-reveal"
        style={{ animationDelay: "360ms" }}
      />

      <div className="grid gap-12 sm:gap-10 sm:grid-cols-2">
        <ReadingPanel reading={result.left} delayMs={500} />
        <ReadingPanel reading={result.right} delayMs={500} />
      </div>

      <div
        className="mt-20 flex flex-wrap justify-center items-center gap-x-8 gap-y-3 animate-reveal"
        style={{ animationDelay: "1300ms" }}
      >
        <SaveButton onSave={() => saveCompare(sourceA, sourceB, result)} />
        <Button variant="ghost" size="link" onClick={onReset}>
          Compare another pair
        </Button>
      </div>
    </div>
  )
}
