import Link from "next/link"
import { Footer } from "@/components/lens/Footer"
import { ModeNav } from "@/components/lens/ModeNav"

export const metadata = {
  title: "Refunds & Cancellation — lenss",
  description: "How billing, cancellation, and refunds work for Pro.",
}

export default function RefundsPage() {
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
        refunds &amp; cancellation
      </p>
      <p className="font-serif text-[17px] leading-[1.6] text-ink mb-12">
        Plain version: you can cancel Pro any time and you will not be
        charged again. Refunds are evaluated case-by-case for billing
        errors and genuine service failures.
      </p>

      <section className="space-y-10">
        <Block heading="Pro pricing">
          Pro is ₹1599 per month, billed in advance. The subscription
          continues monthly until you cancel. There is no annual plan
          today. Prices are in Indian Rupees and include applicable taxes
          where required.
        </Block>

        <Block heading="The 10-day free trial">
          New accounts get 10 days of Pro features free, with no charge.
          Razorpay collects a recurring-payment mandate when you start the
          trial (RBI rules for recurring billing require this), but the
          first ₹1599 charge only fires on the day your trial ends. Cancel
          any time before that day and no money moves.
        </Block>

        <Block heading="How to cancel">
          Sign in and go to{" "}
          <Link
            href="/account"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            /account
          </Link>
          . Click <em>Cancel subscription</em>, then confirm. Cancellation
          takes effect at the end of the current billing period — you keep
          Pro access until then. After that, your account reverts to Free
          and you are not charged again. You can also email{" "}
          <a
            href="mailto:hello@lenss.one"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            hello@lenss.one
          </a>{" "}
          and we will cancel for you within one business day.
        </Block>

        <Block heading="Refunds">
          We do not refund the unused portion of a billing period that
          you have already paid for — you keep Pro access through the end
          of that period instead. Refunds are evaluated case-by-case in
          the following situations:
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>Duplicate or accidental charge.</strong> Refunded in
              full within 5–7 business days.
            </li>
            <li>
              <strong>Service unavailable for a significant portion of
              the billing period.</strong> Pro-rated refund of the affected
              days.
            </li>
            <li>
              <strong>Charged after a successful cancellation.</strong>
              {" "}Refunded in full within 5–7 business days.
            </li>
            <li>
              <strong>Genuine bug that made the product unusable for
              you.</strong> Email us; we will work it out.
            </li>
          </ul>
        </Block>

        <Block heading="How to request a refund">
          Email{" "}
          <a
            href="mailto:hello@lenss.one"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            hello@lenss.one
          </a>{" "}
          from the address tied to your account. Include the Razorpay
          payment id (visible in your bank statement and in your Razorpay
          receipt email) and one or two sentences about what happened. We
          respond within two business days. Approved refunds are issued to
          the original payment method via Razorpay and typically appear in
          your statement within 5–7 business days.
        </Block>

        <Block heading="Failed payments">
          If a recurring charge fails (expired card, insufficient funds,
          bank decline), Razorpay retries automatically over a few days. If
          retries all fail, your account moves to a paused state and Pro
          features lock until the payment method is updated. No additional
          charge or penalty is applied for a failed retry.
        </Block>

        <Block heading="Account closure">
          Cancelling Pro does not close your account — your free-tier
          access continues, with your history and personas preserved (up
          to the free-tier caps). To delete the account entirely, email{" "}
          <a
            href="mailto:hello@lenss.one"
            className="underline decoration-divider underline-offset-2 hover:text-ink transition-colors"
          >
            hello@lenss.one
          </a>{" "}
          and we will delete your data within 7 days.
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
