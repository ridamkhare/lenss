"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

/**
 * Quiet save affordance. One click → saves to local archive → shows
 * "Saved" inline confirmation that fades to "Saved · in your archive"
 * with a small link. No undo button — delete from the archive page.
 */
export function SaveButton({
  onSave,
  label = "Save",
}: {
  onSave: () => void
  label?: string
}) {
  const [state, setState] = useState<"idle" | "saved">("idle")

  function handle() {
    if (state === "saved") return
    onSave()
    setState("saved")
  }

  if (state === "saved") {
    return (
      <span className="font-sans text-[12px] text-ink-dimmed">
        Saved ·{" "}
        <a
          href="/archive"
          className="text-accent hover:text-accent-hover transition-colors duration-200"
        >
          in your archive
        </a>
      </span>
    )
  }

  return (
    <Button variant="ghost" size="link" onClick={handle}>
      {label}
    </Button>
  )
}
