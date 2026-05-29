"use client"

import type {
  MetaSynthesis,
  RecipientArchetype,
  RecipientReading,
  ReplyAction,
} from "@/lib/types"

const ACTION_LABEL: Record<ReplyAction, string> = {
  reply: "Likely to reply",
  ignore: "Likely to ignore",
  escalate: "Likely to escalate",
  push_back: "Likely to push back",
  ghost: "Likely to ghost",
}

export function SendCheckResults({
  perRecipient,
  declined,
  meta,
  streaming,
}: {
  perRecipient: RecipientReading[]
  declined: { recipient: RecipientArchetype; reason: string }[]
  meta?: MetaSynthesis
  streaming: boolean
}) {
  if (perRecipient.length === 0 && declined.length === 0 && !streaming) {
    return null
  }

  return (
    <div className="mt-16 animate-reveal space-y-12">
      {perRecipient.map((r) => (
        <RecipientBlock key={r.recipient + (r.context || "")} reading={r} />
      ))}

      {declined.map((d) => (
        <div key={"d-" + d.recipient} className="opacity-70">
          <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
            as a {d.recipient}
          </p>
          <p className="font-serif italic text-[15px] leading-[1.55] text-ink-dimmed">
            {d.reason}
          </p>
        </div>
      ))}

      {streaming && perRecipient.length === 0 && declined.length === 0 && (
        <p className="font-serif italic text-[15px] text-ink-dimmed">
          Reading as each recipient…
        </p>
      )}

      {meta && (
        <MetaBlock meta={meta} />
      )}
    </div>
  )
}

function RecipientBlock({ reading }: { reading: RecipientReading }) {
  return (
    <div className="animate-reveal">
      <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-4 flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-[#efd356]"
        />
        as your {reading.recipient}
        {reading.context && (
          <span className="text-ink-dimmed/60 normal-case font-normal tracking-normal">
            — {reading.context}
          </span>
        )}
      </p>

      <div className="pl-4 border-l-2 border-divider space-y-4">
        <p className="font-serif text-[16px] leading-[1.65] text-ink">
          <span className="text-ink-dimmed font-sans text-[11px] uppercase tracking-label block mb-1">
            subject
          </span>
          {reading.subject_notice}
        </p>

        <p className="font-serif text-[16px] leading-[1.65] text-ink">
          <span className="text-ink-dimmed font-sans text-[11px] uppercase tracking-label block mb-1">
            body
          </span>
          {reading.body_notice}
        </p>

        <p className="font-serif text-[15px] leading-[1.6] text-ink-dimmed italic pt-1">
          {ACTION_LABEL[reading.reply_likelihood.action]}.{" "}
          {reading.reply_likelihood.reason}
        </p>
      </div>
    </div>
  )
}

function MetaBlock({ meta }: { meta: MetaSynthesis }) {
  const verdictLabel =
    meta.send_readiness === "ship"
      ? "This will land as you intend."
      : meta.send_readiness === "review"
        ? "Worth sitting with one notice before you send."
        : "This may be doing something you didn't intend."

  return (
    <div className="animate-reveal pt-8 border-t border-divider">
      <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-4">
        the move across recipients
      </p>
      <p className="font-serif text-[17px] leading-[1.55] text-ink mb-10">
        {meta.meta_pattern}
      </p>

      <div className="rounded-md border border-divider bg-paper/60 px-6 py-5">
        <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
          send-readiness
        </p>
        <p className="font-serif text-[17px] leading-[1.5] text-ink mb-1">
          {verdictLabel}
        </p>
        <p className="font-serif text-[14px] leading-[1.6] text-ink-dimmed italic">
          {meta.send_readiness_reason}
        </p>
      </div>
    </div>
  )
}
