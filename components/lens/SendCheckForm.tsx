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
  /** Max recipients per check based on the user's plan. Anon = 1, free+pro = 4. */
  maxRecipients?: number
  /** Signed-in users get the persona save/select sub-section. */
  signedIn?: boolean
}

const HARD_MAX_RECIPIENTS = 4
const ARCHETYPE_RE = /^[a-zA-Z][a-zA-Z0-9 \-']{0,29}$/

const TOKEN_STORAGE_KEY = "lenss-session-token"

interface Persona {
  id: string
  label: string
  context: string | null
}

function normalizeArchetype(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, " ")
  return ARCHETYPE_RE.test(trimmed) ? trimmed : null
}

export function SendCheckForm({
  onSubmit,
  busy,
  maxRecipients = HARD_MAX_RECIPIENTS,
  signedIn = false,
}: Props) {
  const MAX_RECIPIENTS = Math.min(maxRecipients, HARD_MAX_RECIPIENTS)
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

  // Personas (signed-in only)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [savingPersona, setSavingPersona] = useState<string | null>(null)
  const [personaError, setPersonaError] = useState<string | null>(null)

  useEffect(() => {
    if (customInputVisible) customInputRef.current?.focus()
  }, [customInputVisible])

  // Load personas on mount for signed-in users
  useEffect(() => {
    if (!signedIn) return
    const token = (() => {
      try { return localStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
    })()
    if (!token) return
    fetch(`/api/personas?_=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.personas) setPersonas(data.personas)
      })
      .catch(() => { /* personas are optional; silent fail */ })
  }, [signedIn])

  function togglePersona(p: Persona) {
    if (busy) return
    setSelected((prev) => {
      if (prev.includes(p.label)) {
        return prev.filter((a) => a !== p.label)
      }
      if (prev.length >= MAX_RECIPIENTS) return prev
      // Selecting — pre-fill context from the saved persona
      setContexts((c) => ({ ...c, [p.label]: p.context ?? "" }))
      return [...prev, p.label]
    })
  }

  async function savePersona(archetype: string) {
    if (savingPersona) return
    const ctx = contexts[archetype]?.trim() || ""
    setSavingPersona(archetype)
    setPersonaError(null)
    const token = (() => {
      try { return localStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
    })()
    try {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ label: archetype, context: ctx }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPersonaError(data?.error || "Couldn't save that persona.")
        return
      }
      setPersonas((prev) => [data.persona, ...prev])
    } catch {
      setPersonaError("Couldn't save that persona. Try again.")
    } finally {
      setSavingPersona(null)
    }
  }

  const isPersonaSaved = (archetype: string, context: string) =>
    personas.some(
      (p) => p.label === archetype && (p.context ?? "") === context.trim()
    )

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

        {signedIn && personas.length > 0 && (
          <div className="mb-4">
            <p className="font-sans text-[10px] uppercase tracking-label text-ink-dimmed/70 mb-2">
              saved
            </p>
            <div className="flex flex-wrap gap-2">
              {personas.map((p) => {
                const isOn = selected.includes(p.label)
                const disabled = busy || (!isOn && selected.length >= MAX_RECIPIENTS)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePersona(p)}
                    disabled={disabled}
                    title={p.context || ""}
                    className={`px-4 py-2 rounded-full border text-[13px] font-sans transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                      isOn
                        ? "border-ink bg-ink text-paper"
                        : "border-ink-dimmed/40 bg-paper/50 text-ink-dimmed hover:text-ink hover:border-ink-dimmed"
                    }`}
                  >
                    {p.label}
                    {p.context && (
                      <span className={`ml-1 text-[11px] ${isOn ? "text-paper/60" : "text-ink-dimmed/60"}`}>
                        · {p.context.slice(0, 20)}{p.context.length > 20 ? "…" : ""}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

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
            {selected.map((a) => {
              const ctxVal = contexts[a] ?? ""
              const showSave =
                signedIn &&
                ctxVal.trim().length > 0 &&
                !isPersonaSaved(a, ctxVal)
              return (
                <div key={a}>
                  <label className="block font-sans text-[11px] text-ink-dimmed/80 mb-1.5">
                    about your <span className="font-medium text-ink-dimmed">{a}</span> <span className="text-ink-dimmed/60">(optional)</span>
                  </label>
                  <div className="flex gap-2 items-stretch">
                    <input
                      type="text"
                      value={ctxVal}
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
                      className="flex-1 rounded-md border border-divider bg-paper px-4 py-2.5 font-serif text-[14px] text-ink placeholder:text-ink-dimmed/60 transition-colors duration-200 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60"
                    />
                    {showSave && (
                      <button
                        type="button"
                        onClick={() => savePersona(a)}
                        disabled={!!savingPersona || busy}
                        title="Save this recipient + context as a reusable persona"
                        className="px-3 rounded-md border border-divider text-ink-dimmed hover:text-ink hover:border-ink-dimmed text-[12px] font-sans whitespace-nowrap disabled:opacity-50"
                      >
                        {savingPersona === a ? "saving…" : "✓ save"}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {personaError && (
          <p className="font-sans text-[11px] text-ink-dimmed italic mt-3">
            {personaError}
          </p>
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
