import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { type Lead, describeConsents, sortLeadsByDateDesc } from "@/lib/leads";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const leads: Lead[] = [];

  // Each source is fetched and mapped independently. A per-source error (for
  // example booking_enquiries before its SQL has been run) is swallowed so the
  // source is simply omitted rather than 500-ing the whole page.

  // Booking enquiries
  try {
    type Row = {
      name: string | null;
      email: string | null;
      phone: string | null;
      event_type: string | null;
      venue: string | null;
      created_at: string;
    };
    const { data, error } = await supabase
      .from("booking_enquiries")
      .select("name, email, phone, event_type, venue, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) {
      for (const row of data as unknown as Row[]) {
        leads.push({
          source: "Booking",
          name: row.name,
          email: row.email,
          phone: row.phone,
          detail: row.event_type || row.venue || "Booking enquiry",
          date: row.created_at,
        });
      }
    }
  } catch {
    // table may not exist yet
  }

  // Ticket buyers
  try {
    type Row = {
      buyer_name: string | null;
      buyer_email: string | null;
      buyer_phone: string | null;
      quantity: number | null;
      created_at: string;
      ticket: { name: string | null; event: { title: string | null } | null } | null;
    };
    const { data, error } = await supabase
      .from("ticket_orders")
      .select(
        "buyer_name, buyer_email, buyer_phone, quantity, created_at, ticket:tickets(name, event:events(title))"
      )
      .order("created_at", { ascending: false });
    if (!error && data) {
      for (const row of data as unknown as Row[]) {
        const eventTitle = row.ticket?.event?.title;
        const ticketName = row.ticket?.name;
        leads.push({
          source: "Ticket buyer",
          name: row.buyer_name,
          email: row.buyer_email,
          phone: row.buyer_phone,
          detail: eventTitle || ticketName || `${row.quantity ?? 1} ticket(s)`,
          date: row.created_at,
        });
      }
    }
  } catch {
    // ignore
  }

  // Merch buyers
  try {
    type Row = {
      customer_name: string | null;
      customer_email: string | null;
      customer_phone: string | null;
      items: { qty?: number }[] | null;
      created_at: string;
    };
    const { data, error } = await supabase
      .from("orders")
      .select("customer_name, customer_email, customer_phone, items, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) {
      for (const row of data as unknown as Row[]) {
        const items = Array.isArray(row.items) ? row.items : [];
        const count = items.reduce((n, it) => n + (Number(it.qty) || 0), 0);
        leads.push({
          source: "Merch buyer",
          name: row.customer_name,
          email: row.customer_email,
          phone: row.customer_phone,
          detail: count > 0 ? `${count} item${count === 1 ? "" : "s"}` : "Merch order",
          date: row.created_at,
        });
      }
    }
  } catch {
    // ignore
  }

  // Newsletter subscribers
  try {
    type Row = {
      email: string | null;
      consent_events: boolean | null;
      consent_merch: boolean | null;
      subscribed_at: string;
    };
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("email, consent_events, consent_merch, subscribed_at")
      .eq("is_active", true)
      .order("subscribed_at", { ascending: false });
    if (!error && data) {
      for (const row of data as unknown as Row[]) {
        leads.push({
          source: "Newsletter",
          name: null,
          email: row.email,
          phone: null,
          detail: describeConsents(!!row.consent_events, !!row.consent_merch),
          date: row.subscribed_at,
        });
      }
    }
  } catch {
    // ignore
  }

  // Gallery views (dedupe by email, latest view per user, as before)
  try {
    type Row = {
      viewed_at: string;
      user: { email: string | null; full_name: string | null } | null;
      gallery: { title: string | null } | null;
    };
    const { data, error } = await supabase
      .from("gallery_views")
      .select("viewed_at, user:profiles(email, full_name), gallery:galleries(title)")
      .order("viewed_at", { ascending: false });
    if (!error && data) {
      const seen = new Set<string>();
      for (const row of data as unknown as Row[]) {
        const email = row.user?.email;
        if (!email || seen.has(email)) continue;
        seen.add(email);
        leads.push({
          source: "Gallery view",
          name: row.user?.full_name ?? null,
          email,
          phone: null,
          detail: row.gallery?.title || "Gallery",
          date: row.viewed_at,
        });
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json(sortLeadsByDateDesc(leads));
}
