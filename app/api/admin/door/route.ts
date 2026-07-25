import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
  const supabase = createClient();
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
    .select("id, name")
    .eq("event_id", eventId);

  if (ticketError) {
    return NextResponse.json({ error: ticketError.message }, { status: 500 });
  }

  const ticketNames = new Map((ticketRows ?? []).map((t) => [t.id, t.name]));
  if (ticketNames.size === 0) {
    return NextResponse.json({ event, guests: [] });
  }

  // Cancelled orders are excluded — they are not guests, and a name on the list
  // that cannot be admitted only causes an argument at the door.
  const { data, error } = await supabase
    .from("ticket_orders")
    .select(
      "id, order_ref, buyer_name, buyer_email, buyer_phone, quantity, checked_in_count, status, total_zar, checked_in_at, created_at, ticket_id"
    )
    .in("ticket_id", Array.from(ticketNames.keys()))
    .neq("status", "cancelled")
    .order("buyer_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const guests = (data ?? []).map((row) => ({
    ...row,
    ticket_name: ticketNames.get(row.ticket_id) ?? null,
  }));

  return NextResponse.json({ event, guests });
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

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "Nothing to look up" }, { status: 400 });

  const { data, error } = await supabase.rpc("check_in_order", {
    p_code: code,
    p_event_id: body.event_id || null,
    p_count: Number.isInteger(body.count) ? body.count : 1,
    p_allow_unpaid: body.allow_unpaid === true,
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
