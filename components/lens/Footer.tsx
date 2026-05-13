import Link from "next/link"

/**
 * Shared footer.
 */
export function Footer() {
  return (
    <footer className="mt-32 sm:mt-40">
      <p className="font-sans text-[11px] text-ink-dimmed tracking-[0.02em]">
        Nothing you paste leaves your device.
      </p>
      <p className="mt-2 font-sans text-[11px] text-ink-dimmed">
        <Link
          href="/archive"
          className="hover:text-ink transition-colors duration-200"
        >
          archive
        </Link>
      </p>
    </footer>
  )
}
