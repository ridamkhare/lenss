import Link from "next/link"
import { Footer } from "@/components/lens/Footer"
import { ModeNav } from "@/components/lens/ModeNav"

export const metadata = {
  title: "Privacy — lenss",
  description: "What lenss collects, what it stores, what it doesn't.",
}

export default function PrivacyPage() {
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
        privacy
      </p>
      <p className="font-serif text-[17px] leading-[1.6] text-ink mb-12">
        Plain version: lenss reads the text you give it, generates a
        reading, and forgets the conversation. What sticks around is
        listed below.
      </p>

      <section className="space-y-10">
        <Block heading="What lenss is">
          A reflective layer above AI-generated text. Two surfaces: this
          website (lenss.one), and a Chrome extension that works inside
          ChatGPT and Claude. Both ask one question — what is this writing
          doing? — and surface what shows up.
        </Block>

        <Block heading="What this website collects">
          When you paste a passage and ask for a reading, the text is sent
          to our server, then forwarded to the language model that
          generates the response. We keep a structured record of each
          reading — the text you submitted, the signals the model returned,
          your country, your user agent, and the request timing. This
          record helps us see how the instrument is being used and tune
          the prompt that drives it. Records are written to Upstash Redis,
          a third-party datastore.
          <br />
          <br />
          We do not write any records for traffic identified as
          originating in the EU, EEA, the UK, or Switzerland.
          <br />
          <br />
          The site also loads Google Analytics and Microsoft Clarity for
          aggregate usage measurement (page views, scroll depth, session
          replays of mouse movement and clicks). Neither tool sees the
          contents of the text you paste — only the page-level
          interactions. You can block them with any standard tracker
          blocker without affecting the reading itself.
        </Block>

        <Block heading="What the Chrome extension collects">
          The extension is dormant until you highlight text inside an
          assistant message on ChatGPT or Claude and trigger it (right
          click → "Lenss it", or ⌘⇧L / Ctrl+Shift+L). On trigger, the
          highlighted text is sent to our companion server, which
          forwards it to the language model, and the model's reading is
          streamed back into a small overlay.
          <br />
          <br />
          The companion server keeps a record of each reveal — the
          highlighted text, the signals returned, the optional
          continuation if you click "carry this forward," your country,
          your user agent, and the request timing. Same Upstash Redis
          store the website uses; same GDPR / UK / Swiss geofence.
          <br />
          <br />
          The extension does not read, monitor, or transmit anything
          until you trigger it. There is no background observation, no
          continuous monitoring, no automatic capture of conversations.
          It runs only on chatgpt.com and claude.ai, and only acts when
          you ask.
        </Block>

        <Block heading="What lenss does not collect">
          No browsing history outside the site itself. No location more
          precise than country. No data sold or shared with advertisers.
          No persistent identifier tying separate visits together for
          anonymous use of the reading surfaces.
        </Block>

        <Block heading="Accounts (lenss draft check)">
          The draft-check tool at{" "}
          <Link
            href="/send-check"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            /send-check
          </Link>{" "}
          supports optional accounts so you can keep history, save
          recipient profiles, and run more reveals per day. When you sign
          up we store your email address and a hashed session token; if
          you sign in with Google we also store the Google account id. Your
          drafts and the readings we generate for them are stored against
          your account in our database (Neon Postgres) so you can revisit
          them. Anonymous use of the reading surfaces does not create an
          account.
        </Block>

        <Block heading="Payment (Pro subscription)">
          If you upgrade to Pro, payment is processed by Razorpay. We
          never see or store your card number, UPI id, or bank credentials
          — those go directly to Razorpay, who handles them per their own
          security and compliance terms. What we store is the Razorpay
          customer and subscription identifiers, your subscription status,
          and the trial-end timestamp. You can cancel any time from{" "}
          <Link
            href="/account"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            /account
          </Link>
          ; see the{" "}
          <Link
            href="/refunds"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            Refund &amp; Cancellation Policy
          </Link>{" "}
          for billing details.
        </Block>

        <Block heading="The language model">
          Reading generation runs through OpenRouter, which routes the
          request to the underlying model provider (currently Anthropic).
          OpenRouter and the model provider see the text in transit to
          generate the response. Their handling of that text is governed
          by their own terms; lenss is a thin layer above them, not a
          replacement for their policies.
        </Block>

        <Block heading="Saved readings on the website">
          When you click save on a reading, the reading is stored in your
          browser's localStorage on your device. It never leaves your
          browser, never reaches our servers, and is cleared if you clear
          your browser storage. The /archive page lists what's saved and
          offers a clear-all button.
        </Block>

        <Block heading="Security">
          Traffic to lenss.one and the extension's companion server is
          encrypted in transit (HTTPS). The Upstash store is access-
          restricted to our servers. The extension's companion server
          accepts requests only from the pinned extension origin and is
          rate-limited per IP.
        </Block>

        <Block heading="Removal">
          If you would like records associated with your country and user
          agent removed from the log, send a note to{" "}
          <a
            href="mailto:hello@lenss.one"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            hello@lenss.one
          </a>{" "}
          and we will remove them. If you're in a GDPR / UK / Swiss
          region, your traffic was never logged in the first place.
        </Block>

        <Block heading="Changes">
          If we change what is collected or where it goes, this page
          changes first. The header below is updated whenever the
          substance of the policy moves.
        </Block>

        <p className="font-sans text-[12px] text-ink-dimmed pt-6">
          Last updated 2026-05-29.
        </p>
      </section>

      <Footer />
    </main>
  )
}

function Block({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
        {heading}
      </h2>
      <div className="font-serif text-[16px] leading-[1.65] text-ink">
        {children}
      </div>
    </div>
  )
}
