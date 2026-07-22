import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { planTicketSync, type TicketSyncPlan } from "@/lib/ticketSync";

/**
 * Turn a sale window value from the admin form into a stored instant.
 *
 * The form sends a datetime-local string, which carries no zone, so the
 * browser has already converted it to a real ISO instant before posting.
 * Empty string means "no bound", which must persist as SQL NULL rather
 * than an invalid date.
 */
function normaliseInstant(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function requireAdmin() {
  const supabase = createClient();
  if (!supabase) return { supabase: null, user: null, email: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, email: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();
  return {
    supabase,
    user: profile?.role === "admin" ? user : null,
    email: profile?.email || null,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Validate the optional external ticket link. Empty becomes null; a non-empty
// value must be a valid http(s) URL. Never hardcode a specific URL: this is data
// the admin pastes.
function normalizeUrl(
  value: unknown,
  label = "External ticket link",
): { url: string | null } | { error: string } {
  if (value == null || value === "") return { url: null };
  if (typeof value !== "string") return { error: `${label} must be text` };
  const trimmed = value.trim();
  if (!trimmed) return { url: null };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: `${label} must be a valid URL` };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: `${label} must start with http or https` };
  }
  return { url: trimmed };
}

const normalizeTicketUrl = (value: unknown) => normalizeUrl(value, "External ticket link");
const normalizePaymentUrl = (value: unknown) => normalizeUrl(value, "Payment link");

// The payment note reaches buyers verbatim in an email, so it is capped. An
// unbounded field here would be a way to push arbitrary bulk text through our
// sending domain.
function normalizePaymentNote(value: unknown): { note: string | null } | { error: string } {
  if (value == null || value === "") return { note: null };
  if (typeof value !== "string") return { error: "Payment instructions must be text" };
  const trimmed = value.trim();
  if (!trimmed) return { note: null };
  if (trimmed.length > 1000) {
    return { error: "Payment instructions must be under 1000 characters" };
  }
  return { note: trimmed };
}

async function executeTicketPlan(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  eventId: string,
  plan: TicketSyncPlan,
): Promise<{ error?: string; status?: number }> {
  const { toDelete, toUpdate, toInsert } = plan;

  for (const ticket of [...toUpdate, ...toInsert]) {
    const start = normaliseInstant(ticket.sale_start);
    const end = normaliseInstant(ticket.sale_end);
    if (start && end && new Date(end) <= new Date(start)) {
      return {
        error: `Ticket "${ticket.name?.trim()}" closes before it opens. Check the sale window.`,
        status: 400,
      };
    }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase.from("tickets").delete().in("id", toDelete);
    if (error) return { error: error.message, status: 500 };
  }

  for (const ticket of [...toUpdate, ...toInsert]) {
    const payload = {
      event_id: eventId,
      name: ticket.name!.trim(),
      price_zar: Math.max(0, Math.floor(ticket.price_zar!)),
      quantity_total: Math.max(1, Math.floor(ticket.quantity_total!)),
      description: ticket.description?.trim() || null,
      // Absent means "leave it on", so existing callers that never sent
      // these fields keep their previous behaviour.
      is_active: ticket.is_active !== false,
      sale_start: normaliseInstant(ticket.sale_start),
      sale_end: normaliseInstant(ticket.sale_end),
    };
    if (ticket.id) {
      const { data: updated, error } = await supabase
        .from("tickets")
        .update(payload)
        .eq("id", ticket.id)
        .eq("event_id", eventId)
        .select("id");
      if (error) return { error: error.message, status: 500 };
      if (!updated || updated.length === 0) {
        return {
          error: `Ticket "${payload.name}" no longer exists — refresh and try again.`,
          status: 409,
        };
      }
    } else {
      const { error } = await supabase.from("tickets").insert(payload);
      if (error) return { error: error.message, status: 500 };
    }
  }

  return {};
}

export async function GET() {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("events")
    .select("*, tickets(*), galleries(id, slug)")
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { title, date, venue_name, venue_address, description, status, is_featured, cover_image_url } = body;

  if (!title || !date) {
    return NextResponse.json({ error: "title and date required" }, { status: 400 });
  }

  const ticketUrl = normalizeTicketUrl(body.external_ticket_url);
  if ("error" in ticketUrl) {
    return NextResponse.json({ error: ticketUrl.error }, { status: 400 });
  }

  const paymentUrl = normalizePaymentUrl(body.payment_url);
  if ("error" in paymentUrl) {
    return NextResponse.json({ error: paymentUrl.error }, { status: 400 });
  }

  const paymentNote = normalizePaymentNote(body.payment_note);
  if ("error" in paymentNote) {
    return NextResponse.json({ error: paymentNote.error }, { status: 400 });
  }

  const cleaned = body.slug ? slugify(body.slug) : "";
  const slug = cleaned || `${slugify(title)}-${Date.now().toString(36)}`;

  // Validate tickets before creating the event so a bad ticket row can't
  // leave a half-created event behind.
  let ticketPlan: TicketSyncPlan | null = null;
  if (Array.isArray(body.tickets) && body.tickets.length > 0) {
    const result = planTicketSync([], body.tickets);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    ticketPlan = result.plan;
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      slug,
      date,
      venue_name: venue_name || null,
      venue_address: venue_address || null,
      description: description || null,
      status: status || "draft",
      is_featured: !!is_featured,
      cover_image_url: cover_image_url || null,
      external_ticket_url: ticketUrl.url,
      payment_url: paymentUrl.url,
      payment_note: paymentNote.note,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit the created event before ticket sync — the event row is committed
  // even if a ticket write fails below.
  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "event.create",
    resource_type: "event",
    resource_id: data.id,
    details: { title, slug },
  });

  if (ticketPlan) {
    const sync = await executeTicketPlan(supabase, data.id, ticketPlan);
    if (sync.error) return NextResponse.json({ error: sync.error }, { status: sync.status || 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, tickets, ...updates } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (typeof updates.slug === "string") {
    const cleaned = slugify(updates.slug);
    if (cleaned) updates.slug = cleaned;
    else delete updates.slug;
  }

  if ("external_ticket_url" in updates) {
    const ticketUrl = normalizeTicketUrl(updates.external_ticket_url);
    if ("error" in ticketUrl) {
      return NextResponse.json({ error: ticketUrl.error }, { status: 400 });
    }
    updates.external_ticket_url = ticketUrl.url;
  }

  if ("payment_url" in updates) {
    const paymentUrl = normalizePaymentUrl(updates.payment_url);
    if ("error" in paymentUrl) {
      return NextResponse.json({ error: paymentUrl.error }, { status: 400 });
    }
    updates.payment_url = paymentUrl.url;
  }

  if ("payment_note" in updates) {
    const paymentNote = normalizePaymentNote(updates.payment_note);
    if ("error" in paymentNote) {
      return NextResponse.json({ error: paymentNote.error }, { status: 400 });
    }
    updates.payment_note = paymentNote.note;
  }

  // Validate ticket changes before writing anything so a bad ticket row
  // can't leave a half-applied save.
  let ticketPlan: TicketSyncPlan | null = null;
  if (Array.isArray(tickets)) {
    const { data: existing } = await supabase
      .from("tickets")
      .select("id")
      .eq("event_id", id);
    const result = planTicketSync((existing || []).map((row) => row.id), tickets);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    ticketPlan = result.plan;
  }

  const { data, error } = await supabase
    .from("events")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit the persisted event change before ticket sync, which can still
  // fail on a concurrent edit (409) after the event row is committed.
  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "event.update",
    resource_type: "event",
    resource_id: id,
    details: updates,
  });

  if (ticketPlan) {
    const sync = await executeTicketPlan(supabase, id, ticketPlan);
    if (sync.error) return NextResponse.json({ error: sync.error }, { status: sync.status || 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "event.delete",
    resource_type: "event",
    resource_id: id,
  });

  return NextResponse.json({ success: true });
}
