import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventDateShort, eventTime, isEventPast } from "@/lib/date";
import {
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Sparkles,
  Ticket as TicketIcon,
} from "lucide-react";
import { getEventBySlug } from "@/lib/queries";
import EventJsonLd from "@/components/EventJsonLd";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd";
import TicketCheckout from "@/components/TicketCheckout";

export const revalidate = 60;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tsakanisessions.co.za";
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "27769961477";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return {
      title: "Event not found",
      robots: { index: false, follow: false },
    };
  }

  const dateLabel = eventDateShort(event.date);
  const venue = event.venue_name ? ` · ${event.venue_name}` : "";
  const description =
    event.description ||
    `Join Tsakani Sessions on ${dateLabel}${venue}. DJ entertainment and live performance in Cape Town.`;
  const url = `${SITE_URL}/events/${event.slug}`;

  return {
    title: `${event.title} — ${dateLabel}`,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      title: event.title,
      description,
      url,
      type: "article",
      images: event.cover_image_url
        ? [{ url: event.cover_image_url, alt: event.title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: event.cover_image_url ? [event.cover_image_url] : undefined,
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const past = isEventPast(event.date) || event.status === "past";
  const externalTickets = !past && !!event.external_ticket_url;

  const inquiryMessage = encodeURIComponent(
    `Hi Tsakani Sessions! I'd like to know more about "${event.title}" on ${eventDateShort(
      event.date
    )}.`
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${inquiryMessage}`;

  return (
    <>
      <EventJsonLd event={event} baseUrl={SITE_URL} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Events", path: "/events" },
          { name: event.title, path: `/events/${event.slug}` },
        ]}
      />

      <article>
        {/* Hero */}
        <section className="relative">
          {event.cover_image_url ? (
            <div className="relative h-[280px] sm:h-[420px] w-full overflow-hidden">
              <Image
                src={event.cover_image_url}
                alt={event.title}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-700 via-dark-700/60 to-transparent" />
            </div>
          ) : (
            <div className="h-[200px] sm:h-[260px] bg-gradient-to-br from-gold-900/20 via-dark-500 to-dark-700" />
          )}

          <div className="max-w-4xl mx-auto px-4 -mt-16 sm:-mt-24 relative">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-gold-500 text-sm mb-4 transition-colors"
            >
              <ArrowLeft size={16} />
              All events
            </Link>

            <div className="bg-dark-500 border border-white/10 rounded-2xl p-6 sm:p-10">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {event.is_featured && (
                  <span className="bg-gold-gradient text-black text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1">
                    <Sparkles size={12} />
                    Featured
                  </span>
                )}
                {past && (
                  <span className="bg-white/5 text-gray-400 text-xs font-semibold px-3 py-1 rounded-full">
                    Past event
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold mb-6">
                {event.title}
              </h1>

              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="flex items-start gap-3">
                  <Calendar size={20} className="text-gold-500 shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                      Date
                    </dt>
                    <dd className="text-sm text-gray-200">
                      {eventDateShort(event.date)}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock size={20} className="text-gold-500 shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                      Time
                    </dt>
                    <dd className="text-sm text-gray-200">
                      {eventTime(event.date)}
                    </dd>
                  </div>
                </div>

                {event.venue_name && (
                  <div className="flex items-start gap-3">
                    <MapPin size={20} className="text-gold-500 shrink-0 mt-0.5" />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                        Venue
                      </dt>
                      <dd className="text-sm text-gray-200">
                        {event.venue_name}
                      </dd>
                      {event.venue_address && (
                        <dd className="text-xs text-gray-500 mt-0.5">
                          {event.venue_address}
                        </dd>
                      )}
                    </div>
                  </div>
                )}
              </dl>

              {event.description && (
                <div className="prose prose-invert max-w-none mb-8">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                    {event.description}
                  </p>
                </div>
              )}

              {/* Tickets via external ticketing partner */}
              {externalTickets && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <TicketIcon size={18} className="text-gold-500" />
                    Tickets
                  </h2>

                  {event.tickets && event.tickets.length > 0 && (
                    <div className="space-y-3 mb-5">
                      {event.tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="bg-dark-700 border border-white/10 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white">{ticket.name}</h3>
                            {ticket.description && (
                              <p className="text-sm text-gray-400 mb-1">
                                {ticket.description}
                              </p>
                            )}
                          </div>
                          <p className="text-gold-500 text-lg font-bold shrink-0">
                            R{ticket.price_zar.toLocaleString("en-ZA")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <a
                    href={event.external_ticket_url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-track="ticket_external_click"
                    data-track-props={JSON.stringify({ event: event.slug })}
                    className="bg-gold-gradient text-black font-semibold px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity w-full sm:w-auto"
                  >
                    <TicketIcon size={16} />
                    Buy Tickets
                  </a>
                  <p className="text-xs text-gray-500 mt-3 italic">
                    Tickets are sold through our ticketing partner. The Buy Tickets button opens their secure checkout in a new tab.
                  </p>
                </div>
              )}

              {/* Tickets */}
              {!externalTickets && !past && event.tickets && event.tickets.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <TicketIcon size={18} className="text-gold-500" />
                    Tickets
                  </h2>
                  <div className="space-y-3">
                    {event.tickets.map((ticket) => {
                      const remaining = Math.max(
                        0,
                        ticket.quantity_total - (ticket.quantity_sold || 0),
                      );
                      const soldOut = remaining === 0;
                      return (
                        <div
                          key={ticket.id}
                          className="bg-dark-700 border border-white/10 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-white">{ticket.name}</h3>
                              {soldOut && (
                                <span className="text-xs font-bold uppercase tracking-wide text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                                  Sold out
                                </span>
                              )}
                              {!soldOut && remaining <= 10 && (
                                <span className="text-xs font-bold uppercase tracking-wide text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                                  Only {remaining} left
                                </span>
                              )}
                            </div>
                            {ticket.description && (
                              <p className="text-sm text-gray-400 mb-1">
                                {ticket.description}
                              </p>
                            )}
                            <p className="text-gold-500 text-lg font-bold">
                              R{ticket.price_zar.toLocaleString("en-ZA")}
                            </p>
                          </div>
                          {soldOut ? (
                            <button
                              type="button"
                              disabled
                              className="bg-white/5 text-gray-500 font-semibold px-5 py-2.5 rounded-full cursor-not-allowed"
                            >
                              Sold out
                            </button>
                          ) : (
                            <TicketCheckout
                              ticketId={ticket.id}
                              ticketName={ticket.name}
                              priceZar={ticket.price_zar}
                              eventTitle={event.title}
                              eventSlug={event.slug}
                              eventDateLabel={eventDateShort(event.date)}
                              whatsappNumber={WHATSAPP_NUMBER}
                              // Read in South African time, matching the check
                              // the database does. A 01:00 event on the 1st is
                              // stored as the previous day in UTC, and the raw
                              // month would put it in the wrong one.
                              eventMonth={
                                Number(
                                  new Intl.DateTimeFormat("en-ZA", {
                                    timeZone: "Africa/Johannesburg",
                                    month: "numeric",
                                  }).format(new Date(event.date))
                                ) || undefined
                              }
                              birthdayPackage={event.birthday_package !== false}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-3 italic">
                    Reserve your spot and we&apos;ll send your order number and QR code straight to your email.
                  </p>
                </div>
              )}

              {!externalTickets && !past && (!event.tickets || event.tickets.length === 0) && (
                <div className="mb-8 bg-gold-500/5 border border-gold-500/20 rounded-xl p-4 text-center">
                  <p className="text-gold-500 font-semibold">Free Entry</p>
                  <p className="text-xs text-gray-400 mt-1">No ticket required &mdash; just pull up.</p>
                </div>
              )}

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
                {past ? (
                  <Link
                    href={`/gallery/${event.slug}`}
                    className="bg-gold-gradient text-black font-semibold px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    View Gallery
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-track="event_enquiry"
                    data-track-props={JSON.stringify({ event: event.slug })}
                    className="border border-gold-500/40 text-gold-500 font-semibold px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 hover:bg-gold-500/10 transition-colors"
                  >
                    <MessageCircle size={16} />
                    General enquiry
                  </a>
                )}

                <Link
                  href="/events"
                  className="border border-white/10 text-gray-300 font-semibold px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
                >
                  Other events
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer spacing */}
        <div className="h-24" />
      </article>
    </>
  );
}
