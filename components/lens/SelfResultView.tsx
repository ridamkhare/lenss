"use client"

import { Button } from "@/components/ui/button"
import { SaveButton } from "./SaveButton"
import { SignalBlock } from "./SignalBlock"
import { saveSelf } from "@/lib/storage"
import type { SelfReadingResult } from "@/lib/types"

export function SelfResultView({
  source,
  result,
  onReset,
}: {
  source: string
  result: SelfReadingResult
  onReset: () => void
}) {
  const lastDelay = 260 + result.signals.length * 220

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
            <SignalBlock signal={s} delayMs={260 + i * 220} />
          </div>
        ))}
      </div>

      <div
        className="mt-16 flex flex-wrap justify-center items-center gap-x-8 gap-y-3 animate-reveal"
        style={{ animationDelay: `${lastDelay + 600}ms` }}
      >
        <SaveButton onSave={() => saveSelf(source, result)} />
        <Button variant="ghost" size="link" onClick={onReset}>
          Another
        </Button>
      </div>
    </div>
  )
}
