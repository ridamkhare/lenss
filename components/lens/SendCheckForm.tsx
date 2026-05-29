"use client"

import { useState, useRef, useEffect } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  PREDEFINED_ARCHETYPES,
  type RecipientArchetype,
  type RecipientInput,
} from "@/lib/types"

type Props = {
  onSubmit: (input: {
    subject: string
    body: string
    recipients: RecipientInput[]
  }) => void
  busy: boolean
}

const MAX_RECIPIENTS = 4
const ARCHETYPE_RE = /^[a-zA-Z][a-zA-Z0-9 \-']{0,29}$/

function normalizeArchetype(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, " ")
  return ARCHETYPE_RE.test(trimmed) ? trimmed : null
}

export function SendCheckForm({ onSubmit, busy }: Props) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [selected, setSelected] = useState<RecipientArchetype[]>([])
  const [contexts, setContexts] = useState<Record<string, string>>({})
  // Custom archetypes the user has typed in this session — surfaced as chips
  // alongside the predefined ones so they can be re-toggled after deselecting.
  const [customChips, setCustomChips] = useState<string[]>([])
  const [customInputVisible, setCustomInputVisible] = useState(false)
  const [customInput, setCustomInput] = useState("")
  const [customError, setCustomError] = useState<string | null>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (customInputVisible) customInputRef.current?.focus()
  }, [customInputVisible])

  function toggle(archetype: RecipientArchetype) {
    if (busy) return
    setSelected((prev) => {
      if (prev.includes(archetype)) {
        return prev.filter((a) => a !== archetype)
      }
      if (prev.length >= MAX_RECIPIENTS) return prev
      return [...prev, archetype]
    })
  }

  function commitCustom() {
    const normalized = normalizeArchetype(customInput)
    if (!normalized) {
      if (customInput.trim().length > 0) {
        setCustomError("Letters, numbers, spaces, hyphens — 1 to 30 chars.")
      }
      return
    }
    // Already exists (predefined or previously-added custom)
    const allKnown = [...PREDEFINED_ARCHETYPES, ...customChips]
    if (!allKnown.includes(normalized)) {
      setCustomChips((prev) => [...prev, normalized])
    }
    setSelected((prev) => {
      if (prev.includes(normalized)) return prev
      if (prev.length >= MAX_RECIPIENTS) return prev
      return [...prev, normalized]
    })
    setCustomInput("")
    setCustomError(null)
    setCustomInputVisible(false)
  }

  function cancelCustom() {
    setCustomInput("")
    setCustomError(null)
    setCustomInputVisible(false)
  }

  function setContext(archetype: RecipientArchetype, val: string) {
    setContexts((prev) => ({ ...prev, [archetype]: val }))
  }

  const canSubmit =
    !busy &&
    subject.trim().length >= 3 &&
    body.trim().length >= 30 &&
    selected.length >= 1

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const recipients: RecipientInput[] = selected.map((a) => ({
      archetype: a,
      context: contexts[a]?.trim() || null,
    }))
    onSubmit({ subject: subject.trim(), body: body.trim(), recipients })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <label className="block font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
          subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What you'd put in the subject line."
          disabled={busy}
          maxLength={200}
          data-clarity-mask="True"
          className="w-full rounded-md border border-divider bg-paper px-6 py-4 font-serif text-[17px] leading-[1.4] text-ink placeholder:text-ink-dimmed/70 transition-colors duration-200 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60"
        />
      </div>

      <div>
        <label className="block font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
          body
        </label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste the email you're about to send."
          disabled={busy}
          rows={10}
          maxLength={4000}
        />
      </div>

      <div>
        <label className="block font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
          who's reading this? <span className="text-ink-dimmed/60 normal-case font-normal tracking-normal">— pick up to {MAX_RECIPIENTS}</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {[...PREDEFINED_ARCHETYPES, ...customChips].map((value) => {
            const isOn = selected.includes(value)
            const disabled =
              busy || (!isOn && selected.length >= MAX_RECIPIENTS)
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggle(value)}
                disabled={disabled}
                className={`px-4 py-2 rounded-full border text-[13px] font-sans transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isOn
                    ? "border-ink bg-ink text-paper"
                    : "border-divider bg-paper text-ink-dimmed hover:text-ink hover:border-ink-dimmed"
                }`}
              >
                {value}
              </button>
            )
          })}

          {customInputVisible ? (
            <div className="inline-flex items-center gap-2">
              <input
                ref={customInputRef}
                type="text"
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value)
                  if (customError) setCustomError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    commitCustom()
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    cancelCustom()
                  }
                }}
                onBlur={() => {
                  if (customInput.trim().length === 0) cancelCustom()
                }}
                placeholder="co-founder, ex-partner, advisor…"
                maxLength={30}
                disabled={busy || selected.length >= MAX_RECIPIENTS}
                className="px-4 py-2 rounded-full border border-ink-dimmed bg-paper text-[13px] font-sans text-ink placeholder:text-ink-dimmed/60 focus:outline-none focus:ring-2 focus:ring-accent/15"
              />
              <button
                type="button"
                onClick={cancelCustom}
                className="text-[12px] font-sans text-ink-dimmed hover:text-ink"
              >
                cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCustomInputVisible(true)}
              disabled={busy || selected.length >= MAX_RECIPIENTS}
              className="px-4 py-2 rounded-full border border-dashed border-divider text-[13px] font-sans text-ink-dimmed hover:text-ink hover:border-ink-dimmed transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + custom
            </button>
          )}
        </div>

        {customError && (
          <p className="font-sans text-[11px] text-ink-dimmed italic mb-3">
            {customError}
          </p>
        )}

        {selected.length > 0 && (
          <div className="space-y-3 mt-5 pl-4 border-l-2 border-divider">
            {selected.map((a) => (
              <div key={a}>
                <label className="block font-sans text-[11px] text-ink-dimmed/80 mb-1.5">
                  about your <span className="font-medium text-ink-dimmed">{a}</span> <span className="text-ink-dimmed/60">(optional)</span>
                </label>
                <input
                  type="text"
                  value={contexts[a] ?? ""}
                  onChange={(e) => setContext(a, e.target.value)}
                  placeholder={
                    a === "boss"
                      ? "e.g. conflict-avoidant; just got bad news from their boss"
                      : a === "customer"
                        ? "e.g. evaluating us against two competitors"
                        : "anything specific that would shape how they read this"
                  }
                  disabled={busy}
                  maxLength={200}
                  data-clarity-mask="True"
                  className="w-full rounded-md border border-divider bg-paper px-4 py-2.5 font-serif text-[14px] text-ink placeholder:text-ink-dimmed/60 transition-colors duration-200 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-2 flex items-center justify-between">
        <span className="font-sans text-[12px] text-ink-dimmed">
          {busy ? "Reading…" : `${selected.length} of ${MAX_RECIPIENTS} recipients picked`}
        </span>
        <Button type="submit" disabled={!canSubmit}>
          {busy ? "Reading" : "Check"}
        </Button>
      </div>
    </form>
  )
}
