import Link from "next/link"

const CWS_URL = process.env.NEXT_PUBLIC_EXTENSION_CWS_URL

export function Footer() {
  return (
    <footer className="mt-32 sm:mt-40">
      <p className="font-sans text-[11px] text-ink-dimmed">
        <Link
          href="/archive"
          className="hover:text-ink transition-colors duration-200"
        >
          archive
        </Link>
        <span className="mx-2 text-divider">·</span>
        <Link
          href="/terms"
          className="hover:text-ink transition-colors duration-200"
        >
          terms
        </Link>
        <span className="mx-2 text-divider">·</span>
        <Link
          href="/privacy"
          className="hover:text-ink transition-colors duration-200"
        >
          privacy
        </Link>
        <span className="mx-2 text-divider">·</span>
        <Link
          href="/refunds"
          className="hover:text-ink transition-colors duration-200"
        >
          refunds
        </Link>
        {CWS_URL && (
          <>
            <span className="mx-2 text-divider">·</span>
            <Link
              href="/extension"
              className="group inline-flex items-baseline gap-1.5 hover:text-ink transition-colors duration-200"
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 translate-y-[1px] rounded-full bg-[#efd356]"
              />
              <span>Lenss for ChatGPT and Claude</span>
              <span
                aria-hidden
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </>
        )}
      </p>
    </footer>
  )
}
