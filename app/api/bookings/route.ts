import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-meta";
import { verifyTurnstile } from "@/lib/captcha";
import { sendAdminOrderAlert } from "@/lib/email";
import { validateBookingInput } from "@/lib/bookings";
import { resolveRequestedDj, type DjResolution } from "@/lib/djs";

/**
 * Saves a booking enquiry from /services before the form hands off to WhatsApp.
 *
 * Mirrors /api/newsletter: rate limit, then Turnstile, then write. We insert a
 * plain row without .select(): a RETURNING read-back would be refused by RLS for
 * anon visitors, since only admins hold a SELECT policy on booking_enquiries
 * (the same trap documented in create_ticket_order_fn.sql). We mint the id here
 * and insert it, so we can hand it back without reading the row.
 *
 * "Book this DJ" sends a slug and nothing else about the DJ. The DJ is looked
 * up here, and the id and name stored are the roster's own, never a name from
 * the request. A malformed slug is turned away. A slug that is not on the
 * roster (a DJ removed while the form was open) keeps the enquiry with no DJ
 * and a note saying who was asked for, because a lost lead costs more than a
 * missing DJ. The restrictive policy in supabase/djs.sql holds the same line
 * for anyone writing to the table directly.
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

  let requested: DjResolution;
  try {
    requested = await resolveRequestedDj(booking.dj, async (slug) => {
      const { data, error } = await supabase
        .from("djs")
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    });
  } catch (err) {
    console.error("[bookings] dj lookup failed:", (err as Error).message);
    return NextResponse.json(
      { error: "Could not save your booking. Please try again." },
      { status: 500 }
    );
  }
  if (!requested.ok && requested.reason === "malformed") {
    return NextResponse.json({ error: requested.error }, { status: 400 });
  }
  const dj = requested.ok ? requested.dj : null;
  // Only a well formed slug reaches here, so it is safe to quote.
  const djNote = requested.ok
    ? null
    : `Asked for DJ "${booking.dj}", who is not on the roster.`;
  const message =
    [booking.message, djNote].filter(Boolean).join("\n\n") || null;

  const id = crypto.randomUUID();
  const { error } = await supabase.from("booking_enquiries").insert({
    id,
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    event_type: booking.event_type,
    event_date: booking.event_date,
    venue: booking.venue,
    message,
    source: "services_form",
    requested_dj_id: dj?.id ?? null,
    requested_dj_name: dj?.name ?? null,
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
      dj && `DJ: ${dj.name}`,
      booking.event_date && `Date: ${booking.event_date}`,
      booking.venue && `Venue: ${booking.venue}`,
      message && `Notes: ${message}`,
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

  return NextResponse.json(djNote ? { ok: true, id, dj_not_found: true } : { ok: true, id });
}
