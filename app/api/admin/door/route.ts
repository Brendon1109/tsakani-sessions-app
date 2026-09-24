import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { ticketUrl } from "@/lib/qr";

/**
 * The door.
 *
 * Deliberately separate from /api/admin/tickets, which is the back-office view:
 * every order for every event, newest first, paginated. That shape is wrong for
 * a person standing at an entrance. This one is scoped to a single night, sorted
 * by name because that is how you look someone up, and it can turn a scanned QR
 * into an admitted guest in one round trip.
 *
 * Both writes go through SECURITY DEFINER functions (supabase/door_checkin.sql)
 * rather than an UPDATE from here. Two staff scanning the same queue is the
 * normal case, and only the database can settle who got there first.
 */

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, user: profile?.role === "admin" ? user : null };
}

/**
 * GET without an event id lists events so the door can pick tonight's.
 * GET with one returns that event's whole guest list.
 *
 * The roster is returned in full rather than paginated on purpose. It is one
 * event's guests — tens, occasionally hundreds — and holding all of it in the
 * browser is what makes the search box instant and keeps working through the
 * signal drops that a room full of people causes.
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const eventId = request.nextUrl.searchParams.get("event_id");

  if (!eventId) {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, date, slug")
      .order("date", { ascending: false })
      .limit(30);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data ?? [] });
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, date, venue_name")
    .eq("id", eventId)
    .single();
  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Resolved in two plain queries rather than one embedded !inner filter.
  // The embedded form is shorter, but it is parsed by PostgREST and a silent
  // mismatch there returns an EMPTY list, not an error — which at a door reads
  // as "nobody booked" on the one night you cannot debug it. Two boring queries
  // fail loudly instead.
  const { data: ticketRows, error: ticketError } = await supabase
    .from("tickets")
    .select("id, name, price_zar")
    .eq("event_id", eventId);

  if (ticketError) {
    return NextResponse.json({ error: ticketError.message }, { status: 500 });
  }

  const ticketNames = new Map((ticketRows ?? []).map((t) => [t.id, t.name]));
  if (ticketNames.size === 0) {
    return NextResponse.json({ event, guests: [], tickets: [] });
  }

  // Cancelled orders are excluded — they are not guests, and a name on the list
  // that cannot be admitted only causes an argument at the door.
  const { data, error } = await supabase
    .from("ticket_orders")
    .select(
      "id, order_ref, qr_code, buyer_name, buyer_email, buyer_phone, quantity, checked_in_count, status, total_zar, checked_in_at, created_at, source, ticket_id"
    )
    .in("ticket_id", Array.from(ticketNames.keys()))
    .neq("status", "cancelled")
    .order("buyer_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Comp slips carry their own printed numbers. The door reads one off a slip
  // and types it, so the search box has to know which booking each belongs to.
  const { data: compRows } = await supabase
    .from("comp_tickets")
    .select("ref, order_id")
    .eq("event_id", eventId);

  const compByOrder = new Map<string, string[]>();
  for (const c of compRows ?? []) {
    if (!c.order_id) continue;
    const list = compByOrder.get(c.order_id) ?? [];
    list.push(c.ref);
    compByOrder.set(c.order_id, list);
  }

  const guests = (data ?? []).map(({ qr_code, ...row }) => ({
    ...row,
    comp_refs: (compByOrder.get(row.id) ?? []).sort(),
    ticket_name: ticketNames.get(row.ticket_id) ?? null,
    // The link the team pastes into a WhatsApp thread. Built here rather than in
    // the browser because it has to match the URL baked into the emailed QR,
    // and that comes from SITE_URL on the server.
    ticket_url: qr_code ? ticketUrl(qr_code) : null,
  }));

  return NextResponse.json({
    event,
    guests,
    // Inactive types included on purpose: by the time the door is open, online
    // sales have usually closed and every type is inactive. Hiding them would
    // leave the team nothing to add a walk-up guest against.
    tickets: (ticketRows ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      price_zar: t.price_zar,
    })),
  });
}

/**
 * A scan, or a tap on a name. Both land here.
 *
 * Note what is NOT sent: the client never says "set this order to used". It
 * sends what it read and lets the database decide what that means, so an
 * already-used ticket, a cancelled one, and one for next month's event each
 * come back as a distinct outcome the screen can render differently.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));

  // Undo. A scanner aimed at a queue occasionally catches the ticket behind the
  // one being presented, and that has to be fixable at the door.
  if (body.action === "undo") {
    if (!body.order_id || typeof body.order_id !== "string") {
      return NextResponse.json({ error: "Missing order id" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("undo_check_in", {
      p_order_id: body.order_id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    await supabase.from("audit_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: "ticket_order.check_in_undone",
      resource_type: "ticket_orders",
      resource_id: body.order_id,
      details: { order_ref: row.order_ref },
    });

    return NextResponse.json({ outcome: "undone", ...row });
  }

  // Adding a guest who booked over WhatsApp, or who walked up to the door.
  // Until now there was no way to do this at all, which is exactly why those
  // guests lived in a chat thread instead of the guest list.
  if (body.action === "add_guest") {
    if (!body.ticket_id || typeof body.ticket_id !== "string") {
      return NextResponse.json({ error: "Pick a ticket type" }, { status: 400 });
    }
    if (!body.buyer_name || !String(body.buyer_name).trim()) {
      return NextResponse.json({ error: "A name is required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("admin_create_ticket_order", {
      p_ticket_id: body.ticket_id,
      p_buyer_name: String(body.buyer_name).trim(),
      p_buyer_phone: body.buyer_phone ? String(body.buyer_phone).trim() : null,
      p_buyer_email: body.buyer_email ? String(body.buyer_email).trim() : null,
      p_quantity: Number.isInteger(body.quantity) ? body.quantity : 1,
      p_source: body.source === "door" ? "door" : "whatsapp",
      p_confirmed: body.confirmed !== false,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return NextResponse.json({ error: "Could not add that guest" }, { status: 500 });

    await supabase.from("audit_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: "ticket_order.created_by_admin",
      resource_type: "ticket_orders",
      resource_id: row.order_id,
      details: {
        order_ref: row.order_ref,
        buyer_name: String(body.buyer_name).trim(),
        quantity: row.quantity,
        source: body.source === "door" ? "door" : "whatsapp",
        status: row.status,
        over_capacity: row.over_capacity,
      },
    });

    return NextResponse.json({
      ...row,
      ticket_url: row.qr_code ? ticketUrl(row.qr_code) : null,
    });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "Nothing to look up" }, { status: 400 });

  const { data, error } = await supabase.rpc("check_in_order", {
    p_code: code,
    p_event_id: body.event_id || null,
    p_count: Number.isInteger(body.count) ? body.count : 1,
    p_allow_unpaid: body.allow_unpaid === true,
    p_id_checked: body.id_checked === true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ outcome: "not_found" });

  // Only real admissions are logged. A door produces a lot of scans that mean
  // nothing happened — a re-scan of someone already inside, a mis-aimed camera
  // — and writing those would bury the record of who was actually let in.
  if (row.outcome === "checked_in") {
    await supabase.from("audit_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: "ticket_order.checked_in",
      resource_type: "ticket_orders",
      resource_id: row.order_id,
      details: {
        order_ref: row.order_ref,
        buyer_name: row.buyer_name,
        admitted: row.checked_in_count,
        party_size: row.quantity,
        paid_at_door: body.allow_unpaid === true,
      },
    });
  }

  return NextResponse.json(row);
}
