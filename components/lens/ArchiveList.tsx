"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  deleteItem,
  listItems,
  setComparePrefill,
  type SavedItem,
} from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { DimensionBlock } from "./DimensionBlock"
import { ReadingPanel } from "./ReadingPanel"

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = now - then
  const day = 86400_000
  if (diffMs < 60_000) return "just now"
  if (diffMs < day) {
    const h = Math.floor(diffMs / 3_600_000)
    if (h === 0) {
      const m = Math.floor(diffMs / 60_000)
      return `${m} min ago`
    }
    return `${h}h ago`
  }
  if (diffMs < 7 * day) {
    return `${Math.floor(diffMs / day)}d ago`
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function modeLabel(mode: SavedItem["mode"]): string {
  if (mode === "reveal") return "reveal"
  if (mode === "compare") return "compare"
  return "yours"
}

function sourceSnippet(item: SavedItem, max = 80): string {
  const text = item.mode === "compare" ? item.sourceA : item.source
  const trimmed = text.replace(/\s+/g, " ").trim()
  return trimmed.length > max ? trimmed.slice(0, max) + "…" : trimmed
}

export function ArchiveList() {
  const router = useRouter()
  const [items, setItems] = useState<SavedItem[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setItems(listItems())
  }, [])

  function handleDelete(id: string) {
    deleteItem(id)
    setItems((prev) => (prev ? prev.filter((i) => i.id !== id) : prev))
    if (expanded === id) setExpanded(null)
  }

  function handleCompareWith(item: SavedItem) {
    const text = item.mode === "compare" ? item.sourceA : item.source
    setComparePrefill(text)
    router.push("/")
  }

  if (items === null) {
    return null
  }

  if (items.length === 0) {
    return (
      <p className="font-serif text-[17px] leading-[1.6] text-ink-dimmed">
        Nothing saved here yet. When you save a reading, it appears here —
        and nowhere else.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-divider">
      {items.map((item) => {
        const isOpen = expanded === item.id
        return (
          <li key={item.id} className="py-7">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : item.id)}
              className="block w-full text-left"
            >
              <div className="flex items-baseline justify-between gap-4 mb-2">
                <span className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed">
                  {modeLabel(item.mode)}
                </span>
                <span className="font-sans text-[11px] text-ink-dimmed">
                  {relativeDate(item.createdAt)}
                </span>
              </div>
              <p className="font-serif text-[16px] leading-[1.5] text-ink">
                {sourceSnippet(item)}
              </p>
            </button>

            {isOpen && (
              <div className="mt-8 pl-5 border-l border-divider animate-reveal">
                <ItemBody item={item} />

                <div className="mt-8 flex items-center gap-6">
                  {item.mode !== "compare" && (
                    <Button
                      variant="ghost"
                      size="link"
                      onClick={() => handleCompareWith(item)}
                    >
                      Compare with another
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="link"
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ItemBody({ item }: { item: SavedItem }) {
  if (item.mode === "reveal") {
    return (
      <div>
        <p className="font-serif text-[14px] leading-[1.55] text-ink-dimmed mb-8 whitespace-pre-wrap">
          {item.source}
        </p>
        <div>
          <DimensionBlock
            label="Dominant Framing"
            body={item.result.dominant_framing}
            delayMs={0}
          />
          <DimensionBlock
            label="Hidden Assumptions"
            body={item.result.hidden_assumptions}
            delayMs={0}
          />
          <DimensionBlock
            label="Suppressed Alternatives"
            body={item.result.suppressed_alternatives}
            delayMs={0}
          />
          <DimensionBlock
            label="Semantic Gravity"
            body={item.result.semantic_gravity}
            delayMs={0}
          />
          <DimensionBlock
            label="Alternate Framing"
            body={item.result.alternate_framing}
            delayMs={0}
            emphasized
          />
        </div>
      </div>
    )
  }

  if (item.mode === "compare") {
    return (
      <div>
        <p className="font-sans text-[10px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
          the question both responses answered
        </p>
        <p className="font-serif italic text-[16px] leading-[1.55] text-ink-dimmed mb-8">
          {item.result.shared_question}
        </p>
        <div className="grid gap-10 sm:gap-8 sm:grid-cols-2">
          <ReadingPanel reading={item.result.left} delayMs={0} />
          <ReadingPanel reading={item.result.right} delayMs={0} />
        </div>
      </div>
    )
  }

  // self
  return (
    <div>
      <p className="font-serif text-[14px] leading-[1.55] text-ink-dimmed mb-8 whitespace-pre-wrap">
        {item.source}
      </p>
      <p className="font-serif text-[16px] leading-[1.65] text-ink mb-6">
        {item.result.noticing}
      </p>
      <p className="font-serif italic text-[18px] leading-[1.45] text-ink sm:pl-6">
        {item.result.question}
      </p>
    </div>
  )
}
