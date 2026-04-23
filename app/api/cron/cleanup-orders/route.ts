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

  // Cancel stale merch orders
  const { data: cancelledOrders, error: ordersError } = await supabase
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  // Cancel stale ticket orders + release reservations
  const { data: staleTickets } = await supabase
    .from("ticket_orders")
    .select("id, ticket_id, quantity")
    .eq("status", "pending")
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
    cancelled_orders: cancelledOrders?.length || 0,
    cancelled_ticket_orders: released,
    timestamp: new Date().toISOString(),
  });
}
