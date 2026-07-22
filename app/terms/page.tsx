import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that apply when you use the Tsakani Sessions website, buy merch, book tickets, or book a service.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "23 April 2026";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <h1 className="text-4xl sm:text-5xl font-bold mb-3">
        <span className="text-gold-gradient">Terms</span> of Service
      </h1>
      <p className="text-gray-500 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="space-y-8 text-gray-300 leading-relaxed">
        <section>
          <p>
            These terms apply when you use the Tsakani Sessions website, order
            merch, buy event tickets, or book a service. By using the site or
            placing an order you agree to them.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Who we are</h2>
          <p>
            Tsakani Sessions is a DJ entertainment and content creation brand
            based in Cape Town, South Africa. You can reach us at{" "}
            <a
              href="mailto:tsakanisessions@gmail.com"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              tsakanisessions@gmail.com
            </a>{" "}
            or on WhatsApp at{" "}
            <a
              href="https://wa.me/27769961477"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              +27 76 996 1477
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Orders and payment
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              When you book a ticket we reserve your spot, give you an order
              number and QR code on screen, and email the same details to the
              address you gave us.
            </li>
            <li>
              A reserved ticket is only <strong>confirmed</strong> once payment
              has reached us. Free tickets are confirmed as soon as they&apos;re
              booked &mdash; there is nothing to pay.
            </li>
            <li>
              Payment is made through the payment link on your confirmation, or
              as arranged with us directly. When you place a merch order we
              create a pending order and confirm availability and payment with
              you.
            </li>
            <li>
              All prices are in South African Rand (ZAR) and include VAT where
              applicable.
            </li>
            <li>
              Pending orders that are not paid within 48 hours are
              automatically cancelled.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Events and tickets
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Tickets are non-transferable unless we agree otherwise in
              writing.
            </li>
            <li>
              Venues may have their own rules (age restrictions, dress code,
              ID at the door). It&apos;s your responsibility to check before
              attending.
            </li>
            <li>
              We reserve the right to refuse entry in line with the venue&apos;s
              policy.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Refunds and cancellations
          </h2>
          <p>
            Refunds are only offered in the event of a cancellation by us.
            Full details are in our{" "}
            <Link
              href="/refund-policy"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              Refund Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Content and intellectual property
          </h2>
          <p>
            The Tsakani Sessions name, logo, photos, and video content are
            owned by us. You may share our social content with credit, but you
            may not use our brand for commercial purposes without written
            permission.
          </p>
          <p className="mt-3">
            If you appear in photos or videos taken at our events and want
            them removed, email us and we&apos;ll take them down.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Privacy and marketing
          </h2>
          <p>
            How we handle your personal information &mdash; and how you can
            opt out of marketing &mdash; is set out in our{" "}
            <Link
              href="/privacy"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Liability</h2>
          <p>
            We do our best to keep the site, events, and services running
            smoothly. To the extent allowed by law, we&apos;re not responsible
            for indirect losses (lost profits, lost enjoyment, etc.). Nothing
            in these terms limits your rights under the Consumer Protection
            Act.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Changes to these terms
          </h2>
          <p>
            We may update these terms from time to time. The &ldquo;Last
            updated&rdquo; date above will change when we do. Continuing to
            use the site after a change means you accept the new terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Governing law
          </h2>
          <p>
            These terms are governed by the laws of the Republic of South
            Africa.
          </p>
        </section>
      </div>
    </div>
  );
}
