import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [events, photos, ticketOrders, merchOrders, leads, subscribers] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("gallery_photos").select("id", { count: "exact", head: true }),
    supabase.from("ticket_orders").select("total_zar").in("status", ["confirmed", "used"]),
    supabase.from("orders").select("total_zar").in("status", ["confirmed", "shipped", "delivered"]),
    supabase.from("gallery_views").select("user_id", { count: "exact", head: true }),
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const ticketRevenue = (ticketOrders.data || []).reduce((sum, o) => sum + (o.total_zar || 0), 0);
  const merchRevenue = (merchOrders.data || []).reduce((sum, o) => sum + (o.total_zar || 0), 0);

  return NextResponse.json({
    events: events.count || 0,
    photos: photos.count || 0,
    ticketsSold: (ticketOrders.data || []).length,
    merchOrders: (merchOrders.data || []).length,
    leads: leads.count || 0,
    subscribers: subscribers.count || 0,
    revenue: ticketRevenue + merchRevenue,
  });
}
