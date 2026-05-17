"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { V2ArchiveList } from "@/v2/components/lens/V2ArchiveList"
import { Footer } from "@/components/lens/Footer"
import { ModeNav } from "@/components/lens/ModeNav"
import { clearArchive, listItems } from "@/lib/storage"
import { clearV2Archive } from "@/v2/lib/v2Storage"

/**
 * V2 archive page. Reads V1's storage + V2 sidecar storage and
 * renders each saved item with its attached V2 notice (if any).
 *
 * "Clear everything" clears both V1's archive and V2's sidecar.
 */
export default function V2ArchivePage() {
  const [version, setVersion] = useState(0)
  const [hasItems, setHasItems] = useState<boolean | null>(null)

  useEffect(() => {
    setHasItems(listItems().length > 0)
  }, [version])

  function handleClearAll() {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        "Delete every saved reading? This can't be undone."
      )
    ) {
      clearArchive()
      clearV2Archive()
      setVersion((v) => v + 1)
    }
  }

  return (
    <main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
      <header className="mb-16 sm:mb-20 flex items-center justify-between">
        <Link
          href="/v2"
          className="font-sans text-[14px] font-medium tracking-wordmark text-ink lowercase hover:text-ink-dimmed transition-colors duration-200"
        >
          lenss
        </Link>
        <ModeNav />
      </header>

      <div className="mb-12">
        <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
          archive
        </p>
        <p className="font-serif text-[17px] leading-[1.55] text-ink-dimmed">
          Saved readings live on this device only.
        </p>
      </div>

      <V2ArchiveList key={version} />

      {hasItems && (
        <div className="mt-16">
          <button
            type="button"
            onClick={handleClearAll}
            className="font-sans text-[11px] text-ink-dimmed hover:text-ink transition-colors duration-200"
          >
            Clear everything
          </button>
        </div>
      )}

      <Footer />
    </main>
  )
}
