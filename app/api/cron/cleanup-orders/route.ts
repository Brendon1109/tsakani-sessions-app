import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Cron endpoint: cancels stale pending orders (>48h) and releases
 * reserved tickets back to inventory.
 *
 * Configure via Vercel Cron (vercel.json) or call manually:
 *   POST /api/cron/cleanup-orders
 *   Header: Authorization: Bearer <CRON_SECRET>
 */

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    // Fail closed in production: no secret set means nobody can call this.
    // In dev, allow unauthenticated calls so it's easy to exercise locally.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[cron/cleanup-orders] CRON_SECRET is not set in production — rejecting request. Set the env var in Vercel."
      );
      return false;
    }
    return true;
  }

  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Cancel stale merch orders.
  //
  // This goes through cleanup_stale_merch_orders rather than a direct update.
  // The direct update ran on the anon key and the only UPDATE policy on orders
  // is the admin one, so it silently matched zero rows every night and reported
  // "cancelled_orders: 0" as if there had been nothing to do. See
  // supabase/merch_store.sql.
  const { data: cancelledCount, error: ordersError } = await supabase.rpc(
    "cleanup_stale_merch_orders",
    { p_hours: 48 }
  );

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  // Cancel stale ticket orders + release reservations
  // gt("total_zar", 0) so a free ticket is never swept up here. create_ticket_order
  // now writes free orders as 'confirmed' for exactly this reason, but a
  // free order that reaches 'pending' by any other route (an old row, a manual
  // edit) still must not be cancelled — there is no payment for it to be
  // waiting on, so "unpaid for 48 hours" is not a meaningful thing to say
  // about it.
  const { data: staleTickets } = await supabase
    .from("ticket_orders")
    .select("id, ticket_id, quantity")
    .eq("status", "pending")
    .gt("total_zar", 0)
    .lt("created_at", cutoff);

  let released = 0;
  if (staleTickets && staleTickets.length > 0) {
    for (const order of staleTickets) {
      await supabase.rpc("release_tickets", {
        p_ticket_id: order.ticket_id,
        p_quantity: order.quantity,
      });
      released++;
    }

    await supabase
      .from("ticket_orders")
      .update({ status: "cancelled" })
      .in("id", staleTickets.map((t) => t.id));
  }

  // Cleanup expired rate limit entries
  await supabase
    .from("rate_limits")
    .delete()
    .lt("expires_at", new Date().toISOString());

  return NextResponse.json({
    cancelled_orders: typeof cancelledCount === "number" ? cancelledCount : 0,
    cancelled_ticket_orders: released,
    timestamp: new Date().toISOString(),
  });
}
