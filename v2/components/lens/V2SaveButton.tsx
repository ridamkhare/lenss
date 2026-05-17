"use client"

import { useState } from "react"

/**
 * V2 SaveButton — same visual register as V1's SaveButton, but the
 * "in your archive" link points to /v2/archive (which renders V1
 * readings with their V2 notices attached). V1's SaveButton hard-
 * codes /archive, so V2 needs its own variant.
 */
export function V2SaveButton({
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
      <span className="font-sans text-[11px] text-ink-dimmed">
        Saved ·{" "}
        <a
          href="/v2/archive"
          className="hover:text-ink transition-colors duration-200"
        >
          in your archive
        </a>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handle}
      className="font-sans text-[11px] text-ink-dimmed hover:text-ink transition-colors duration-200"
    >
      {label}
    </button>
  )
}
