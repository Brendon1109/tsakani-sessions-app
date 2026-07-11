import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { planTicketSync, type TicketSyncPlan } from "@/lib/ticketSync";

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

async function executeTicketPlan(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  eventId: string,
  plan: TicketSyncPlan,
): Promise<{ error?: string; status?: number }> {
  const { toDelete, toUpdate, toInsert } = plan;

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
