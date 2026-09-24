import { getCloudflareContext } from "@opennextjs/cloudflare/cloudflare-context";

/**
 * Who the visitor is, as far as the edge in front of this app can vouch for.
 *
 * The platform is DECLARED in HOST_PLATFORM, never sniffed from headers, the
 * same rule the analytics adapter follows with BZ_PLATFORM (app/api/e/core.ts).
 * Each platform's edge overwrites its own headers, and only those can be
 * trusted. Every other header arrives exactly as the client sent it:
 *
 * - Vercel overwrites x-forwarded-for and x-real-ip itself, and writes the
 *   x-vercel-ip-* geo headers.
 * - Cloudflare writes cf-connecting-ip. It does NOT strip a client supplied
 *   x-forwarded-for, it appends to it, so the first entry there is whatever
 *   the caller typed. Geo comes from request.cf, which OpenNext keeps in its
 *   request context. City and region never arrive as headers unless the zone
 *   turns on a managed transform, so they are not read from headers here.
 *
 * Unset means "vercel", because that is where production runs today. The
 * Worker sets HOST_PLATFORM=cloudflare in wrangler.jsonc, committed next to
 * BZ_PLATFORM so the two cannot disagree.
 */
export type HostPlatform = "vercel" | "cloudflare";

export function hostPlatform(): HostPlatform {
  return process.env.HOST_PLATFORM === "cloudflare" ? "cloudflare" : "vercel";
}

/** The client IP the current host's edge vouches for, or null. */
export function clientIp(
  headers: Headers,
  platform: HostPlatform = hostPlatform()
): string | null {
  if (platform === "cloudflare") {
    return headers.get("cf-connecting-ip")?.trim() || null;
  }
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
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
 * subdivision code on both hosts (WC for the Western Cape), so rows written
 * before and after the move line up.
 */
export function clientGeo(
  headers: Headers,
  platform: HostPlatform = hostPlatform(),
  cf: CfGeo | undefined = platform === "cloudflare" ? requestCf() : undefined
): Geo {
  if (platform === "cloudflare") {
    return {
      city: clip(cf?.city, 120),
      region: clip(cf?.regionCode, 120),
      country: clip(cf?.country || headers.get("cf-ipcountry") || undefined, 8),
    };
  }
  const rawCity = headers.get("x-vercel-ip-city");
  let city: string | null = null;
  if (rawCity) {
    // Vercel percent encodes the city.
    try {
      city = decodeURIComponent(rawCity);
    } catch {
      city = rawCity;
    }
  }
  return {
    city: clip(city ?? undefined, 120),
    region: clip(headers.get("x-vercel-ip-country-region") ?? undefined, 120),
    country: clip(headers.get("x-vercel-ip-country") ?? undefined, 8),
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
