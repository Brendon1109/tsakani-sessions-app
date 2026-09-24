import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-meta";
import { verifyTurnstile } from "@/lib/captcha";
import { sendAdminOrderAlert } from "@/lib/email";
import { validateBookingInput } from "@/lib/bookings";

/**
 * Saves a booking enquiry from /services before the form hands off to WhatsApp.
 *
 * Mirrors /api/newsletter: rate limit, then Turnstile, then write. We insert a
 * plain row without .select(): a RETURNING read-back would be refused by RLS for
 * anon visitors, since only admins hold a SELECT policy on booking_enquiries
 * (the same trap documented in create_ticket_order_fn.sql). We mint the id here
 * and insert it, so we can hand it back without reading the row.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 enquiries per 10 min per IP.
  const limited = await rateLimit(request, "bookings", 5, 600);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = validateBookingInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const booking = parsed.value;

  const ip = clientIp(request.headers) ?? undefined;
  const captchaOk = await verifyTurnstile(booking.captcha_token, ip);
  if (!captchaOk) {
    return NextResponse.json({ error: "CAPTCHA failed" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const id = crypto.randomUUID();
  const { error } = await supabase.from("booking_enquiries").insert({
    id,
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    event_type: booking.event_type,
    event_date: booking.event_date,
    venue: booking.venue,
    message: booking.message,
    source: "services_form",
  });

  if (error) {
    console.error("[bookings] insert failed:", error.message);
    return NextResponse.json(
      { error: "Could not save your booking. Please try again." },
      { status: 500 }
    );
  }

  // Tell the team a real booking landed. Best effort, the enquiry is already
  // saved and must not fail because of the email.
  const summary =
    [
      booking.event_type && `Service: ${booking.event_type}`,
      booking.event_date && `Date: ${booking.event_date}`,
      booking.venue && `Venue: ${booking.venue}`,
      booking.message && `Notes: ${booking.message}`,
    ]
      .filter(Boolean)
      .join("\n") || "New booking enquiry";

  sendAdminOrderAlert({
    type: "booking",
    customerName: booking.name,
    customerPhone: booking.phone || "N/A",
    customerEmail: booking.email,
    summary,
    orderId: id,
  }).catch(() => {});

  return NextResponse.json({ ok: true, id });
}
