/**
 * Instagram handles for the Bat Rush board. The same rule lives in
 * supabase/bat_rush.sql, which checks it again, so a handle the browser lets
 * through can still be refused there but never the other way round.
 */
export const HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

export type HandleResult =
  | { ok: true; handle: string | null }
  | { ok: false };

/**
 * Trims, drops one leading @ and checks what is left. Empty means no handle,
 * which is allowed: that player shows as first name and initial.
 */
export function normaliseHandle(input: string | null | undefined): HandleResult {
  const trimmed = (input ?? "").trim().replace(/^@/, "");
  if (!trimmed) return { ok: true, handle: null };
  return HANDLE_PATTERN.test(trimmed) ? { ok: true, handle: trimmed } : { ok: false };
}
