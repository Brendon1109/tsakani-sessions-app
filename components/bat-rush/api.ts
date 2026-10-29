/**
 * The two database calls the game makes, straight from the browser to
 * Supabase with the anon key and, when signed in, the player's own session.
 * Neither goes through a Next route, so neither costs the Worker anything.
 * The CSP already allows connect-src https://*.supabase.co.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Board } from "./Leaderboard";

export async function fetchBoard(
  supabase: SupabaseClient,
  slug: string,
  now: number,
): Promise<Board | null> {
  const { data, error } = await supabase.rpc("bat_rush_board", { p_event_slug: slug });
  if (error || !data || typeof data !== "object") return null;
  const raw = data as Omit<Board, "status">;
  const rows = Array.isArray(raw.rows) ? raw.rows : [];
  let status: Board["status"] = "none";
  if (raw.round) {
    if (raw.round.open) status = "open";
    else if (now < Date.parse(raw.round.opens_at)) status = "upcoming";
    else status = "closed";
  }
  return { round: raw.round ?? null, rows, status };
}

export type SubmitOutcome =
  | { ok: true; round: string; rank: number; best: number; name: string }
  | {
      ok: false;
      reason:
        | "need_handle"
        | "bad_handle"
        | "closed"
        | "too_soon"
        | "bad_score"
        | "no_event"
        | "signed_out"
        | "error";
    };

export async function submitAura(
  supabase: SupabaseClient,
  args: { slug: string; aura: number; handle?: string | null; showHandle?: boolean | null },
): Promise<SubmitOutcome> {
  const { data, error } = await supabase.rpc("bat_rush_submit", {
    p_event_slug: args.slug,
    p_aura: args.aura,
    p_handle: args.handle ?? null,
    p_show_handle: args.showHandle ?? null,
  });
  if (error) {
    // 42501 is the function refusing a caller with no user, or PostgREST
    // refusing anon. Either way the session is gone.
    if (error.code === "42501" || /jwt/i.test(error.message)) return { ok: false, reason: "signed_out" };
    return { ok: false, reason: "error" };
  }
  if (!data || typeof data !== "object") return { ok: false, reason: "error" };
  return data as SubmitOutcome;
}

/** Change or withdraw the player's own handle, without saving a score. */
export async function setHandle(
  supabase: SupabaseClient,
  args: { slug: string; handle: string | null; show: boolean },
): Promise<{ ok: true; name: string } | { ok: false; reason: string }> {
  const { data, error } = await supabase.rpc("bat_rush_set_handle", {
    p_event_slug: args.slug,
    p_handle: args.handle,
    p_show_handle: args.show,
  });
  if (error) return { ok: false, reason: error.code === "42501" ? "signed_out" : "error" };
  if (!data || typeof data !== "object") return { ok: false, reason: "error" };
  return data as { ok: true; name: string } | { ok: false; reason: string };
}
