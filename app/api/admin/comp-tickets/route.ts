import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { ticketUrl } from "@/lib/qr";

/**
 * Complimentary slips, for issuing and printing.
 *
 * The slips are numbered paper. Numbered paper cannot be scanned, so a comp
 * holder was always going to be the slowest guest at the door — the number has
 * to be read off the slip and typed. That works, and it is what the door falls
 * back to, but it is not what the rest of the guest list does.
 *
 * This exists to print the slip WITH the QR of the booking it belongs to, so a
 * comp guest hands over something the camera reads like any other ticket.
 *
 * The QR encodes the booking's own ticket URL — the unguessable uuid — never
 * the comp reference. Comp references are sequential: TSK-COMP-0007 is trivial
 * to guess, and a URL built from one would let anyone page through other
 * people's tickets and see who is coming. The reference stays an admin-side
 * lookup, which is why resolve_ticket_code is granted to authenticated only.
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

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const eventId = request.nextUrl.searchParams.get("event_id");

  if (!eventId) {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, date")
      .order("date", { ascending: false })
      .limit(30);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data ?? [] });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, title, date, venue_name")
    .eq("id", eventId)
    .single();

  const { data: slips, error } = await supabase
    .from("comp_tickets")
    .select("ref, holder_name, notes, order_id")
    .eq("event_id", eventId)
    .order("ref", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve each linked slip to the booking it prints against. Done as one
  // lookup rather than a join so an orphaned link (booking cancelled and
  // deleted) degrades to "unlinked" instead of dropping the slip from the sheet
  // entirely — a slip that vanishes from a print run is one nobody notices is
  // missing until someone is standing at the door holding it.
  const orderIds = (slips ?? []).map((s) => s.order_id).filter(Boolean) as string[];
  const orders = orderIds.length
    ? (
        await supabase
          .from("ticket_orders")
          .select("id, order_ref, buyer_name, quantity, qr_code, status")
          .in("id", orderIds)
      ).data ?? []
    : [];
  const byId = new Map(orders.map((o) => [o.id, o]));

  return NextResponse.json({
    event: event ?? null,
    slips: (slips ?? []).map((s) => {
      const order = s.order_id ? byId.get(s.order_id) : undefined;
      return {
        ref: s.ref,
        holder_name: s.holder_name,
        notes: s.notes,
        order_ref: order?.order_ref ?? null,
        buyer_name: order?.buyer_name ?? null,
        quantity: order?.quantity ?? null,
        status: order?.status ?? null,
        ticket_url: order?.qr_code ? ticketUrl(order.qr_code) : null,
      };
    }),
  });
}
