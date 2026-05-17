"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SignalBlock } from "@/components/lens/SignalBlock"
import { saveReveal } from "@/lib/storage"
import type { RevealResult } from "@/lib/types"
import { V2SaveButton } from "./V2SaveButton"
import { NoticedMore } from "./NoticedMore"
import { saveV2Notice } from "@/v2/lib/v2Storage"
import { isNoticeDeclined } from "@/v2/lib/noticeTypes"
import type { NoticeResponse } from "@/v2/lib/noticeTypes"

/**
 * V2 result view for reveal mode.
 *
 * Mirrors V1's ResultView structurally (same source / signals / Save
 * / Another layout) but owns the Save click so it can write the V2
 * notice into the V2 sidecar alongside V1's normal save.
 *
 * V1 components reused read-only: Button, SignalBlock, saveReveal,
 * RevealResult. V1 source files are not modified.
 */
export function V2ResultView({
  source,
  result,
  onReset,
}: {
  source: string
  result: RevealResult
  onReset: () => void
}) {
  const [notice, setNotice] = useState<NoticeResponse | null>(null)
  const lastDelay = 260 + result.signals.length * 220

  function handleSave() {
    const item = saveReveal(source, result)
    if (notice && !isNoticeDeclined(notice)) {
      saveV2Notice({
        v1ItemId: item.id,
        mode: "reveal",
        notice: notice.notice,
        anchor: notice.anchor,
      })
    }
  }

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
        <V2SaveButton onSave={handleSave} />
        <Button variant="ghost" size="link" onClick={onReset}>
          Another
        </Button>
      </div>

      <NoticedMore
        mode="reveal"
        source={source}
        v1Observations={result.signals.map((s) => s.observation)}
        onResultChange={setNotice}
      />
    </div>
  )
}
