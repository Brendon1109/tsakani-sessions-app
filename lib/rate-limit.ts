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
 */
export async function rateLimit(
  request: NextRequest,
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  // Only the header the current host's edge writes. On Cloudflare the first
  // x-forwarded-for entry is whatever the caller sent. See lib/request-meta.ts.
  const ip = clientIp(request.headers) || "anonymous";

  const key = `${bucket}:${ip}`;
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
