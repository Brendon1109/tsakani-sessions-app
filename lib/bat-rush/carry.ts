/**
 * Carrying a guest's best round out of an in-app browser.
 *
 * Instagram's browser keeps its own storage, so a score saved there is not in
 * Chrome or Safari when the player opens the game there to sign in. The game
 * puts the score in the address before sending them out, and reads it back on
 * the other side.
 *
 * The token carries the minute it was made and lasts 30 minutes, so a copied
 * link pasted in a group chat stops handing out its score, and a score from
 * one round cannot land in the next an hour later. A carried score never
 * saves by itself: the player taps Save on the other side.
 *
 * The checksum only stops a casual edit of the address turning 40 into 270.
 * It is not security: any signed in player can send any score up to the cap
 * straight to the database, and the cap in supabase/bat_rush.sql is the only
 * real limit. A winner with a score that looks too good plays one round in
 * front of the team before a prize changes hands.
 */
import { SCORE_CAP } from "./rules";

const MUL = 7919;
const ADD = 4231;
export const CARRY_TTL_MS = 30 * 60 * 1000;
const SKEW_MS = 5 * 60 * 1000;

function check(n: number, minute: number): string {
  return ((n * 31 + minute * 7 + 17) % 97).toString(36);
}

export function encodeCarry(aura: number, now: number): string {
  const n = Math.max(0, Math.min(SCORE_CAP, Math.floor(aura)));
  const minute = Math.floor(now / 60_000);
  return `${(n * MUL + ADD).toString(36)}${check(n, minute)}.${minute.toString(36)}`;
}

export function decodeCarry(
  token: string | null | undefined,
  now: number,
): { aura: number; at: number } | null {
  if (!token || !/^[0-9a-z]{2,12}\.[0-9a-z]{4,10}$/.test(token)) return null;
  const [head, stamp] = token.split(".");
  const minute = parseInt(stamp, 36);
  if (!Number.isFinite(minute)) return null;
  const at = minute * 60_000;
  if (at > now + SKEW_MS || now - at > CARRY_TTL_MS) return null;
  for (let cut = 1; cut <= 2; cut++) {
    const raw = parseInt(head.slice(0, -cut), 36);
    if (!Number.isFinite(raw) || (raw - ADD) % MUL !== 0) continue;
    const n = (raw - ADD) / MUL;
    if (n >= 0 && n <= SCORE_CAP && check(n, minute) === head.slice(-cut)) return { aura: n, at };
  }
  return null;
}
