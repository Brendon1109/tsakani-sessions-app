/**
 * Bat Rush rounds. The database decides which round a score lands in
 * (bat_rush_submit in supabase/bat_rush.sql); these mirror its rules so the
 * admin screen and the tests agree with it.
 *
 * Times are shown and typed in Cape Town time. South Africa has no daylight
 * saving, so SAST is always UTC+2 and a fixed offset is exact.
 */
export interface BatRushRound {
  id: string;
  name: string;
  opens_at: string;
  closes_at: string;
  prize: string | null;
  winner_user_id?: string | null;
}

export type RoundStatus = "upcoming" | "open" | "closed";

const ms = (iso: string) => Date.parse(iso);

export function roundStatus(round: BatRushRound, now: number): RoundStatus {
  if (now < ms(round.opens_at)) return "upcoming";
  if (now < ms(round.closes_at)) return "open";
  return "closed";
}

/**
 * The round a score submitted now goes to: open now, and if two overlap, the
 * one that closes first. Same as bat_rush_submit.
 */
export function openRound<R extends BatRushRound>(rounds: R[], now: number): R | null {
  const open = rounds
    .filter((r) => roundStatus(r, now) === "open")
    .sort((a, b) => ms(a.closes_at) - ms(b.closes_at));
  return open[0] ?? null;
}

/**
 * The round the public board shows: the open one, else the one that closed
 * last, else the next one to open. Same as bat_rush_board.
 */
export function boardRound<R extends BatRushRound>(rounds: R[], now: number): R | null {
  const open = openRound(rounds, now);
  if (open) return open;
  const closed = rounds
    .filter((r) => roundStatus(r, now) === "closed")
    .sort((a, b) => ms(b.closes_at) - ms(a.closes_at));
  if (closed[0]) return closed[0];
  const upcoming = rounds
    .filter((r) => roundStatus(r, now) === "upcoming")
    .sort((a, b) => ms(a.opens_at) - ms(b.opens_at));
  return upcoming[0] ?? null;
}

/**
 * The round that follows this one, the next to open at or after it closes.
 * "Close now" on the admin screen opens it at the same moment, so the
 * board never sits closed between two rounds.
 */
export function followingRound<R extends BatRushRound>(rounds: R[], round: R): R | null {
  const after = rounds
    .filter((r) => r.id !== round.id && ms(r.opens_at) >= ms(round.opens_at) && ms(r.closes_at) > ms(round.closes_at))
    .sort((a, b) => ms(a.opens_at) - ms(b.opens_at));
  return after[0] ?? null;
}

/**
 * An admin edit to a round: open and close times as ISO strings, and prize
 * text. Returns the clean update or why it was refused.
 */
export function validateRoundEdit(
  body: unknown,
): { ok: true; value: { opens_at: string; closes_at: string; prize: string | null } } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Nothing to save" };
  const b = body as Record<string, unknown>;
  const opens = typeof b.opens_at === "string" ? Date.parse(b.opens_at) : NaN;
  const closes = typeof b.closes_at === "string" ? Date.parse(b.closes_at) : NaN;
  if (Number.isNaN(opens) || Number.isNaN(closes)) return { ok: false, error: "Open and close need a time" };
  if (closes <= opens) return { ok: false, error: "Close has to be after open" };
  let prize: string | null = null;
  if (b.prize !== undefined && b.prize !== null) {
    if (typeof b.prize !== "string") return { ok: false, error: "Prize has to be text" };
    prize = b.prize.trim() || null;
    if (prize && prize.length > 120) return { ok: false, error: "Prize is 120 characters at most" };
  }
  return {
    ok: true,
    value: { opens_at: new Date(opens).toISOString(), closes_at: new Date(closes).toISOString(), prize },
  };
}

const SAST_MS = 2 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/** An ISO time as the value of a datetime-local input, in SAST. */
export function toSastInput(iso: string): string {
  const d = new Date(ms(iso) + SAST_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** A datetime-local value typed in SAST, as an ISO time. Null if it is not a time. */
export function fromSastInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const t = Date.parse(`${value}:00+02:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** "19:30", in SAST. */
export function sastClock(iso: string): string {
  const d = new Date(ms(iso) + SAST_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Sat 19:30", in SAST. */
export function sastDayClock(iso: string): string {
  const d = new Date(ms(iso) + SAST_MS);
  return `${DAYS[d.getUTCDay()]} ${sastClock(iso)}`;
}
