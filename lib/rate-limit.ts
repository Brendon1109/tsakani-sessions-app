import { createClient } from "@/lib/supabase/server";
import { clientIp } from "@/lib/request-meta";
import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight rate limiter backed by Supabase.
 * Falls back to no-op if Supabase is not configured.
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
let warnedNoSalt = false;

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
    if (!warnedNoSalt) {
      warnedNoSalt = true;
      console.error("[rate-limit] BZ_SALT is not set, so requests are not rate limited.");
    }
    return null;
  }

  // Only the header the current host's edge writes. On Cloudflare the first
  // x-forwarded-for entry is whatever the caller sent. See lib/request-meta.ts.
  const key = await rateLimitKey(bucket, clientIp(request.headers), salt);
  const now = Date.now();
  const expiresAt = new Date(now + windowSeconds * 1000).toISOString();

  const supabase = await createClient();
  if (!supabase) return null;

  // Cleanup expired entries inline (cheap)
  await supabase.from("rate_limits").delete().lt("expires_at", new Date().toISOString());

  // Try insert — if conflict, increment count
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("count, expires_at")
    .eq("key", key)
    .single();

  if (!existing) {
    await supabase.from("rate_limits").insert({ key, count: 1, expires_at: expiresAt });
    return null;
  }

  if (existing.count >= limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(existing.expires_at).getTime() - now) / 1000)
    );
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  await supabase
    .from("rate_limits")
    .update({ count: existing.count + 1 })
    .eq("key", key);

  return null;
}
