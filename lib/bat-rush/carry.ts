/**
 * Carrying a guest's best round out of an in-app browser.
 *
 * Instagram's browser keeps its own storage, so a score saved there is not in
 * Chrome or Safari when the player opens the game there to sign in. The game
 * puts the score in the address before sending them out, and reads it back on
 * the other side.
 *
 * This is a light wrapper so a casual edit of the address does not turn 40
 * into 270. It is not security: any signed in player can send any score up to
 * the cap straight to the database, and the cap in supabase/bat_rush.sql is
 * the only real limit. Prizes are decided by a live play-off, not the board.
 */
import { SCORE_CAP } from "./rules";

const MUL = 7919;
const ADD = 4231;

function check(n: number): string {
  return ((n * 31 + 17) % 97).toString(36);
}

export function encodeCarry(aura: number): string {
  const n = Math.max(0, Math.min(SCORE_CAP, Math.floor(aura)));
  return `${(n * MUL + ADD).toString(36)}${check(n)}`;
}

export function decodeCarry(token: string | null | undefined): number | null {
  if (!token || !/^[0-9a-z]{2,12}$/.test(token)) return null;
  for (let cut = 1; cut <= 2; cut++) {
    const body = token.slice(0, -cut);
    const sum = token.slice(-cut);
    const raw = parseInt(body, 36);
    if (!Number.isFinite(raw) || (raw - ADD) % MUL !== 0) continue;
    const n = (raw - ADD) / MUL;
    if (n >= 0 && n <= SCORE_CAP && check(n) === sum) return n;
  }
  return null;
}
