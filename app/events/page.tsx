import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, ArrowRight, Sparkles } from "lucide-react";
import { getPublishedEvents } from "@/lib/queries";
import { format, isPast } from "date-fns";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Upcoming Events & Past Highlights",
  description:
    "Browse upcoming Tsakani Sessions events in Cape Town and relive past nights. Amapiano, house, and live DJ experiences across South Africa.",
  alternates: { canonical: "/events" },
  openGraph: {
    title: "Tsakani Sessions Events — Cape Town DJ Experiences",
    description:
      "Upcoming Tsakani Sessions events and past highlights. Cape Town DJ entertainment, amapiano, and house nights.",
    url: "/events",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tsakani Sessions Events — Cape Town DJ Experiences",
    description:
      "Upcoming Tsakani Sessions events and past highlights across South Africa.",
  },
};

export default async function EventsPage() {
  const events = await getPublishedEvents();

  const upcomingEvents = events.filter((e) => !isPast(new Date(e.date)));
  const pastEvents = events.filter((e) => isPast(new Date(e.date)));

  return (
    <div>
      {/* Header */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="text-gold-gradient">Events</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            Upcoming experiences and past memories. Every Tsakani event is one
            for the books.
          </p>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="pb-16 sm:pb-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
            <Sparkles size={20} className="text-gold-500" />
            Upcoming
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className={`group block bg-dark-500 border rounded-2xl overflow-hidden transition-all duration-300 ${
                  event.is_featured
                    ? "border-gold-500/40 hover:border-gold-500/70 shadow-lg shadow-gold-500/5"
                    : "border-white/10 hover:border-gold-500/30"
                }`}
              >
                <div className="relative aspect-[4/3] bg-gradient-to-br from-gold-900/20 via-dark-500 to-dark-700 overflow-hidden">
                  {event.cover_image_url ? (
                    <Image
                      src={event.cover_image_url}
                      alt={event.title}
                      fill
                      sizes="(min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gold-500/30">
                      <Calendar size={64} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-700/90 via-dark-700/20 to-transparent" />
                  <div className="absolute top-4 left-4 bg-gold-gradient text-black px-3 py-1.5 rounded-lg shadow-lg">
                    <p className="text-xs font-bold uppercase tracking-wide">
                      {format(new Date(event.date), "MMM")}
                    </p>
                    <p className="text-2xl font-bold leading-none">
                      {format(new Date(event.date), "d")}
                    </p>
                  </div>
                  {event.is_featured && (
                    <span className="absolute top-4 right-4 bg-gold-gradient text-black text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1">
                      <Sparkles size={12} />
                      Featured
                    </span>
                  )}
                </div>

                <div className="p-5 sm:p-6">
                  <p className="text-gold-500/70 text-xs font-semibold uppercase tracking-wide mb-2">
                    {format(new Date(event.date), "EEEE, d MMMM yyyy")}
                    {" · "}
                    {format(new Date(event.date), "p")}
                  </p>

                  <h3 className="text-xl sm:text-2xl font-bold group-hover:text-gold-500 transition-colors mb-3">
                    {event.title}
                  </h3>

                  {event.venue_name && (
                    <p className="flex items-center gap-1.5 text-sm text-gray-400 mb-3">
                      <MapPin size={14} className="shrink-0 text-gold-500/70" />
                      <span className="truncate">{event.venue_name}</span>
                    </p>
                  )}

                  {event.description && (
                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  <span className="inline-flex items-center gap-1 text-gold-500 text-sm font-semibold mt-4 group-hover:gap-2 transition-all">
                    View details
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {upcomingEvents.length === 0 && (
            <div className="text-center py-16 bg-dark-500 rounded-2xl border border-white/10">
              <Calendar size={40} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                No upcoming events right now. Stay tuned!
              </p>
            </div>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div className="mt-16">
              <h2 className="text-2xl font-bold mb-8 text-gray-400">
                Past Events
              </h2>
              <div className="space-y-4">
                {pastEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-dark-500/50 border border-white/5 rounded-xl p-5 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-300">
                        {event.title}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        {format(new Date(event.date), "PPP")}
                        {event.venue_name && ` · ${event.venue_name}`}
                      </p>
                    </div>
                    <Link
                      href={`/gallery/${event.slug}`}
                      className="text-gold-500 text-sm hover:text-gold-400 flex items-center gap-1 transition-colors"
                    >
                      Gallery <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Newsletter CTA */}
          <div className="mt-16 bg-dark-500 border border-gold-500/20 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold mb-2">
              Never Miss a <span className="text-gold-500">Tsakani</span> Event
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Follow us on Instagram or join our WhatsApp channel for updates.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://instagram.com/tsakani_sessions"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gold-gradient text-black font-semibold px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity"
              >
                Follow on Instagram
              </a>
              <a
                href="https://youtube.com/@tsakanisessions?si=_bLUBTv9sImhsK4R"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-gold-500/40 text-gold-500 font-semibold px-6 py-2.5 rounded-full hover:bg-gold-500/10 transition-colors"
              >
                Subscribe on YouTube
              </a>
              <a
                href="https://www.tiktok.com/@tsakani_sessions?_r=1&_t=ZS-95aeaagWjob"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-gold-500/40 text-gold-500 font-semibold px-6 py-2.5 rounded-full hover:bg-gold-500/10 transition-colors"
              >
                Follow on TikTok
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
