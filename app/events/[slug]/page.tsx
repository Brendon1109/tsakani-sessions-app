import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, isPast } from "date-fns";
import {
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { getEventBySlug } from "@/lib/queries";
import EventJsonLd from "@/components/EventJsonLd";

export const revalidate = 60;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tsakanisessions.co.za";
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "27769961477";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const event = await getEventBySlug(params.slug);
  if (!event) {
    return {
      title: "Event not found",
      robots: { index: false, follow: false },
    };
  }

  const dateLabel = format(new Date(event.date), "PPP");
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
  params: { slug: string };
}) {
  const event = await getEventBySlug(params.slug);
  if (!event) notFound();

  const eventDate = new Date(event.date);
  const past = isPast(eventDate) || event.status === "past";

  const inquiryMessage = encodeURIComponent(
    `Hi Tsakani Sessions! I'd like to know more about "${event.title}" on ${format(
      eventDate,
      "PPP"
    )}.`
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${inquiryMessage}`;

  return (
    <>
      <EventJsonLd event={event} baseUrl={SITE_URL} />

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
                      {format(eventDate, "PPP")}
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
                      {format(eventDate, "p")}
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
                    className="bg-gold-gradient text-black font-semibold px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <MessageCircle size={16} />
                    Enquire on WhatsApp
                  </a>
                )}

                <Link
                  href="/events"
                  className="border border-gold-500/40 text-gold-500 font-semibold px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 hover:bg-gold-500/10 transition-colors"
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
