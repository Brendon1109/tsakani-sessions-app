import Link from "next/link";
import { Calendar, MapPin, Clock, ArrowRight, Sparkles } from "lucide-react";
import { getPublishedEvents } from "@/lib/queries";
import { format, isPast } from "date-fns";

export const revalidate = 60;

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
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
            <Sparkles size={20} className="text-gold-500" />
            Upcoming
          </h2>

          <div className="space-y-6">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className={`group block bg-dark-500 border rounded-2xl overflow-hidden transition-all duration-300 ${
                  event.is_featured
                    ? "border-gold-500/30 bg-gradient-to-r from-dark-500 to-gold-900/10"
                    : "border-white/10 hover:border-gold-500/20"
                }`}
              >
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                    <div className="bg-gold-500/10 rounded-xl p-4 text-center sm:min-w-[100px]">
                      <Calendar
                        size={24}
                        className="text-gold-500 mx-auto mb-1"
                      />
                      <p className="text-gold-500 text-sm font-bold">
                        {format(new Date(event.date), "MMM d")}
                      </p>
                      <p className="text-gold-500/70 text-xs">
                        {format(new Date(event.date), "yyyy")}
                      </p>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-xl sm:text-2xl font-bold group-hover:text-gold-500 transition-colors">
                          {event.title}
                        </h3>
                        {event.is_featured && (
                          <span className="shrink-0 bg-gold-gradient text-black text-xs font-bold px-3 py-1 rounded-full">
                            Featured
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-3">
                        {event.venue_name && (
                          <span className="flex items-center gap-1.5">
                            <MapPin size={14} />
                            {event.venue_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Clock size={14} />
                          {format(new Date(event.date), "p")}
                        </span>
                      </div>

                      {event.description && (
                        <p className="text-gray-400 text-sm leading-relaxed">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
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
