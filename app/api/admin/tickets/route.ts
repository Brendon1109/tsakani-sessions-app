import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendTicketConfirmedEmail } from "@/lib/email";
import { ticketUrl } from "@/lib/qr";
import { eventDateLong, eventTime } from "@/lib/date";

/** A to-one embedded join arrives as an object at runtime but is typed as an array. */
function pickOne<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, user: profile?.role === "admin" ? user : null };
}

export async function GET() {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("ticket_orders")
    .select("*, ticket:tickets(name, event:events(title))")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Mirrors the check constraint on ticket_orders.status (see schema.sql).
const ALLOWED_STATUSES = ["pending", "confirmed", "used", "cancelled"] as const;
type OrderStatus = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status } = await request.json();

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.includes(status as OrderStatus)) {
    return NextResponse.json(
      { error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // Read the current row first so we can tell what actually changed. The extra
  // columns are what the buyer's "you're confirmed" email needs — read here so
  // we don't have to re-query after the write.
  const { data: before, error: readError } = await supabase
    .from("ticket_orders")
    .select(
      "id, status, quantity, ticket_id, order_ref, qr_code, buyer_name, buyer_email, total_zar, ticket:tickets(name, event:events(title, date))"
    )
    .eq("id", id)
    .single();

  if (readError || !before) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (before.status === status) {
    return NextResponse.json({ ...before, unchanged: true });
  }

  const { data, error } = await supabase
    .from("ticket_orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cancelling frees the seats again. Only release when moving *into* cancelled
  // from a state that was still holding stock, so repeat cancels cannot
  // release the same seats twice.
  if (status === "cancelled" && before.status !== "cancelled") {
    const { error: releaseError } = await supabase.rpc("release_tickets", {
      p_ticket_id: before.ticket_id,
      p_quantity: before.quantity,
    });
    if (releaseError) {
      console.error("[admin/tickets] release_tickets failed:", releaseError.message);
    }
  }

  // Tell the buyer their held ticket is now a real one. Best effort: the status
  // change is already committed and must not be undone by a mail failure.
  if (status === "confirmed" && before.status !== "confirmed") {
    // Supabase types the embedded joins as arrays; at runtime a to-one join is
    // an object. Normalise both shapes rather than trusting either.
    const ticket = pickOne(before.ticket);
    const event = pickOne(ticket?.event);
    if (before.buyer_email && before.qr_code) {
      sendTicketConfirmedEmail({
        to: before.buyer_email,
        buyerName: before.buyer_name || "there",
        orderRef: before.order_ref || id,
        ticketName: ticket?.name || "ticket",
        quantity: before.quantity ?? 1,
        totalZar: before.total_zar ?? 0,
        eventTitle: event?.title || "Tsakani Sessions",
        eventDateLabel: event?.date
          ? `${eventDateLong(event.date)}, ${eventTime(event.date)}`
          : "Date to be confirmed",
        ticketUrl: ticketUrl(before.qr_code),
      }).catch(() => {});
    }
  }

  await supabase.from("audit_log").insert({
    user_id: user.id,
    user_email: user.email,
    action: "ticket_order.status_change",
    resource_type: "ticket_orders",
    resource_id: id,
    details: { from: before.status, to: status, quantity: before.quantity },
  });

  return NextResponse.json(data);
}
