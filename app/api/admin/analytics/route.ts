import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  forecastSeries,
  busiestWeekday,
  busiestMonth,
  trend,
  topEntries,
  type SeriesPoint,
} from "@/lib/forecast";

const ROW_CAP = 50000;
// Cape Town is UTC+2 (no DST) — bucket events by local SAST day.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

// Events that represent demand/conversion intent (vs. passive page views).
const CONVERSION_EVENTS = new Set([
  "book_now_cta_click",
  "book_whatsapp_click",
  "open_booking_modal",
  "submit_booking",
  "booking_click",
  "ticket_buy_click",
  "event_enquiry",
  "add_to_cart",
  "begin_checkout",
  "order_submitted",
  "order_whatsapp_sent",
  "newsletter_submit",
  "contact_click",
  "whatsapp_click",
]);

interface Row {
  event_name: string;
  path: string | null;
  site: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  device: string | null;
  session_id: string | null;
  referrer_host: string | null;
  props: Record<string, unknown> | null;
  created_at: string;
}

function localDay(iso: string): string {
  return new Date(new Date(iso).getTime() + SAST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function todayLocal(): string {
  return new Date(Date.now() + SAST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Zero-filled daily series from `days` ago through today (inclusive). */
function dailySeries(
  counts: Record<string, number>,
  days: number,
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  const end = new Date(`${todayLocal()}T00:00:00Z`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, value: counts[key] || 0 });
  }
  return out;
}

function tally(rows: Row[], pick: (r: Row) => string | null): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const k = pick(r);
    if (k) m[k] = (m[k] || 0) + 1;
  }
  return m;
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  if (!supabase)
    return NextResponse.json({ error: "Not configured" }, { status: 503 });

  // Admin gate (same pattern as /api/admin/stats).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Default to 90 days when the param is absent/empty/non-numeric.
  // (Number(null) === 0 is finite, so a naive Number() check would wrongly
  // collapse the default to the 7-day floor.)
  const rawDays = request.nextUrl.searchParams.get("days");
  const n = rawDays === null ? NaN : Number(rawDays);
  const days = Number.isFinite(n) && n > 0 ? Math.min(365, Math.max(7, n)) : 90;

  // Align the fetch window to the SAST midnight of the first chart bucket, so
  // totals, funnel and the daily series all cover the identical day set.
  const lastBucket = new Date(`${todayLocal()}T00:00:00Z`);
  const firstBucket = new Date(lastBucket);
  firstBucket.setUTCDate(firstBucket.getUTCDate() - (days - 1));
  const since = new Date(
    Date.parse(`${firstBucket.toISOString().slice(0, 10)}T00:00:00Z`) -
      SAST_OFFSET_MS,
  ).toISOString();

  // Fetch newest-first so the row cap drops the OLDEST rows (not the most
  // recent), then restore chronological order for series/forecast processing.
  const { data, error } = await supabase
    .from("analytics_events")
    .select(
      "event_name, path, site, city, region, country, device, session_id, referrer_host, props, created_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(ROW_CAP);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data || []) as Row[]).reverse();

  const pageViews = rows.filter((r) => r.event_name === "page_view");
  const conversions = rows.filter((r) => CONVERSION_EVENTS.has(r.event_name));
  const uniqueVisitors = new Set(
    rows.map((r) => r.session_id).filter(Boolean),
  ).size;

  // Daily series (zero-filled) for forecasting.
  const pvByDay = tally(pageViews, (r) => localDay(r.created_at));
  const convByDay = tally(conversions, (r) => localDay(r.created_at));
  const pvSeries = dailySeries(pvByDay, days);
  const convSeries = dailySeries(convByDay, days);

  const pvValues = pvSeries.map((p) => p.value);
  const pvForecast = forecastSeries(pvSeries, 14);
  const convForecast = forecastSeries(convSeries, 30);
  const projectedConversions30 = convForecast.reduce((s, p) => s + p.value, 0);

  // Local demand.
  const cityCounts = tally(pageViews, (r) => r.city);
  const regionCounts = tally(pageViews, (r) => r.region);
  const geoKnown = Object.values(cityCounts).reduce((a, b) => a + b, 0);
  const capeTown = cityCounts["Cape Town"] || 0;
  const capeTownShare = geoKnown ? Math.round((capeTown / geoKnown) * 100) : 0;

  // Service interest, from booking-related event props.
  const serviceCounts: Record<string, number> = {};
  for (const r of rows) {
    if (
      r.event_name === "open_booking_modal" ||
      r.event_name === "submit_booking" ||
      r.event_name === "booking_click"
    ) {
      const svc =
        (r.props?.service as string) || (r.props?.eventType as string) || null;
      if (svc) serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
    }
  }

  // Simple funnel.
  const count = (names: string[]) =>
    rows.filter((r) => names.includes(r.event_name)).length;
  const funnel = [
    { step: "Page views", value: pageViews.length },
    {
      step: "Booking intent",
      value: count(["book_now_cta_click", "open_booking_modal", "book_whatsapp_click"]),
    },
    { step: "Booking submitted", value: count(["submit_booking", "booking_click"]) },
    {
      step: "WhatsApp / contact",
      value: count([
        "order_whatsapp_sent",
        "ticket_buy_click",
        "contact_click",
        "whatsapp_click",
        "event_enquiry",
      ]),
    },
  ];

  return NextResponse.json({
    rangeDays: days,
    truncated: rows.length >= ROW_CAP,
    generatedAt: new Date().toISOString(),
    totals: {
      events: rows.length,
      pageViews: pageViews.length,
      uniqueVisitors,
      conversions: conversions.length,
    },
    series: { pageViews: pvSeries, conversions: convSeries },
    forecast: {
      pageViews14: pvForecast,
      projectedConversions30,
      busiestWeekday: busiestWeekday(pvSeries),
      busiestMonth: busiestMonth(pvSeries),
      trend: trend(pvValues),
    },
    local: {
      topCities: topEntries(cityCounts, 8),
      topRegions: topEntries(regionCounts, 8),
      capeTownShare,
      geoKnown,
    },
    topServices: topEntries(serviceCounts, 6),
    topEvents: topEntries(tally(rows, (r) => r.event_name), 12),
    topReferrers: topEntries(tally(rows, (r) => r.referrer_host), 8),
    devices: topEntries(tally(rows, (r) => r.device), 5),
    funnel,
  });
}
