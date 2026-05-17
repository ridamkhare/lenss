"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SignalBlock } from "@/components/lens/SignalBlock"
import { saveCompare } from "@/lib/storage"
import type { CompareResult } from "@/lib/types"
import { V2SaveButton } from "./V2SaveButton"
import { NoticedMore } from "./NoticedMore"
import { saveV2Notice } from "@/v2/lib/v2Storage"
import { isNoticeDeclined } from "@/v2/lib/noticeTypes"
import type { NoticeResponse } from "@/v2/lib/noticeTypes"

export function V2CompareResultView({
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
  const [notice, setNotice] = useState<NoticeResponse | null>(null)
  const lastDelay = result.signals.length * 220

  function handleSave() {
    const item = saveCompare(sourceA, sourceB, result)
    if (notice && !isNoticeDeclined(notice)) {
      saveV2Notice({
        v1ItemId: item.id,
        mode: "compare",
        notice: notice.notice,
        anchor: notice.anchor,
      })
    }
  }

  return (
    <div>
      <div className="space-y-12">
        {result.signals.map((s, i) => (
          <div key={i}>
            {i > 0 && (
              <hr className="mb-12 border-0 border-t border-divider" />
            )}
            <SignalBlock signal={s} delayMs={i * 220} />
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
        mode="compare"
        source={sourceA}
        sourceB={sourceB}
        v1Observations={result.signals.map((s) => s.observation)}
        onResultChange={setNotice}
      />
    </div>
  )
}
