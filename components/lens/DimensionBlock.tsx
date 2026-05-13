import { cn } from "@/lib/utils"

/**
 * One dimension of an interpretive reveal.
 * - Label is sans, uppercase, tracked, dimmed.
 * - Body is serif, ink, generous line-height.
 * - The emphasized variant (used only for alternate_framing) reveals
 *   slightly slower so it lands as the closing note.
 * - Renders *asterisk-wrapped phrases* as italic — the product's one
 *   rhetorical device.
 */
export function DimensionBlock({
  label,
  body,
  delayMs,
  emphasized,
}: {
  label: string
  body: string
  delayMs: number
  emphasized?: boolean
}) {
  return (
    <section
      className={cn(
        "animate-reveal mb-12 last:mb-0",
        emphasized && "mb-0"
      )}
      style={{
        animationDelay: `${delayMs}ms`,
        animationDuration: emphasized ? "560ms" : "450ms",
      }}
    >
      <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
        {label}
      </h2>
      <p className="font-serif text-[18px] leading-[1.65] text-ink">
        {renderItalics(body)}
      </p>
    </section>
  )
}

/**
 * Replaces *...* runs with <em>...</em>. Avoids markdown library overhead.
 */
function renderItalics(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /\*([^*]+)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <em key={key++} className="italic font-serif text-ink">
        {match[1]}
      </em>
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}
