import type { Event } from "@/lib/types";
import { SITE_URL, ORG_ID, jsonLdScript } from "@/lib/seo";

interface TicketLike {
  name: string;
  price_zar: number;
  quantity_total?: number;
  quantity_sold?: number | null;
  sale_start?: string | null;
  description?: string | null;
}

interface Props {
  event: Event & { tickets?: TicketLike[] };
  baseUrl?: string;
}

/**
 * JSON-LD structured data for an event, making it eligible for Google's event
 * rich results (date, venue, ticket price/availability).
 */
export default function EventJsonLd({ event, baseUrl }: Props) {
  const url = baseUrl || SITE_URL;
  const eventUrl = `${url}/events/${event.slug}`;

  // Ticket prices are stored in Rand (price_zar) and displayed as-is on the
  // event page, so the schema price must match that displayed value.
  const offers = (event.tickets || [])
    .filter((t) => t && t.name && Number.isFinite(t.price_zar))
    .map((t) => {
      const remaining =
        t.quantity_total != null
          ? Math.max(0, t.quantity_total - (t.quantity_sold || 0))
          : null;
      return {
        "@type": "Offer",
        name: t.name,
        price: String(t.price_zar),
        priceCurrency: "ZAR",
        availability:
          remaining === 0
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
        url: eventUrl,
        ...(t.sale_start ? { validFrom: t.sale_start } : {}),
      };
    });

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || undefined,
    startDate: event.date,
    // A past event is not "cancelled" — it was scheduled and took place.
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue_name || "Cape Town",
      address: event.venue_address || "Cape Town, South Africa",
    },
    image: event.cover_image_url
      ? [event.cover_image_url]
      : [`${url}/og-image.jpg`],
    organizer: {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "Tsakani Sessions",
      url,
    },
    url: eventUrl,
    ...(offers.length > 0 ? { offers } : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }}
    />
  );
}
