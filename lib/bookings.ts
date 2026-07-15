/**
 * Booking enquiry validation, kept pure so it can be unit tested without a DB
 * or a request, the same way lib/ticketSync.ts is tested.
 *
 * A valid enquiry needs a name and at least one way to reach the person (email
 * or phone). Everything else is optional context.
 */

export interface BookingInput {
  name: string;
  email: string | null;
  phone: string | null;
  event_type: string | null;
  event_date: string | null;
  venue: string | null;
  message: string | null;
  captcha_token?: string;
}

export type BookingValidation =
  | { ok: true; value: BookingInput }
  | { ok: false; error: string };

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function validateBookingInput(body: unknown): BookingValidation {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Please fill in your details and try again." };
  }
  const b = body as Record<string, unknown>;

  const name = clean(b.name, 120);
  if (!name) {
    return { ok: false, error: "Please tell us your name." };
  }

  const email = clean(b.email, 254);
  const phone = clean(b.phone, 40);
  if (!email && !phone) {
    return {
      ok: false,
      error: "Add an email or a phone number so we can reach you.",
    };
  }
  if (email && (!email.includes("@") || email.length > 254)) {
    return { ok: false, error: "That email address does not look right." };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      phone,
      event_type: clean(b.event_type, 120),
      event_date: clean(b.event_date, 40),
      venue: clean(b.venue, 200),
      message: clean(b.message, 2000),
      captcha_token:
        typeof b.captcha_token === "string" ? b.captcha_token : undefined,
    },
  };
}
