"use client"

import { Button } from "@/components/ui/button"
import { SaveButton } from "./SaveButton"
import { SignalBlock } from "./SignalBlock"
import { LoadingPhrase } from "./LoadingPhrase"
import { saveSelf } from "@/lib/storage"
import type { SelfReadingResult } from "@/lib/types"
import type { DepthKey } from "@/lib/useDepthSelection"

export function SelfResultView({
  source,
  result,
  onReset,
  streaming = false,
  revealedBySignal,
  onDepthToggle,
}: {
  source: string
  result: SelfReadingResult
  onReset: () => void
  streaming?: boolean
  revealedBySignal?: Record<number, Set<DepthKey>>
  onDepthToggle?: (signalIndex: number, key: DepthKey) => void
}) {
  return (
    <div>
      <section
        className="animate-reveal"
        data-clarity-mask="True"
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

      <div className="space-y-12">
        {result.signals.map((s, i) => (
          <div key={i}>
            {i > 0 && (
              <hr className="mb-12 border-0 border-t border-divider" />
            )}
            <SignalBlock
              signal={s}
              delayMs={0}
              revealed={revealedBySignal?.[i]}
              onToggle={
                onDepthToggle ? (key) => onDepthToggle(i, key) : undefined
              }
            />
          </div>
        ))}
      </div>

      {streaming && (
        <div className="mt-12">
          <LoadingPhrase initial="Still reading" />
        </div>
      )}

      {!streaming && (
        <div className="mt-16 flex flex-wrap justify-center items-center gap-x-8 gap-y-3 animate-reveal">
          <SaveButton onSave={() => saveSelf(source, result)} />
          <Button variant="ghost" size="link" onClick={onReset}>
            Another
          </Button>
        </div>
      )}
    </div>
  )
}
