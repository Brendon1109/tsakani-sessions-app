import type { Event } from "@/lib/types";

interface Props {
  event: Event;
  baseUrl?: string;
}

/**
 * JSON-LD structured data for an event, makes it eligible for
 * Google's event rich results (shows up in search with date/venue).
 */
export default function EventJsonLd({ event, baseUrl }: Props) {
  const url = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://tsakani-sessions-app.vercel.app";

  const schema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: event.date,
    eventStatus: event.status === "past" ? "EventCancelled" : "EventScheduled",
    eventAttendanceMode: "OfflineEventAttendanceMode",
    location: event.venue_name
      ? {
          "@type": "Place",
          name: event.venue_name,
          address: event.venue_address || "Cape Town, South Africa",
        }
      : {
          "@type": "Place",
          name: "Cape Town",
          address: "Cape Town, South Africa",
        },
    image: event.cover_image_url
      ? [event.cover_image_url]
      : [`${url}/images/tsakani-logo.png`],
    organizer: {
      "@type": "Organization",
      name: "Tsakani Sessions",
      url,
    },
    url: `${url}/events/${event.slug}`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
