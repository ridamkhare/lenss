"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArchiveList } from "@/components/lens/ArchiveList"
import { Footer } from "@/components/lens/Footer"
import { ModeNav } from "@/components/lens/ModeNav"
import { clearArchive, listItems } from "@/lib/storage"

export default function ArchivePage() {
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
      setVersion((v) => v + 1)
    }
  }

  return (
    <main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
      <header className="mb-16 sm:mb-20 flex items-center justify-between">
        <Link
          href="/"
          className="font-sans text-[14px] font-medium tracking-wordmark text-ink lowercase hover:text-ink-dimmed transition-colors duration-200"
        >
          lens
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

      <ArchiveList key={version} />

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
