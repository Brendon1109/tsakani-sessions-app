import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service role client, for server side jobs only. Returns null if the key is
 * not set.
 *
 * It bypasses RLS, so it must never be imported by a client component, and in
 * a route a stranger can reach it may only call a narrow function with values
 * the server built itself. Its callers: the cleanup, finalize-events and
 * retention crons, all behind CRON_SECRET, and lib/rate-limit.ts, which only
 * calls rate_limit_hit with a hashed key. See
 * supabase/lock_down_inventory_functions.sql, finalize_past_events.sql,
 * retention.sql and rate_limit_fn.sql for why each needs it.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
