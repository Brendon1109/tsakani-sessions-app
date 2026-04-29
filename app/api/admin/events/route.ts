import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

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

interface TicketInput {
  id?: string;
  name?: string;
  price_zar?: number;
  quantity_total?: number;
  description?: string;
}

async function syncTickets(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  tickets: TicketInput[],
): Promise<{ error?: string }> {
  if (!supabase) return {};

  const valid = tickets.filter(
    (t) => t.name && t.name.trim() && Number.isFinite(t.price_zar) && Number.isFinite(t.quantity_total),
  );

  const { data: existing } = await supabase
    .from("tickets")
    .select("id")
    .eq("event_id", eventId);

  const incomingIds = new Set(valid.filter((t) => t.id).map((t) => t.id as string));
  const toDelete = (existing || []).filter((row) => !incomingIds.has(row.id)).map((row) => row.id);

  if (toDelete.length > 0) {
    const { error } = await supabase.from("tickets").delete().in("id", toDelete);
    if (error) return { error: error.message };
  }

  for (const ticket of valid) {
    const payload = {
      event_id: eventId,
      name: ticket.name!.trim(),
      price_zar: Math.max(0, Math.floor(ticket.price_zar!)),
      quantity_total: Math.max(1, Math.floor(ticket.quantity_total!)),
      description: ticket.description?.trim() || null,
    };
    if (ticket.id) {
      const { error } = await supabase
        .from("tickets")
        .update(payload)
        .eq("id", ticket.id)
        .eq("event_id", eventId);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("tickets").insert(payload);
      if (error) return { error: error.message };
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

  if (Array.isArray(body.tickets) && body.tickets.length > 0) {
    const sync = await syncTickets(supabase, data.id, body.tickets);
    if (sync.error) return NextResponse.json({ error: sync.error }, { status: 500 });
  }

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "event.create",
    resource_type: "event",
    resource_id: data.id,
    details: { title, slug },
  });

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

  const { data, error } = await supabase
    .from("events")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(tickets)) {
    const sync = await syncTickets(supabase, id, tickets);
    if (sync.error) return NextResponse.json({ error: sync.error }, { status: 500 });
  }

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "event.update",
    resource_type: "event",
    resource_id: id,
    details: updates,
  });

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
