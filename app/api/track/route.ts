import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientGeo } from "@/lib/request-meta";
import { redactPath } from "@/app/api/e/core";

/**
 * First-party analytics ingest. Public, anonymous, fire-and-forget.
 *
 * - Stores only coarse, non-personal data: event name, path, referrer host,
 *   a client session id, derived city/region/country (from the host's edge,
 *   see lib/request-meta.ts), a device hint and a small props bag. No raw IP is persisted
 *   (the IP is used transiently for rate-limiting only). POPIA-conscious.
 * - Never stores a code. A ticket link is /ticket/<code>, and that code is
 *   the whole proof the ticket is yours, so the path and every string in the
 *   props go through redactPath, the same redaction Breazy Analytics applies
 *   (app/api/e/core.ts), and the referrer is cut back to a host. Before this
 *   every visit to a ticket page wrote a working ticket code into
 *   analytics_events. supabase/scrub_analytics_codes.sql cleans the old rows.
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

// Anything shaped like a code (a UUID, a long hex or mixed run, a capability
// prefix) becomes [id]. Applied to every string, keys included, at any depth.
function redactProps(value: unknown): unknown {
  if (typeof value === "string") return value ? redactPath(value) : value;
  if (Array.isArray(value)) return value.map(redactProps);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [redactPath(k), redactProps(v)])
    );
  }
  return value;
}

// The tracker sends the referrer's host only. Whatever arrives is cut back to
// a host anyway, so a full link, and any code in it, is never stored.
function referrerHost(v: unknown): string | null {
  const raw = clamp(v, 255);
  if (!raw) return null;
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).host || null;
  } catch {
    return null;
  }
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

  // Coarse geo from whichever edge is in front of the app.
  const h = request.headers;
  const { city, region, country } = clientGeo(h);
  const device = deviceFromUA(h.get("user-agent") || "");

  // Keep props small and string-ish; cap the serialized size.
  let props: Record<string, unknown> = {};
  if (payload.props && typeof payload.props === "object") {
    try {
      const json = JSON.stringify(payload.props);
      if (json.length <= 2000) {
        props = redactProps(payload.props) as Record<string, unknown>;
      }
    } catch {
      props = {};
    }
  }

  const supabase = await createClient();
  if (!supabase) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  const rawPath = clamp(payload.path, 512);

  await supabase.from("analytics_events").insert({
    site,
    event_name: event,
    path: rawPath ? redactPath(rawPath) : null,
    referrer_host: referrerHost(payload.referrer),
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
