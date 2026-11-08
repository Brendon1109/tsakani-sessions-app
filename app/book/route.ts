import { NextResponse } from "next/server";
import { hasUpcomingEvents } from "@/lib/queries";
import { BOOKING_ENQUIRY_URL } from "@/lib/whatsapp";

// Decided on every click, never cached: an event published this afternoon
// should turn Book Now back into tickets straight away.
export const dynamic = "force-dynamic";

/**
 * Book Now in the header. With an event coming up it goes to /events, where
 * the tickets are. With none it goes to the WhatsApp booking chat, because
 * /events would only say there is nothing on, a dead end for someone who
 * wanted to book.
 *
 * Decided here rather than in the header. The header sits in the root layout,
 * so asking the database there would cost a query on every page view and make
 * the static pages render per request. Here it costs one query per click. The
 * header links to this with a plain <a>, so no page prefetches it.
 *
 * When the database cannot be asked, hasUpcomingEvents says no and the visitor
 * gets WhatsApp, which always works.
 */
export async function GET(request: Request) {
  const destination = (await hasUpcomingEvents())
    ? new URL("/events", request.url)
    : BOOKING_ENQUIRY_URL;
  // no-store so neither a browser nor Cloudflare keeps an old answer.
  return NextResponse.redirect(destination, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}
