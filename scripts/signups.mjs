/**
 * List ticket registrations and newsletter sign-ups straight from the database.
 *
 *   node scripts/signups.mjs              # everything
 *   node scripts/signups.mjs --days 7     # only the last 7 days
 *   node scripts/signups.mjs --csv        # write signups-<date>.csv files
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY from .env.local. Read-only — it never writes
 * to the database. Keep the CSVs off WhatsApp/email: they hold personal data
 * (POPIA), so share the admin panel instead where you can.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const days = args.includes("--days") ? Number(args[args.indexOf("--days") + 1]) : null;
const wantCsv = args.includes("--csv");

const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exit(1);
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const since = days ? new Date(Date.now() - days * 86400_000).toISOString() : null;
const sast = (iso) =>
  new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

function toCsv(rows) {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

// --- Ticket registrations ---------------------------------------------------
let ordersQuery = db
  .from("ticket_orders")
  .select("buyer_name, buyer_email, buyer_phone, quantity, total_zar, status, created_at, ticket:tickets(name, price_zar, event:events(title, date))")
  .order("created_at", { ascending: false });
if (since) ordersQuery = ordersQuery.gte("created_at", since);

const { data: orders, error: ordersError } = await ordersQuery;
if (ordersError) throw new Error(`ticket_orders: ${ordersError.message}`);

const orderRows = orders.map((o) => ({
  when: sast(o.created_at),
  name: o.buyer_name,
  email: o.buyer_email,
  phone: o.buyer_phone || "",
  event: o.ticket?.event?.title?.trim() || "—",
  ticket: o.ticket?.name || "—",
  qty: o.quantity,
  total_zar: o.total_zar,
  status: o.status,
}));

console.log(`\n=== TICKET REGISTRATIONS (${orderRows.length}${days ? `, last ${days} days` : ""}) ===`);
console.table(orderRows);
console.log(`Tickets requested: ${orderRows.reduce((n, r) => n + (r.qty || 0), 0)}`);
console.log(
  `By status: ${Object.entries(
    orderRows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {})
  )
    .map(([s, n]) => `${s}=${n}`)
    .join("  ") || "none"}`
);

// --- Newsletter sign-ups ----------------------------------------------------
let subsQuery = db
  .from("newsletter_subscribers")
  .select("email, source, is_active, consent_events, consent_merch, subscribed_at")
  .order("subscribed_at", { ascending: false });
if (since) subsQuery = subsQuery.gte("subscribed_at", since);

const { data: subs, error: subsError } = await subsQuery;
if (subsError) throw new Error(`newsletter_subscribers: ${subsError.message}`);

const subRows = subs.map((s) => ({
  when: sast(s.subscribed_at),
  email: s.email,
  source: s.source,
  active: s.is_active,
  wants_events: s.consent_events,
  wants_merch: s.consent_merch,
}));

console.log(`\n=== NEWSLETTER SIGN-UPS (${subRows.length}${days ? `, last ${days} days` : ""}) ===`);
console.table(subRows);

// --- Ticket inventory -------------------------------------------------------
const { data: tickets, error: ticketsError } = await db
  .from("tickets")
  .select("name, price_zar, quantity_total, quantity_sold, is_active, event:events(title, date, status)")
  .order("created_at", { ascending: false });
if (ticketsError) throw new Error(`tickets: ${ticketsError.message}`);

console.log("\n=== TICKET INVENTORY ===");
console.table(
  tickets
    .filter((t) => t.event?.status !== "past")
    .map((t) => ({
      event: t.event?.title?.trim() || "—",
      ticket: t.name,
      price_zar: t.price_zar,
      sold: t.quantity_sold,
      total: t.quantity_total,
      left: t.quantity_total - (t.quantity_sold || 0),
      active: t.is_active,
    }))
);

if (wantCsv) {
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(join(root, `signups-registrations-${stamp}.csv`), toCsv(orderRows));
  writeFileSync(join(root, `signups-newsletter-${stamp}.csv`), toCsv(subRows));
  console.log(`\nWrote signups-registrations-${stamp}.csv and signups-newsletter-${stamp}.csv`);
  console.log("These contain personal data — don't commit or forward them.");
}
