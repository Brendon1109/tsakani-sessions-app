import type { Metadata } from "next";
import Link from "next/link";
import AnalyticsToggle from "./AnalyticsToggle";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Tsakani Sessions collects, uses, and shares your personal information, including how we count visits and how to turn that off.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "29 October 2026";

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

        {/* Wording from legal/tsakani-bat-rush-popia-2026-10-29.md in Breazy. */}
        <section id="bat-rush" className="scroll-mt-24">
          <h2 className="text-xl font-semibold text-white mb-3">
            Bat Rush, our Halloween game
          </h2>
          <p>
            Bat Rush is our phone game at tsakanisessions.co.za/halloween, made
            for the Tsakani Halloween party at The Barn, UWC, on 31 October 2026.
            Anyone can play without signing in. We save nothing about you unless
            you choose to save a score. Saving a score is for people aged 18 and
            over.
          </p>

          <h3 className="font-semibold text-white mt-5 mb-2">
            What we keep when you save a score
          </h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Your first name and the first letter of your surname, taken from
              your Google account, like &ldquo;Thabo M.&rdquo;.
            </li>
            <li>Your scores and when you saved them.</li>
            <li>
              Your Instagram handle, if you give one, and whether you ticked
              &ldquo;Show my @ on the board&rdquo;.
            </li>
          </ul>
          <p className="mt-3">
            To save, you sign in with Google, which gives us your name, email
            address and profile photo.
          </p>
          <p className="mt-3">
            Our own event tracking also counts what happens in the game: a game
            started, a game finished with a rough score range, sign in tapped,
            score saved, Instagram tapped and story shared. None of this is saved
            with your name or your account. See{" "}
            <a
              href="#analytics"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              how we count visits
            </a>
            .
          </p>

          <h3 className="font-semibold text-white mt-5 mb-2">Who sees what</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              The leaderboard is public and shows the top 10 of each round. It
              shows your @ only if you ticked the box. Otherwise it shows your
              first name and initial. It never shows your email.
            </li>
            <li>
              We may post a picture of each round&rsquo;s top 3 on our
              Instagram. It shows the same names as the board.
            </li>
            <li>
              If you win a round, we may tag your @ in our
              Instagram posts, even if you didn&rsquo;t tick the box. That&rsquo;s
              why we ask for it.
            </li>
            <li>
              Our team sees your full Google name, your email and your handle on
              our admin page, so we can find the winners on the night. Our team
              can also download a list of handles and best scores, with no names
              or emails. We use it only to find and tag winners, never to send
              you marketing.
            </li>
          </ul>

          <h3 className="font-semibold text-white mt-5 mb-2">If you win</h3>
          <p>
            We may film or photograph round winners and post it on our
            Instagram, @tsakani_sessions, with the winner tagged. We&rsquo;ll
            ask you first. If you don&rsquo;t want to be in it, say so. You still
            win.
          </p>

          <h3 className="font-semibold text-white mt-5 mb-2">
            Where it&rsquo;s stored
          </h3>
          <p>
            Game information is stored in our Supabase database in Ireland. The
            site runs on Cloudflare, and Google runs the sign in.
          </p>

          <h3 className="font-semibold text-white mt-5 mb-2">
            How long we keep it
          </h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Your handle, your name on the board and your scores are deleted by
              30 November 2026.
            </li>
            <li>
              Your sign in account stays until you ask us to delete it, because
              it&rsquo;s the same account you use on the rest of the site.
            </li>
            <li>
              Posts and videos on Instagram stay up after 30 November. Ask us and
              we&rsquo;ll take down a video of you or remove your tag.
            </li>
          </ul>

          <h3 className="font-semibold text-white mt-5 mb-2">
            Removing it sooner
          </h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Right after you save, tap &ldquo;Change my @&rdquo; to change your
              handle, remove it or untick the box.
            </li>
            <li>
              Any other time, email{" "}
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
              with the name or @ you played under. We&rsquo;ll delete your handle
              and scores, or your whole account if you ask, and tell you when
              it&rsquo;s done.
            </li>
          </ul>
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
              <strong>Cloudflare</strong> &mdash; website hosting, so it
              carries everything you send us through the site. It also hosts
              Breazy Analytics, the second of the two visit counting systems
              described above.
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
