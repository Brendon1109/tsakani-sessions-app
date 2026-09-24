import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service role client, for server side jobs only. Returns null if the key is
 * not set.
 *
 * It bypasses RLS, so it must never be imported by a client component and
 * never used in a route a stranger can reach. Today its only caller is the
 * cleanup cron, which is behind CRON_SECRET. See
 * supabase/lock_down_inventory_functions.sql for why that job needs it.
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
