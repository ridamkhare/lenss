import Link from "next/link"
import { Footer } from "@/components/lens/Footer"

export const metadata = {
  title: "Lenss Draft Check — see what your email is doing before you send",
  description:
    "Before you hit send, see what your message is doing to the reader. Multi-recipient simulation. No rewriting — just the reading.",
}

const SAMPLES = [
  {
    label: "the raise ask",
    subject: "Quick chat?",
    bodyPreview:
      "Hi, I was hoping we could find some time to discuss my role and compensation. I know things have been busy and I don't want to add to your plate…",
    recipient: "boss",
    context: "conflict-avoidant",
    notice:
      'Every approach to the ask is wrapped in apology — "don\'t want to add to your plate" — so the boss receives explicit permission to defer instead of a request that names compensation as the actual subject.',
    likelihood: "Likely to ignore",
    likelihoodReason:
      "The email pre-authorizes delay and never anchors a timeframe, giving a deferral-prone boss nothing to push against.",
  },
  {
    label: "the customer follow-up",
    subject: "Re: Pricing for enterprise plan",
    bodyPreview:
      "Hey, just circling back on the email I sent last week about our enterprise pricing. I know you mentioned you'd loop in your CTO — let me know if there's anything I can do to help…",
    recipient: "customer",
    context: "evaluating us against two competitors",
    notice:
      'The stacked offers — "loop in your CTO", a deck, a better time — pile availability on top of availability so the recipient feels chased rather than courted while two competitors are doing the same dance.',
    likelihood: "Likely to ignore",
    likelihoodReason:
      "Nothing in the email forces a decision or changes the comparison against the other two vendors, so the easiest move is to keep evaluating quietly.",
  },
  {
    label: "the decline",
    subject: "Re: Catch-up next week",
    bodyPreview:
      "Hey! Thanks so much for thinking of me. Unfortunately my calendar is really packed next week and I don't think I'll be able to make it work. Maybe we can find some time later…",
    recipient: "boss",
    context: "asked for the meeting; senior to me by two levels",
    notice:
      'The wall of softeners — "Thanks so much for thinking of me" — performs warmth before declining a two-levels-up request without proposing a specific time, so what arrives is a vague deflection dressed as politeness.',
    likelihood: "Likely to push back",
    likelihoodReason:
      "A senior who initiated the meeting is likely to come back with a specific time rather than accept 'later in the month' from a junior.",
  },
]

export default function DraftCheckLanding() {
  return (
    <main className="mx-auto w-full max-w-reading px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
      <header className="mb-16 sm:mb-20 flex items-center justify-between">
        <Link
          href="/"
          className="font-sans text-[14px] font-medium tracking-wordmark text-ink lowercase hover:text-ink-dimmed transition-colors duration-200"
        >
          lenss
        </Link>
        <Link
          href="/send-check"
          className="font-sans text-[12px] tracking-[0.04em] lowercase text-ink hover:text-ink-dimmed transition-colors duration-200"
        >
          try it →
        </Link>
      </header>

      <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3">
        draft check
      </p>
      <h1 className="font-serif text-[26px] sm:text-[34px] leading-[1.25] text-ink mb-8">
        Before your email lands, see what it&rsquo;s doing to the reader.
      </h1>
      <p className="font-serif text-[18px] leading-[1.55] text-ink-dimmed mb-12">
        Paste any message you&rsquo;re about to send. Name who&rsquo;s reading it.
        Lenss reads it the way each of them will — the pressure, the
        positioning, the unspoken pull — before they do. No rewriting. Just
        the reading.
      </p>

      <div className="mb-20">
        <Link
          href="/send-check"
          className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-sans text-[14px] font-medium rounded-md hover:bg-ink/85 transition-colors duration-200"
        >
          Try it free — 3 reveals a day
          <span aria-hidden>→</span>
        </Link>
        <p className="mt-3 font-sans text-[12px] text-ink-dimmed">
          No signup needed for the first try. Sign up free for 5/day plus
          saved personas and history.
        </p>
      </div>

      {/* What it is */}
      <section className="mb-20">
        <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-5">
          what it is
        </h2>
        <p className="font-serif text-[17px] leading-[1.6] text-ink mb-5">
          A perceptual instrument for the moment before you hit send. Lenss
          isn&rsquo;t a writing tool — it&rsquo;s a reading tool, applied to
          your own draft, simulating the reader&rsquo;s eye.
        </p>
        <p className="font-serif text-[17px] leading-[1.6] text-ink-dimmed">
          It surfaces what your message is doing — the framing, the pressure,
          the position it puts the recipient in. It never rewrites for you.
          You stay the writer; Lenss stays the reader.
        </p>
      </section>

      {/* How it works */}
      <section className="mb-20">
        <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-6">
          how it works
        </h2>
        <ol className="space-y-6">
          <Step number="01">
            Paste your draft — subject and body. Anything you&rsquo;d
            otherwise just hit send on.
          </Step>
          <Step number="02">
            Name who&rsquo;s reading it. Pick from 8 common archetypes
            (boss, peer, customer, investor, family, stranger, hostile, team)
            or type a custom one (co-founder, ex-partner, thesis advisor).
            Add a one-line note about the actual person if it helps.
          </Step>
          <Step number="03">
            Lenss reads your email as each recipient would receive it.
            Surfaces one perceptual notice per recipient, a meta-pattern
            across all of them, and a send-readiness verdict.
          </Step>
        </ol>
      </section>

      {/* Samples */}
      <section className="mb-20">
        <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-6">
          what a reading looks like
        </h2>
        <div className="space-y-12">
          {SAMPLES.map((s) => (
            <Sample key={s.label} sample={s} />
          ))}
        </div>
      </section>

      {/* What it isn't */}
      <section className="mb-20">
        <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-5">
          what it isn&rsquo;t
        </h2>
        <ul className="font-serif text-[16px] leading-[1.7] text-ink-dimmed space-y-2">
          <li>Not a rewriting tool. No alternatives. No suggestions like &ldquo;try saying X.&rdquo;</li>
          <li>Not a tone optimizer. Not a politeness booster. Not a persuasion engine.</li>
          <li>Not a coaching app. Lenss never tells you what to do — it just shows you what your writing is doing.</li>
          <li>Not background monitoring. You paste, you trigger. Nothing else.</li>
        </ul>
      </section>

      {/* Pricing */}
      <section className="mb-20">
        <h2 className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-6">
          pricing
        </h2>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="rounded-md border border-divider bg-paper/60 px-6 py-6">
            <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-2">
              free
            </p>
            <p className="font-serif text-[24px] text-ink mb-4">$0</p>
            <ul className="font-serif text-[14px] leading-[1.6] text-ink-dimmed space-y-1.5">
              <li>5 reveals every day</li>
              <li>Read against up to 3 recipients at once</li>
              <li>Save up to 3 recipient profiles</li>
              <li>Last 10 checks in history</li>
            </ul>
            <p className="mt-4 font-sans text-[11px] text-ink-dimmed/70">
              Sign up takes 5 seconds. No card.
            </p>
          </div>
          <div className="rounded-md border border-ink bg-paper/60 px-6 py-6">
            <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-2 flex items-center gap-2">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[#efd356]" />
              pro
            </p>
            <p className="font-serif text-[24px] text-ink mb-4">
              ₹1599<span className="text-ink-dimmed text-[16px]"> / month</span>
            </p>
            <ul className="font-serif text-[14px] leading-[1.6] text-ink-dimmed space-y-1.5">
              <li>50 reveals every day (effectively unlimited)</li>
              <li>Read against up to 4 recipients at once</li>
              <li>Save up to 30 recipient profiles</li>
              <li>Last 200 checks in history</li>
            </ul>
            <p className="mt-4 font-sans text-[11px] text-ink-dimmed/70">
              10-day free trial. No card needed for trial. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* CTA bar */}
      <section className="mb-16 pt-8 border-t border-divider">
        <p className="font-serif text-[18px] leading-[1.5] text-ink mb-5">
          Read your next email through Lenss before you send it.
        </p>
        <Link
          href="/send-check"
          className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-sans text-[14px] font-medium rounded-md hover:bg-ink/85 transition-colors duration-200"
        >
          Try draft check
          <span aria-hidden>→</span>
        </Link>
      </section>

      {/* Footer ecosystem note */}
      <p className="mt-12 font-sans text-[11px] text-ink-dimmed/70">
        Draft check is one surface of Lenss. The web companion at{" "}
        <Link href="/" className="underline decoration-divider underline-offset-2 hover:text-ink-dimmed transition-colors">
          lenss.one
        </Link>{" "}
        reads AI text. The Chrome extension reads ChatGPT and Claude replies.
        Same instrument, different surfaces. Research, pitches, journalism —
        coming as Lenss grows.
      </p>

      <Footer />
    </main>
  )
}

function Step({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-5">
      <span className="font-sans text-[11px] font-medium text-ink-dimmed/70 tracking-label uppercase pt-1">
        {number}
      </span>
      <span className="font-serif text-[16px] leading-[1.7] text-ink flex-1">
        {children}
      </span>
    </li>
  )
}

function Sample({
  sample,
}: {
  sample: (typeof SAMPLES)[number]
}) {
  return (
    <div>
      <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-4">
        {sample.label}
      </p>
      <div className="rounded-md border border-divider bg-paper/40 px-5 py-4 mb-6">
        <p className="font-sans text-[11px] uppercase tracking-label text-ink-dimmed mb-1">
          subject
        </p>
        <p className="font-serif text-[15px] text-ink mb-3">{sample.subject}</p>
        <p className="font-sans text-[11px] uppercase tracking-label text-ink-dimmed mb-1">
          body
        </p>
        <p className="font-serif text-[14px] leading-[1.6] text-ink-dimmed italic">
          {sample.bodyPreview}
        </p>
      </div>
      <p className="font-sans text-[11px] font-medium uppercase tracking-label text-ink-dimmed mb-3 flex items-center gap-2">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[#efd356]" />
        as your {sample.recipient}
        <span className="text-ink-dimmed/60 normal-case font-normal tracking-normal">
          — {sample.context}
        </span>
      </p>
      <div className="pl-4 border-l-2 border-divider space-y-3">
        <p className="font-serif text-[15px] leading-[1.65] text-ink">
          {sample.notice}
        </p>
        <p className="font-serif text-[14px] leading-[1.6] text-ink-dimmed italic">
          {sample.likelihood}. {sample.likelihoodReason}
        </p>
      </div>
    </div>
  )
}
