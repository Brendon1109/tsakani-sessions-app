import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * First-party analytics ingest. Public, anonymous, fire-and-forget.
 *
 * - Stores only coarse, non-personal data: event name, path, referrer host,
 *   a client session id, derived city/region/country (from Vercel edge
 *   headers), a device hint and a small props bag. No raw IP is persisted
 *   (the IP is used transiently for rate-limiting only). POPIA-conscious.
 * - Accepts both same-origin (app) and cross-origin (static marketing site)
 *   beacons. Cross-origin beacons must use a CORS-safelisted content type
 *   (text/plain) to avoid a preflight that sendBeacon cannot perform; the body
 *   is parsed content-type-agnostically.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const ALLOWED_SITES = new Set(["app", "static"]);

function clamp(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function deviceFromUA(ua: string): "mobile" | "tablet" | "desktop" {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return "tablet";
  if (/mobi|iphone|android.*mobile|phone/.test(s)) return "mobile";
  return "desktop";
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  // Throttle abuse: 120 events / minute / IP.
  const limited = await rateLimit(request, "track", 120, 60);
  if (limited) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => limited.headers.set(k, v));
    return limited;
  }

  // Parse body regardless of content-type (sendBeacon may send text/plain).
  let payload: Record<string, unknown>;
  try {
    const raw = await request.text();
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  const event = clamp(payload.event, 64);
  if (!event) {
    // Nothing to record, but don't surface errors to a fire-and-forget beacon.
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  const site = ALLOWED_SITES.has(String(payload.site)) ? String(payload.site) : "app";

  // Coarse geo from Vercel edge headers (city is percent-encoded).
  const h = request.headers;
  const rawCity = h.get("x-vercel-ip-city");
  let city: string | null = null;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity).slice(0, 120);
    } catch {
      city = rawCity.slice(0, 120);
    }
  }
  const region = h.get("x-vercel-ip-country-region")?.slice(0, 120) || null;
  const country = h.get("x-vercel-ip-country")?.slice(0, 8) || null;
  const device = deviceFromUA(h.get("user-agent") || "");

  // Keep props small and string-ish; cap the serialized size.
  let props: Record<string, unknown> = {};
  if (payload.props && typeof payload.props === "object") {
    try {
      const json = JSON.stringify(payload.props);
      if (json.length <= 2000) props = payload.props as Record<string, unknown>;
    } catch {
      props = {};
    }
  }

  const supabase = createClient();
  if (!supabase) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  await supabase.from("analytics_events").insert({
    site,
    event_name: event,
    path: clamp(payload.path, 512),
    referrer_host: clamp(payload.referrer, 255),
    session_id: clamp(payload.session_id, 64),
    city,
    region,
    country,
    device,
    props,
  });

  // Always 204 — the client never reads this response.
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
