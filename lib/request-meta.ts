import { getCloudflareContext } from "@opennextjs/cloudflare/cloudflare-context";

/**
 * Who the visitor is, as far as the edge in front of this app can vouch for.
 *
 * Production is a Cloudflare Worker, so only Cloudflare's own data is trusted.
 * Every other header arrives exactly as the client sent it:
 *
 * - Cloudflare writes cf-connecting-ip. It does NOT strip a client supplied
 *   x-forwarded-for, it appends to it, so the first entry there is whatever
 *   the caller typed, and x-real-ip is never Cloudflare's. Neither is read.
 * - Geo comes from request.cf, which OpenNext keeps in its request context.
 *   City and region never arrive as headers unless the zone turns on a
 *   managed transform, so they are not read from headers here.
 *
 * There is no platform switch. Outside the Worker (next dev, next start, the
 * tests) none of this exists, so the IP is null and the geo is empty.
 */

/** The client IP Cloudflare vouches for, or null. */
export function clientIp(headers: Headers): string | null {
  return headers.get("cf-connecting-ip")?.trim() || null;
}

export interface Geo {
  city: string | null;
  region: string | null;
  country: string | null;
}

/** The subset of Cloudflare's request.cf this app reads. */
export interface CfGeo {
  city?: string;
  regionCode?: string;
  country?: string;
}

/**
 * Coarse location for analytics. Never an IP. Region is the ISO 3166-2
 * subdivision code (WC for the Western Cape), the same form the rows written
 * before the move to Cloudflare used, so old and new rows line up.
 */
export function clientGeo(headers: Headers, cf: CfGeo | undefined = requestCf()): Geo {
  return {
    city: clip(cf?.city, 120),
    region: clip(cf?.regionCode, 120),
    country: clip(cf?.country || headers.get("cf-ipcountry") || undefined, 8),
  };
}

/** request.cf for the current request on the Worker, or undefined anywhere else. */
function requestCf(): CfGeo | undefined {
  try {
    return getCloudflareContext().cf as CfGeo | undefined;
  } catch {
    return undefined;
  }
}

function clip(v: string | undefined, max: number): string | null {
  const s = v?.trim();
  return s ? s.slice(0, max) : null;
}
