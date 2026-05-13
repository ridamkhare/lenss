"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * Tiny three-link nav. Compare is the homepage and the primary mode;
 * reveal and yours are secondary.
 */
export function ModeNav() {
  const pathname = usePathname() || "/"
  const onReveal = pathname.startsWith("/reveal")
  const onYours = pathname.startsWith("/yours")
  const onCompare = !onReveal && !onYours

  return (
    <nav
      className="font-sans text-[12px] tracking-[0.04em] lowercase"
      aria-label="mode"
    >
      <Link
        href="/"
        className={cn(
          "transition-colors duration-200",
          onCompare ? "text-ink" : "text-ink-dimmed hover:text-ink"
        )}
      >
        compare
      </Link>
      <span className="text-ink-dimmed mx-2" aria-hidden>
        ·
      </span>
      <Link
        href="/reveal"
        className={cn(
          "transition-colors duration-200",
          onReveal ? "text-ink" : "text-ink-dimmed hover:text-ink"
        )}
      >
        reveal
      </Link>
      <span className="text-ink-dimmed mx-2" aria-hidden>
        ·
      </span>
      <Link
        href="/yours"
        className={cn(
          "transition-colors duration-200",
          onYours ? "text-ink" : "text-ink-dimmed hover:text-ink"
        )}
      >
        yours
      </Link>
    </nav>
  )
}
