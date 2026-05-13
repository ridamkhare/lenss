"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function ModeNav() {
  const pathname = usePathname() || "/"
  const onCompare = pathname.startsWith("/compare")
  const onYours = pathname.startsWith("/yours")
  const onRead = !onCompare && !onYours

  return (
    <nav
      className="font-sans text-[12px] tracking-[0.04em] lowercase"
      aria-label="mode"
    >
      <Link
        href="/"
        className={cn(
          "transition-colors duration-200",
          onRead ? "text-ink" : "text-ink-dimmed hover:text-ink"
        )}
      >
        read
      </Link>
      <span className="text-ink-dimmed mx-2" aria-hidden>
        ·
      </span>
      <Link
        href="/compare"
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
