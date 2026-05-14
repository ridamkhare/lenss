"use client"

import { Button } from "@/components/ui/button"
import { SaveButton } from "./SaveButton"
import { SignalBlock } from "./SignalBlock"
import { saveCompare } from "@/lib/storage"
import type { CompareResult } from "@/lib/types"

export function CompareResultView({
  sourceA,
  sourceB,
  result,
  onReset,
  streaming = false,
}: {
  sourceA: string
  sourceB: string
  result: CompareResult
  onReset: () => void
  streaming?: boolean
}) {
  return (
    <div>
      <div className="space-y-12">
        {result.signals.map((s, i) => (
          <div key={i}>
            {i > 0 && (
              <hr className="mb-12 border-0 border-t border-divider" />
            )}
            <SignalBlock signal={s} delayMs={0} />
          </div>
        ))}
      </div>

      {streaming && (
        <div className="mt-12">
          <span className="font-sans text-[12px] text-ink-dimmed animate-breathe">
            Still reading
          </span>
        </div>
      )}

      {!streaming && (
        <div className="mt-16 flex flex-wrap justify-center items-center gap-x-8 gap-y-3 animate-reveal">
          <SaveButton onSave={() => saveCompare(sourceA, sourceB, result)} />
          <Button variant="ghost" size="link" onClick={onReset}>
            Another
          </Button>
        </div>
      )}
    </div>
  )
}
