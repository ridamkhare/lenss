"use client"

import { useState } from "react"

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
      <span className="font-sans text-[11px] text-ink-dimmed">
        Saved ·{" "}
        <a
          href="/archive"
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
