import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Tsakani Sessions collects, uses, and shares your personal information.",
};

const LAST_UPDATED = "23 April 2026";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <h1 className="text-4xl sm:text-5xl font-bold mb-3">
        <span className="text-gold-gradient">Privacy</span> Policy
      </h1>
      <p className="text-gray-500 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="space-y-8 text-gray-300 leading-relaxed">
        <section>
          <p>
            Tsakani Sessions (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is based in
            Cape Town, South Africa. This policy explains what personal
            information we collect, why, and who we share it with. We comply
            with the Protection of Personal Information Act, 2013 (POPIA).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            What we collect
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Contact details</strong> &mdash; name, email address, and
              phone number when you place an order, buy a ticket, book a
              service, or sign up for updates.
            </li>
            <li>
              <strong>Order and event details</strong> &mdash; the items,
              tickets, or services you purchase and any notes you include.
            </li>
            <li>
              <strong>Basic technical data</strong> &mdash; IP address and
              device info used for security (rate limits, CAPTCHA).
            </li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> collect ID numbers, passports, or
            financial account details. Payments are arranged directly with you
            over WhatsApp.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            How we use it
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To process and confirm your orders, tickets, and bookings.</li>
            <li>
              To send you marketing about upcoming events and new merch drops
              &mdash;{" "}
              <strong>only if you tick the relevant consent box</strong> when
              you sign up.
            </li>
            <li>To respond to your enquiries over WhatsApp or email.</li>
            <li>
              To keep the site secure and prevent abuse (rate limits, CAPTCHA
              logs).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Sharing with third parties
          </h2>
          <p>
            With your consent, we may share your email or phone number with
            trusted partners for the purpose of promoting Tsakani Sessions
            events and merch (for example, event co-hosts, venues, or
            collaborating brands). You can withdraw consent at any time.
          </p>
          <p className="mt-3">
            We also use the following processors to run the site. They only
            receive the data needed for the service they provide:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              <strong>Supabase</strong> &mdash; database and authentication.
            </li>
            <li>
              <strong>Vercel</strong> &mdash; website hosting.
            </li>
            <li>
              <strong>Resend</strong> &mdash; sending order confirmation and
              marketing emails.
            </li>
            <li>
              <strong>Cloudflare Turnstile</strong> &mdash; bot/CAPTCHA
              protection on forms.
            </li>
            <li>
              <strong>WhatsApp (Meta)</strong> &mdash; customer communication
              and order confirmation.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            How long we keep it
          </h2>
          <p>
            Order records are kept for as long as needed for tax and accounting
            purposes. Newsletter subscriptions are kept until you unsubscribe.
            You can ask us to delete your data at any time.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Your rights</h2>
          <p>Under POPIA you can:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Ask what information we hold about you.</li>
            <li>Ask us to correct or delete it.</li>
            <li>
              Withdraw your consent to receive marketing at any time (every
              marketing email will have an unsubscribe link).
            </li>
            <li>Object to how we use your information.</li>
            <li>
              Lodge a complaint with the Information Regulator of South Africa
              (
              <a
                href="https://inforegulator.org.za"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-500 hover:text-gold-400 underline"
              >
                inforegulator.org.za
              </a>
              ).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Contact us</h2>
          <p>
            Email{" "}
            <a
              href="mailto:tsakanisessions@gmail.com"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              tsakanisessions@gmail.com
            </a>{" "}
            or WhatsApp{" "}
            <a
              href="https://wa.me/27769961477"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              +27 76 996 1477
            </a>{" "}
            for any privacy-related requests.
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
              href="/refund-policy"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              Refund Policy
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
