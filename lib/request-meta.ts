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
 * cf-connecting-ip and cf-ipcountry are only Cloudflare's when the request
 * really came through the Worker. Anywhere else (next dev, next start, an old
 * Vercel deployment, the tests) a caller can send them by hand, so both are
 * read only when OpenNext's Cloudflare context exists, and off the Worker the
 * IP is null and the geo is empty. There is no platform switch.
 */

/** The Worker's request data, or null when this is not running on the Worker. */
export interface WorkerRequest {
  cf: CfGeo | undefined;
}

/** The client IP Cloudflare vouches for, or null. */
export function clientIp(
  headers: Headers,
  worker: WorkerRequest | null = workerRequest()
): string | null {
  if (!worker) return null;
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
export function clientGeo(
  headers: Headers,
  worker: WorkerRequest | null = workerRequest()
): Geo {
  if (!worker) return { city: null, region: null, country: null };
  const cf = worker.cf;
  return {
    city: clip(cf?.city, 120),
    region: clip(cf?.regionCode, 120),
    country: clip(cf?.country || headers.get("cf-ipcountry") || undefined, 8),
  };
}

/** The current request on the Worker, or null anywhere else. */
function workerRequest(): WorkerRequest | null {
  try {
    return { cf: getCloudflareContext().cf as CfGeo | undefined };
  } catch {
    return null;
  }
}

function clip(v: string | undefined, max: number): string | null {
  const s = v?.trim();
  return s ? s.slice(0, max) : null;
}
