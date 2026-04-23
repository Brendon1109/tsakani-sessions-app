import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Refund policy for Tsakani Sessions event tickets, merch, and services.",
};

const LAST_UPDATED = "23 April 2026";

export default function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <h1 className="text-4xl sm:text-5xl font-bold mb-3">
        <span className="text-gold-gradient">Refund</span> Policy
      </h1>
      <p className="text-gray-500 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="space-y-8 text-gray-300 leading-relaxed">
        <section>
          <p>
            We only offer refunds in one situation: if{" "}
            <strong>we cancel an event</strong>. Everything else is final once
            confirmed. This keeps our pricing simple and lets us commit to
            venues and suppliers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Event cancellation by Tsakani Sessions
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              If <strong>we cancel an event</strong>, ticket holders will be
              offered either a full refund of the ticket price or a credit of
              equal value for a future event &mdash; your choice.
            </li>
            <li>
              Refunds are processed within 14 business days of the
              cancellation announcement, to the payment method you used.
            </li>
            <li>
              We&apos;ll reach out to you directly via WhatsApp or email with
              instructions.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Postponements and venue changes
          </h2>
          <p>
            If an event is postponed or moved to a different venue, your
            ticket stays valid for the new date or venue. If you can no longer
            attend, reach out to us and we&apos;ll review your case on a
            case-by-case basis.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            What is <em>not</em> refundable
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Tickets to events that go ahead as planned &mdash; even if you
              can&apos;t attend.
            </li>
            <li>
              Confirmed and paid merch orders (damage or wrong item sent will
              be replaced; see below).
            </li>
            <li>
              Booked DJ or service bookings once a deposit or full payment has
              been received, unless otherwise agreed in writing.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Damaged or incorrect merch
          </h2>
          <p>
            If your merch arrives damaged, faulty, or different to what you
            ordered, let us know within 7 days and we&apos;ll replace it or
            refund the difference. Please include photos when you contact us.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            How to request a refund
          </h2>
          <p>
            WhatsApp us at{" "}
            <a
              href="https://wa.me/27769961477"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              +27 76 996 1477
            </a>{" "}
            or email{" "}
            <a
              href="mailto:tsakanisessions@gmail.com"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              tsakanisessions@gmail.com
            </a>{" "}
            with your order ID and the reason. We&apos;ll get back to you
            within 3 business days.
          </p>
        </section>

        <section className="pt-4 border-t border-white/10">
          <p className="text-sm text-gray-500">
            See also:{" "}
            <Link
              href="/terms"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              Terms of Service
            </Link>{" "}
            ·{" "}
            <Link
              href="/privacy"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              Privacy Policy
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
