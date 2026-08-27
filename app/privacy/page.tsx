import type { Metadata } from "next";
import Link from "next/link";
import AnalyticsToggle from "./AnalyticsToggle";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Tsakani Sessions collects, uses, and shares your personal information, including how we count visits and how to turn that off.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "27 August 2026";

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
            <li>
              <strong>How the site is used</strong> &mdash; which pages are
              opened and how long they are on screen. This is set out in full in
              the next section, and you can turn it off there.
            </li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> collect ID numbers, passports, or
            financial account details. Payments are arranged directly with you
            over WhatsApp.
          </p>
        </section>

        <section id="analytics" className="scroll-mt-24">
          <h2 className="text-xl font-semibold text-white mb-3">
            How we count visits
          </h2>
          <p>
            We measure how this site is used so we know which events, tickets
            and merch people actually look at, and so we can tell whether the
            site is working. We do this ourselves rather than handing it to an
            advertising company. There is no Google Analytics here, no Meta
            pixel, and no advertising or third party tracker of any kind.
          </p>
          <p className="mt-3">
            There are <strong>two</strong> separate systems doing it, and we
            would rather name both than describe one and let you assume that was
            all of it.
          </p>

          <h3 className="text-lg font-semibold text-white mt-6 mb-2">
            1. Our own event tracking
          </h3>
          <p>
            This one tells us what happened on the site. When you open a page or
            tap something we care about, such as a ticket link or a product, it
            records that. It stores:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              A <strong>random session id</strong>, kept in your browser&rsquo;s
              storage under the name <code className="text-gold-500">ts_sid</code>
              . It is a random number generated on your device. It is not linked
              to your name, your email, or any account, and we cannot use it to
              work out who you are.
            </li>
            <li>The page addresses you open on this site.</li>
            <li>
              The name of the thing you tapped, for example that a ticket link
              was opened, plus a small amount of detail about it such as which
              event or product.
            </li>
            <li>
              A rough location, at <strong>city level only</strong> (city,
              region, country). Not a street, not a map position.
            </li>
            <li>
              Whether you are on a phone, a tablet or a computer.
            </li>
            <li>
              The <strong>website that sent you here</strong>, its address only.
              For example we would see that you came from Instagram. We do not
              keep the full link, so if you arrived from a search we never see
              what you searched for.
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-white mt-6 mb-2">
            2. Breazy Analytics
          </h3>
          <p>
            This one tells us how the site is being used compared with the other
            sites we run, which the first system cannot see. It stores:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              A cookie named <code className="text-gold-500">_bza</code>{" "}
              containing <strong>no identifier at all</strong>. It holds three
              things: the date you first visited, how many separate days you
              have visited on, and the date you were last here. Two people who
              first came on the same day and have been back the same number of
              times carry an identical cookie.
            </li>
            <li>
              A <strong>daily counting value</strong>. We will be straight about
              this one, because it is the only part that is genuinely about you
              rather than about the page. It is a scrambled value worked out from
              your network address, your browser and today&rsquo;s date. We do
              not store your network address, only the scrambled result. It{" "}
              <strong>changes every day at midnight</strong> and it is scrambled
              differently on every site we run, so it cannot be used to follow
              you from one day to the next or from this site to another one.
              Within a single day it does tie your page views together, which is
              the only way to count how many people visited rather than how many
              pages were opened.
            </li>
            <li>The page addresses you open on this site.</li>
            <li>
              How many seconds a page was <strong>actually on screen</strong>.
              Time while the page is hidden behind another app or tab is not
              counted.
            </li>
            <li>A rough location, again at city level only.</li>
            <li>Your device type and which browser you use.</li>
            <li>The website that sent you here, its address only.</li>
          </ul>

          <h3 className="text-lg font-semibold text-white mt-6 mb-2">
            What neither one keeps
          </h3>
          <p>
            Neither system stores your IP address. Your IP is used for a moment
            while the request is being handled, to work out the city and to stop
            abuse, and then it is gone. Neither one records your name, your
            email address, your phone number, or your exact location, and
            neither is shared with an advertising network or sold to anyone.
          </p>
          <p className="mt-3">
            Page addresses are also <strong>cleaned before they are stored</strong>
            . Your ticket links and order links contain a private code that is
            what proves the ticket is yours, so anything in an address that looks
            like a code is replaced before it is recorded. We would rather lose a
            little detail in our own reporting than keep a live ticket code in a
            list of pages.
          </p>

          <h3 className="text-lg font-semibold text-white mt-6 mb-2">
            Why we are allowed to do this
          </h3>
          <p>
            Both of these run on our{" "}
            <strong>legitimate interest</strong> under section 11(1)(f) of
            POPIA, not on your consent. In plain terms: we need to know whether
            the site works, the information is not sensitive and does not
            identify you, and we judged that this does not override your
            privacy. That is a judgement you are entitled to disagree with,
            which is what the next part is for.
          </p>

          <h3 className="text-lg font-semibold text-white mt-6 mb-2">
            Turning it off
          </h3>
          <p className="mb-4">
            Section 11(3) of POPIA gives you the right to object to this. Unlike
            the European rules, section 11(4) gives us{" "}
            <strong>nothing to weigh your objection against</strong>. If you
            object, we stop. The button below is that objection. It switches off{" "}
            <strong>both</strong> systems described above, deletes the{" "}
            <code className="text-gold-500">_bza</code> cookie and deletes the{" "}
            <code className="text-gold-500">ts_sid</code> session id from this
            browser. It takes effect immediately, not on your next visit.
          </p>

          <AnalyticsToggle />

          <p className="mt-4 text-sm text-gray-400">
            If your browser sends a &ldquo;Do Not Track&rdquo; signal we honour
            that too, and nothing is counted. We still offer the button, because
            a browser setting is not the same thing as you telling us directly.
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
            <li>
              To understand which pages, events and products people actually
              look at, so we book better and stock better. See{" "}
              <a
                href="#analytics"
                className="text-gold-500 hover:text-gold-400 underline"
              >
                how we count visits
              </a>
              .
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
            <li>
              <strong>Cloudflare</strong> &mdash; hosts Breazy Analytics, the
              second of the two visit counting systems described above. It
              receives only the usage information listed there and never
              receives your contact details or order details.
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
          <p className="mt-3">
            For the visit counting described above, Breazy Analytics keeps the
            individual records for <strong>three days</strong>. After that they
            are deleted automatically and only daily totals remain, which are
            counts with nothing in them about any one visitor. So rather than
            claiming we store nothing about you, which would not be true, the
            honest version is this:{" "}
            <strong>
              nothing about you survives three days, and nothing can be matched
              to you on another day or on another of our sites
            </strong>
            . Our own event tracking records are kept while they are useful for
            planning events and stock, and you can ask us to delete them.
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
            <li>
              Object to how we use your information. For visit counting you can
              do that yourself, right now, with the button under{" "}
              <a
                href="#analytics"
                className="text-gold-500 hover:text-gold-400 underline"
              >
                how we count visits
              </a>
              . We have nothing to weigh that objection against and it takes
              effect immediately.
            </li>
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
