import type { Metadata } from "next";
import Link from "next/link";
import AnalyticsToggle from "./AnalyticsToggle";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Tsakani Sessions collects, uses, and shares your personal information, including how we count visits and how to turn that off.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "11 October 2026";

const linkClass = "text-gold-500 hover:text-gold-400 underline";

function Code({ children }: { children: React.ReactNode }) {
  return <code className="text-gold-500">{children}</code>;
}

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
            Cape Town, South Africa. This page explains what personal
            information we collect, why, who else handles it and how long we
            keep it. We follow the Protection of Personal Information Act, 2013
            (POPIA).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            What we collect
          </h2>
          <p>We only collect what we need for the thing you are doing.</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              <strong>Merch orders.</strong> Your name and phone number, your
              email if you give it, what you ordered and how you chose to pay.
            </li>
            <li>
              <strong>Tickets.</strong> Your name and email, your phone number
              if you give it, the event and how many tickets. If you give us
              your birthday month and day, we use them to check whether you
              qualify for our birthday package. At the door we may ask to see
              your ID to confirm the birthday. We only record that it was
              checked. We do not copy or keep your ID.
            </li>
            <li>
              <strong>Booking enquiries.</strong> When you use &ldquo;Book this
              DJ&rdquo; or the services form, we save your name, your email or
              phone number, the type of event, the date, the venue, your message
              and which DJ you asked for. Then we open WhatsApp with your enquiry
              so you can send it to us.
            </li>
            <li>
              <strong>Email updates.</strong> Your email address, which updates
              you ticked (events, merch or both) and when you signed up.
            </li>
            <li>
              <strong>Signing in.</strong> Sign in is with Google only. Our team
              uses it, and so do visitors who want to see full photo galleries.
              Google gives us your name, email address and profile picture.
            </li>
            <li>
              <strong>Your IP address.</strong> Used briefly for security. See
              the next section.
            </li>
            <li>
              <strong>How the site is used.</strong> Pages opened and time on
              screen. This is set out in full under &ldquo;How we count
              visits&rdquo;, and you can turn it off there.
            </li>
          </ul>
          <p className="mt-3">
            We do not collect ID numbers, passport numbers or card details. If
            you pay by card, you type your card details on Paystack&rsquo;s
            page, not ours. If you pay by EFT, we see your payment and reference
            on our bank statement.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Your IP address
          </h2>
          <p>
            Every website gets your IP address when you visit. Ours goes to
            Cloudflare, the company that runs the site. We use it in the moment
            to:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              work out your rough location, at city level only, for counting
              visits,
            </li>
            <li>slow down anyone sending too many requests, and</li>
            <li>
              make the daily counting value described under &ldquo;How we count
              visits&rdquo;.
            </li>
          </ul>
          <p className="mt-3">
            To slow down abuse we keep a scrambled version of your IP address
            for up to 10 minutes, then delete it. Our database never stores your
            IP address itself. Cloudflare&rsquo;s request logs for the site can
            include it, and those logs are deleted after 3 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            DJ pages and event photos
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Our DJs.</strong> Each DJ on our roster has a public page
              with their DJ name, a photo, their genres, a short description and
              links to their YouTube, TikTok, Instagram and SoundCloud. Our DJs
              are our crew and appear with their agreement. A DJ can ask us to
              change or remove their page at any time.
            </li>
            <li>
              <strong>YouTube videos.</strong> A DJ page can show that
              DJ&rsquo;s Tsakani set from YouTube. We use YouTube&rsquo;s privacy
              enhanced player, and nothing loads from YouTube or Google until you
              tap play. Once you tap play, YouTube&rsquo;s own privacy policy
              applies to that video.
            </li>
            <li>
              <strong>Pictures on DJ pages.</strong> DJ photos and video
              thumbnails come from our own site address, so your browser does not
              contact YouTube just to show a picture.
            </li>
            <li>
              <strong>Links out.</strong> A DJ&rsquo;s social links take you to
              that platform, and its own privacy policy applies there.
            </li>
            <li>
              <strong>Event photos.</strong> We take photos at our events and
              share them in galleries on this site. Full galleries need a Google
              sign in. If you are in a photo and want it removed, message us and
              we will take it down.
            </li>
          </ul>
        </section>

        <section id="analytics" className="scroll-mt-24">
          <h2 className="text-xl font-semibold text-white mb-3">
            How we count visits
          </h2>
          <p>
            We measure how this site is used so we know which events, tickets,
            DJs and merch people actually look at, and whether the site is
            working. We do this ourselves. There is no Google Analytics here, no
            Meta pixel and no advertising tracker of any kind.
          </p>
          <p className="mt-3">
            There are <strong>two</strong> separate systems doing it, and we
            would rather name both than let you assume there was only one.
          </p>

          <h3 className="text-lg font-semibold text-white mt-6 mb-2">
            1. Our own event tracking
          </h3>
          <p>
            This one tells us what happened on the site. When you open a page or
            tap something we care about, like a ticket link, a product or
            &ldquo;Book this DJ&rdquo;, it records that. It stores:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              A <strong>random session id</strong>, kept in your browser&rsquo;s
              storage under the name <Code>ts_sid</Code>. It is made on your
              device and is not linked to your name, your email or any account.
            </li>
            <li>The page addresses you open on this site.</li>
            <li>
              What you tapped, plus a little detail about it, like which event,
              product or DJ. Never your name or contact details.
            </li>
            <li>
              A rough location, at <strong>city level only</strong> (city,
              region, country).
            </li>
            <li>Whether you are on a phone, a tablet or a computer.</li>
            <li>
              The <strong>website that sent you here</strong>, its address only.
              If you came from a search, we never see what you searched for.
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-white mt-6 mb-2">
            2. Breazy Analytics
          </h3>
          <p>
            This one counts visits and time on screen, and lets us compare this
            site with the other sites we run, which the first system cannot do.
            It stores:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              A cookie named <Code>_bza</Code> with{" "}
              <strong>no identifier in it</strong>. It holds three things: the
              date you first visited, how many separate days you have visited,
              and the date you were last here. Two people with the same visit
              history carry the same cookie. It lasts up to two years.
            </li>
            <li>
              A <strong>daily counting value</strong>. This is the one part that
              is about you rather than about the page. It is a scrambled value
              made from your IP address, your browser and the date. We keep only
              the scrambled result, never your IP address. It{" "}
              <strong>changes every day at 2am South African time</strong> and
              is scrambled differently on each site we run, so it cannot follow
              you from one day to the next or from this site to another. Within
              one day it links your page views together, which is the only way
              to count people rather than pages.
            </li>
            <li>The page addresses you open on this site.</li>
            <li>
              How many seconds a page was <strong>actually on screen</strong>.
              Time while the page is hidden behind another app or tab is not
              counted.
            </li>
            <li>A rough location, at city level only.</li>
            <li>Your device type and which browser you use.</li>
            <li>The website that sent you here, its address only.</li>
          </ul>
          <p className="mt-3">
            Breazy Analytics runs on Cloudflare, and its records are stored in
            Cloudflare&rsquo;s Western Europe region.
          </p>

          <h3 className="text-lg font-semibold text-white mt-6 mb-2">
            What neither one keeps
          </h3>
          <p>
            Neither system stores your IP address, your name, your email, your
            phone number or your exact location. Neither is shared with an
            advertising network or sold to anyone.
          </p>
          <p className="mt-3">
            Both systems <strong>clean page addresses before storing them</strong>
            . Your ticket links contain a private code that proves the ticket is
            yours, so anything in an address that looks like a code is replaced
            first. We would rather lose a little detail in our reports than keep
            a live ticket code in a list of pages.
          </p>

          <h3 className="text-lg font-semibold text-white mt-6 mb-2">
            Why we are allowed to do this
          </h3>
          <p>
            Both systems run on our <strong>legitimate interest</strong> under
            section 11(1)(f) of POPIA, not on your consent. In plain terms: we
            need to know whether the site works, the information is low risk and
            does not name you, and we judged that this does not outweigh your
            privacy. You are entitled to disagree, and the next part is how.
          </p>

          <h3 className="text-lg font-semibold text-white mt-6 mb-2">
            Turning it off
          </h3>
          <p>
            Section 11(3) of POPIA gives you the right to object to this. Under
            section 11(4), once you object we stop. There is{" "}
            <strong>nothing for us to weigh your objection against</strong>. The
            button below is that objection. It switches off{" "}
            <strong>both</strong> systems, deletes the <Code>_bza</Code> cookie
            and the <Code>ts_sid</Code> session id from this browser, and works
            straight away.
          </p>
          <p className="mt-3 mb-4">
            When you turn it off, we leave one small cookie,{" "}
            <Code>bz_optout</Code>, so the site remembers your choice. It holds
            no identifier and lasts up to two years.
          </p>

          <AnalyticsToggle />

          <p className="mt-4 text-sm text-gray-400">
            If your browser sends a &ldquo;Do Not Track&rdquo; signal, we honour
            that too and nothing is counted. We still offer the button, because
            a browser setting is not the same as you telling us directly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            How we use it
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              To process and confirm your orders, tickets and bookings, and to
              email you your ticket or order.
            </li>
            <li>
              To check birthday package bookings, if you gave us your birthday.
            </li>
            <li>
              To send you event or merch news,{" "}
              <strong>only if you ticked that box</strong>. Every email has an
              unsubscribe link.
            </li>
            <li>To reply to you on WhatsApp or email.</li>
            <li>To keep the site secure and stop abuse.</li>
            <li>To show our DJs and our event photos.</li>
            <li>
              To understand which pages, events, DJs and products people look
              at, so we book better and stock better. See{" "}
              <a href="#analytics" className={linkClass}>
                how we count visits
              </a>
              .
            </li>
          </ul>
          <p className="mt-3">
            We use your order, ticket and booking details because you asked us
            to do something for you. We send email news because you agreed to
            it. We count visits on our legitimate interest, explained above.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Who else handles your information
          </h2>
          <p>
            We do not sell your information. We do not share your email or
            phone number with partners, venues or brands for their own
            marketing.
          </p>
          <p className="mt-3">
            These companies help us run the site. Each one gets only what it
            needs to do its job:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              <strong>Cloudflare</strong> (Cloudflare, Inc., United States).
              Runs the website on its global network. Every page and every form
              passes through it, including your name, email, phone number, order
              details and IP address. It keeps short request logs, deleted after
              3 days, and it hosts Breazy Analytics. If a form shows a
              &ldquo;verify you are human&rdquo; check, that is Cloudflare
              Turnstile.
            </li>
            <li>
              <strong>Supabase</strong>. Our database, sign in and photo
              storage, hosted in Ireland.
            </li>
            <li>
              <strong>Resend</strong>. Sends our emails: ticket and order
              confirmations, signup and unsubscribe confirmations, and alerts to
              our team.
            </li>
            <li>
              <strong>Google</strong>. Runs Google sign in. Alerts about new
              orders, tickets and bookings also arrive in our Gmail inbox.
            </li>
            <li>
              <strong>Paystack</strong>. If you choose to pay by card, we send
              Paystack your name, your email and the amount, so the payment page
              is filled in for you. Paystack&rsquo;s privacy policy applies on
              its page.
            </li>
            <li>
              <strong>WhatsApp (Meta)</strong>. If you message us on WhatsApp,
              or we message you there about your order or ticket, Meta&rsquo;s
              terms and privacy policy apply to those messages.
            </li>
            <li>
              <strong>YouTube (Google)</strong>. Only if you tap play on a DJ
              video.
            </li>
          </ul>
          <p className="mt-3">
            Until 24 September 2026 the site ran on Vercel. That account is
            being closed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Information that leaves South Africa
          </h2>
          <p>
            Some of these companies store or handle your information outside
            South Africa. Our database is in Ireland. Cloudflare, Resend, Google
            and Meta work from the United States and other countries. Section 72
            of POPIA allows this when the company receiving your information is
            bound by laws or agreements that protect it about as well as POPIA
            does. Supabase in Ireland is covered by EU data protection law. For
            the others, we rely on their data protection terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            Cookies and storage on your device
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <Code>_bza</Code>. The Breazy Analytics visit cookie, described
              above. Up to two years.
            </li>
            <li>
              <Code>bz_optout</Code>. Only set if you turn counting off.
              Remembers your choice. Up to two years.
            </li>
            <li>
              <Code>ts_sid</Code>. The session id for our own event tracking.
              Stays in your browser until you clear it or turn counting off.
            </li>
            <li>
              <strong>Sign in cookies.</strong> Only if you sign in with Google.
              They keep you signed in.
            </li>
          </ul>
          <p className="mt-3">
            The site can be installed on your phone, and it keeps copies of
            pages on your device so it loads faster. We do not use advertising
            cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">
            How long we keep it
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Orders and tickets:</strong> five years after the sale,
              because tax law asks us to keep sale records that long.
            </li>
            <li>
              <strong>Booking enquiries:</strong> two years after we last spoke,
              then deleted.
            </li>
            <li>
              <strong>Email updates:</strong> until you unsubscribe. After that
              we keep your address marked as unsubscribed so we never email you
              by mistake. Ask us and we will delete it completely.
            </li>
            <li>
              <strong>Sign in accounts:</strong> until you ask us to delete
              yours.
            </li>
            <li>
              <strong>DJ pages:</strong> while the DJ is on our roster.
            </li>
            <li>
              <strong>Event photos:</strong> while the gallery is up, or until
              you ask us to remove a photo of you.
            </li>
            <li>
              <strong>Scrambled IP for abuse protection:</strong> up to 10
              minutes.
            </li>
            <li>
              <strong>Cloudflare request logs:</strong> 3 days.
            </li>
            <li>
              <strong>Our own event tracking:</strong> 12 months, then deleted.
            </li>
            <li>
              <strong>Breazy Analytics:</strong> individual records for{" "}
              <strong>three days</strong>, then they are deleted automatically
              and only daily totals remain, which say nothing about any one
              visitor. So rather than claim we store nothing about you, which
              would not be true, the honest version is this:{" "}
              <strong>
                nothing about you survives three days, and nothing can be
                matched to you on another day or on another of our sites.
              </strong>
            </li>
          </ul>
          <p className="mt-3">
            You can ask us to delete your information at any time. The only
            thing we may have to keep is a sale record the law requires.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Your rights</h2>
          <p>Under POPIA you can:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Ask what information we hold about you.</li>
            <li>Ask us to correct it or delete it.</li>
            <li>
              Withdraw your consent to email news at any time. Every email has an
              unsubscribe link.
            </li>
            <li>
              Object to how we use your information. For visit counting you can
              do that yourself, right now, with the button under{" "}
              <a href="#analytics" className={linkClass}>
                how we count visits
              </a>
              . It takes effect immediately.
            </li>
            <li>
              Complain to the Information Regulator of South Africa (
              <a
                href="https://inforegulator.org.za"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
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
            <a href="mailto:tsakanisessions@gmail.com" className={linkClass}>
              tsakanisessions@gmail.com
            </a>{" "}
            or WhatsApp{" "}
            <a
              href="https://wa.me/27769961477"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              +27 76 996 1477
            </a>{" "}
            for any privacy request.
          </p>
        </section>

        <section className="pt-4 border-t border-white/10">
          <p className="text-sm text-gray-500">
            See also:{" "}
            <Link href="/terms" className={linkClass}>
              Terms of Service
            </Link>{" "}
            ·{" "}
            <Link href="/refund-policy" className={linkClass}>
              Refund Policy
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
