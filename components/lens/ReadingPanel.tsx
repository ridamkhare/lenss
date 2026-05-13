import type { Reading } from "@/lib/types"

/**
 * One side of a compare view: a large italicized lens name, a paragraph
 * of frame beneath it. Used twice, side-by-side on desktop, stacked on
 * mobile. No box, no background — typographic separation only.
 */
export function ReadingPanel({
  reading,
  delayMs,
}: {
  reading: Reading
  delayMs: number
}) {
  return (
    <div
      className="animate-reveal"
      style={{
        animationDelay: `${delayMs}ms`,
        animationDuration: "560ms",
      }}
    >
      <p className="font-serif italic text-[22px] sm:text-[24px] leading-[1.3] text-ink mb-5">
        {reading.lens}
      </p>
      <p className="font-serif text-[17px] leading-[1.65] text-ink">
        {reading.frame}
      </p>
    </div>
  )
}
