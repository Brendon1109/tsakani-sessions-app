import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase server client. Returns null if env vars are not set.
 *
 * Async since Next 15, because cookies() returns a promise, and Next 16
 * removed the synchronous fallback. Every caller awaits it.
 *
 * Reading cookies makes every page that calls this render per request. That
 * is why the public pages carry no `revalidate`: it never took effect on
 * them, and the Worker runs without an incremental cache on purpose. See
 * docs/CLOUDFLARE-MOVE.md before adding one.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component where
            // cookies cannot be set. This can be ignored if middleware
            // refreshes the session.
          }
        },
      },
    }
  );
}
