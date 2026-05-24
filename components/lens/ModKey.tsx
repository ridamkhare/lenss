"use client"

import { useEffect, useState } from "react"

/**
 * Renders the platform-appropriate modifier-key symbol inside a <kbd>:
 * ⌘ on Mac/iOS, Ctrl on Windows/Linux/Android. The keyboard handler
 * accepts both metaKey and ctrlKey, so the actual shortcut works
 * everywhere — this just makes the displayed label honest.
 *
 * Defaults to ⌘ on first render (Mac is the dominant audience), then
 * swaps to Ctrl on mount if a non-Mac platform is detected. The brief
 * flash on non-Mac users is acceptable and avoids hydration mismatch.
 */
export function ModKey() {
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    if (typeof navigator === "undefined") return
    const probe = `${navigator.userAgent} ${navigator.platform ?? ""}`
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(probe))
  }, [])

  return <kbd className="font-sans">{isMac ? "⌘" : "Ctrl"}</kbd>
}
