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
import { SignalBlock } from "./SignalBlock"

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

/** A result is in the new shape if it has a `signals` array. */
function hasSignals(result: unknown): result is { signals: unknown[] } {
  return (
    !!result &&
    typeof result === "object" &&
    "signals" in (result as Record<string, unknown>) &&
    Array.isArray((result as Record<string, unknown>).signals)
  )
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

  if (items === null) return null

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
  // Legacy items saved before the signal refactor: render minimally
  // with a small note. The user can delete to clean up.
  if (!hasSignals(item.result)) {
    return (
      <div>
        {item.mode === "compare" ? (
          <>
            <p className="font-serif text-[14px] leading-[1.55] text-ink-dimmed mb-3 whitespace-pre-wrap">
              {item.sourceA}
            </p>
            <p className="font-sans text-[10px] text-ink-dimmed mb-3">— vs —</p>
            <p className="font-serif text-[14px] leading-[1.55] text-ink-dimmed mb-6 whitespace-pre-wrap">
              {item.sourceB}
            </p>
          </>
        ) : (
          <p className="font-serif text-[14px] leading-[1.55] text-ink-dimmed mb-6 whitespace-pre-wrap">
            {item.source}
          </p>
        )}
        <p className="font-sans text-[11px] text-ink-dimmed italic">
          Saved in an earlier reading format. Re-read this passage in
          today's lens to update.
        </p>
      </div>
    )
  }

  const signals = item.result.signals

  if (item.mode === "compare") {
    return (
      <div>
        <p className="font-serif text-[13px] leading-[1.55] text-ink-dimmed mb-6 whitespace-pre-wrap">
          A: {item.sourceA.slice(0, 200)}
          {item.sourceA.length > 200 ? "…" : ""}
        </p>
        <p className="font-serif text-[13px] leading-[1.55] text-ink-dimmed mb-8 whitespace-pre-wrap">
          B: {item.sourceB.slice(0, 200)}
          {item.sourceB.length > 200 ? "…" : ""}
        </p>
        <div className="space-y-10">
          {signals.map((s, i) => (
            <SignalBlock key={i} signal={s} delayMs={0} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="font-serif text-[13px] leading-[1.55] text-ink-dimmed mb-8 whitespace-pre-wrap">
        {item.source}
      </p>
      <div className="space-y-10">
        {signals.map((s, i) => (
          <SignalBlock key={i} signal={s} delayMs={0} />
        ))}
      </div>
    </div>
  )
}
