"use client"

import { Button } from "@/components/ui/button"
import { SaveButton } from "./SaveButton"
import { saveSelf } from "@/lib/storage"
import type { SelfReadingResult } from "@/lib/types"

/**
 * Self-mode result view. Reads like a letter back: source dimmed at top,
 * the noticing as one paragraph in regular ink, generous breathing room,
 * then the open question in italic — slightly indented so the eye lands
 * on it as the closing note. No labels above sections; this is meant to
 * feel like reading, not analysis.
 */
export function SelfResultView({
  source,
  result,
  onReset,
}: {
  source: string
  result: SelfReadingResult
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

      <section
        className="animate-reveal"
        style={{ animationDelay: "260ms", animationDuration: "560ms" }}
      >
        <p className="font-serif text-[18px] leading-[1.7] text-ink">
          {result.noticing}
        </p>
      </section>

      <section
        className="mt-14 animate-reveal sm:pl-8"
        style={{ animationDelay: "640ms", animationDuration: "620ms" }}
      >
        <p className="font-serif italic text-[20px] leading-[1.45] text-ink">
          {result.question}
        </p>
      </section>

      <div
        className="mt-20 flex flex-wrap justify-center items-center gap-x-8 gap-y-3 animate-reveal"
        style={{ animationDelay: "1300ms" }}
      >
        <SaveButton onSave={() => saveSelf(source, result)} />
        <Button variant="ghost" size="link" onClick={onReset}>
          Read another
        </Button>
      </div>

      <p
        className="mt-12 text-center font-sans text-[11px] text-ink-dimmed animate-reveal"
        style={{ animationDelay: "1500ms" }}
      >
        Come back when you write something next.
      </p>
    </div>
  )
}
