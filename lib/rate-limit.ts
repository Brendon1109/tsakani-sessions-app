import { createServiceClient } from "@/lib/supabase/service";
import { clientIp } from "@/lib/request-meta";
import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight rate limiter backed by Supabase.
 *
 * One call to rate_limit_hit per request, on the service role key, which
 * counts the hit and says whether it is allowed (supabase/rate_limit_fn.sql).
 * It used to read and write rate_limits on the anon key, which RLS refuses,
 * so nothing was ever limited. The service client is used for that one
 * function and nothing else, with a key this file built itself.
 *
 * Fails open. Missing configuration, a database error or anything thrown lets
 * the request through: a visitor must never be locked out because the
 * limiter is having a bad day.
 *
 * Usage:
 *   const rl = await rateLimit(request, "orders", 5, 60); // 5/min
 *   if (rl) return rl;  // 429 response
 *
 * The key never holds an IP address. It is the bucket plus an HMAC of the IP
 * under BZ_SALT, the site's server only secret that the Breazy Analytics
 * collect route already uses, with a "rate-limit:" prefix so the value has
 * nothing in common with the daily counting value made from the same salt.
 * Without the salt there is no way to make a key that is not the IP itself,
 * so the limiter stands aside rather than store one.
 */

const encoder = new TextEncoder();
let warned = false;

function warnOnce(message: string) {
  if (warned) return;
  warned = true;
  console.error(`[rate-limit] ${message}`);
}

export async function rateLimitKey(
  bucket: string,
  ip: string | null,
  salt: string
): Promise<string> {
  if (!ip) return `${bucket}:anonymous`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`rate-limit:${ip}`))
  );
  let hex = "";
  for (const byte of mac.subarray(0, 16)) hex += byte.toString(16).padStart(2, "0");
  return `${bucket}:${hex}`;
}

export async function rateLimit(
  request: NextRequest,
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  const salt = process.env.BZ_SALT;
  if (!salt) {
    warnOnce("BZ_SALT is not set, so requests are not rate limited.");
    return null;
  }

  const service = createServiceClient();
  if (!service) {
    warnOnce("SUPABASE_SERVICE_ROLE_KEY is not set, so requests are not rate limited.");
    return null;
  }

  try {
    // Only the header the current host's edge writes. On Cloudflare the first
    // x-forwarded-for entry is whatever the caller sent. See lib/request-meta.ts.
    const key = await rateLimitKey(bucket, clientIp(request.headers), salt);

    const { data, error } = await service.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] check failed, letting the request through:", error.message);
      return null;
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: boolean; retry_after?: number }
      | null
      | undefined;
    if (row?.allowed !== false) return null;

    const retryAfter = Math.max(1, Math.ceil(Number(row.retry_after) || windowSeconds));
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  } catch (e) {
    console.error(
      "[rate-limit] check threw, letting the request through:",
      e instanceof Error ? e.message : String(e)
    );
    return null;
  }
}
