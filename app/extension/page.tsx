import Link from "next/link"
import Image from "next/image"
import { Footer } from "@/components/lens/Footer"
import { ModeNav } from "@/components/lens/ModeNav"

const CWS_URL = process.env.NEXT_PUBLIC_EXTENSION_CWS_URL

export const metadata = {
  title: "Lenss for Chrome — notice what AI text is doing",
  description:
    "Right-click any reply from ChatGPT or Claude. See one short notice of what the writing is doing.",
}

export default function ExtensionPage() {
  return (
    <main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
      <header className="mb-16 sm:mb-20 flex items-center justify-between">
        <Link
          href="/"
          className="font-sans text-[14px] font-medium tracking-wordmark text-ink lowercase hover:text-ink-dimmed transition-colors duration-200"
        >
          lenss
        </Link>
        <ModeNav />
      </header>

      <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
        the chrome extension
      </p>
      <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.3] text-ink mb-8">
        Lenss in your AI conversations.
      </h1>
      <p className="font-serif text-[17px] leading-[1.6] text-ink-dimmed mb-12">
        Highlight any reply from ChatGPT or Claude. Right-click → &ldquo;Lenss
        it.&rdquo; A small overlay shows you one short notice of what the
        writing is doing — and where the conversation could go.
      </p>

      <div className="mb-16">
        {CWS_URL ? (
          <a
            href={CWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-bg font-sans text-[14px] font-medium rounded hover:bg-ink-dimmed transition-colors duration-200"
          >
            Add to Chrome
            <span aria-hidden>→</span>
          </a>
        ) : (
          <div className="inline-flex items-center gap-2 px-6 py-3 border border-divider text-ink-dimmed font-sans text-[14px] rounded">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-[#efd356]"
            />
            In review on the Chrome Web Store
          </div>
        )}
      </div>

      <figure className="mb-16">
        <Image
          src="/extension-overlay.png"
          alt="The Lenss overlay open beside an assistant message on ChatGPT, showing one short notice of what the writing is doing."
          width={1280}
          height={800}
          className="w-full rounded border border-divider"
          priority
        />
        <figcaption className="font-sans text-[11px] text-ink-dimmed mt-3">
          The overlay, open on a ChatGPT reply.
        </figcaption>
      </figure>

      <section className="mb-16">
        <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-6">
          getting started
        </h2>
        <ol className="space-y-6">
          <Step number="01">
            <span className="font-medium text-ink">Install.</span> Click
            &ldquo;Add to Chrome&rdquo; above. Chrome adds the extension.
          </Step>
          <Step number="02">
            <span className="font-medium text-ink">Pin it to your toolbar.</span>{" "}
            Click the puzzle icon in the top-right of Chrome, then click the
            pin next to Lenss. A small yellow dot appears in the toolbar when
            it&rsquo;s ready.
          </Step>
          <Step number="03">
            <span className="font-medium text-ink">Try it.</span> Open ChatGPT
            or Claude, highlight any reply, right-click → &ldquo;Lenss
            it&rdquo; (or ⌘⇧L on Mac, Ctrl+Shift+L elsewhere). A small
            overlay appears with one short notice of what the writing is
            doing.
          </Step>
        </ol>
      </section>

      <section className="mb-16">
        <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-6">
          what it doesn&rsquo;t do
        </h2>
        <ul className="font-serif text-[16px] leading-[1.65] text-ink-dimmed space-y-2">
          <li>No background monitoring. Dormant until you trigger it.</li>
          <li>No rewriting, no advice, no &ldquo;try saying X instead.&rdquo;</li>
          <li>No accounts, no login, no email, no payment.</li>
          <li>Runs only on chatgpt.com and claude.ai.</li>
        </ul>
      </section>

      <section className="mb-16">
        <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-6">
          the slower companion
        </h2>
        <p className="font-serif text-[16px] leading-[1.65] text-ink-dimmed">
          <Link
            href="/"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            lenss.one
          </Link>{" "}
          is the web version — paste a passage and read it more deliberately,
          with more dimensions surfaced. Same instrument, different cognitive
          mode.
        </p>
      </section>

      <section className="mb-16">
        <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-6">
          privacy &amp; support
        </h2>
        <p className="font-serif text-[16px] leading-[1.65] text-ink-dimmed mb-3">
          The extension sends only what you highlight, only when you trigger
          it. Full details on the{" "}
          <Link
            href="/privacy"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            privacy page
          </Link>
          .
        </p>
        <p className="font-serif text-[16px] leading-[1.65] text-ink-dimmed">
          Questions, bug reports, removal requests:{" "}
          <a
            href="mailto:hello@lenss.one"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            hello@lenss.one
          </a>
          .
        </p>
      </section>

      <p className="font-sans text-[12px] text-ink-dimmed pt-6">
        Last updated 2026-05-28.
      </p>

      <Footer />
    </main>
  )
}

function Step({
  number,
  children,
}: {
  number: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-5">
      <span className="font-sans text-[11px] font-medium text-ink-dimmed/70 tracking-label uppercase pt-1">
        {number}
      </span>
      <span className="font-serif text-[16px] leading-[1.65] text-ink flex-1">
        {children}
      </span>
    </li>
  )
}
