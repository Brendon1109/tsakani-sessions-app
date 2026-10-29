/**
 * The admin view of a Bat Rush round: best aura per player, ranked the way
 * bat_rush_board ranks it (higher aura first, and on a tie whoever got there
 * first), with the extras only an admin sees.
 */
import type { BatRushRound } from "./rounds";
import type { CsvPlayer } from "./csv";

export interface AdminPlayer {
  user_id: string;
  display_name: string;
  instagram_handle: string | null;
  show_handle: boolean;
  created_at: string;
  profiles: { email: string | null; full_name: string | null } | null;
}

export interface AdminScore {
  id: number;
  round_id: string;
  user_id: string;
  aura: number;
  created_at: string;
}

export interface AdminData {
  event: { id: string; slug: string; title: string; date: string };
  rounds: BatRushRound[];
  players: AdminPlayer[];
  scores: AdminScore[];
}

export interface AdminBoardRow {
  rank: number;
  score_id: number;
  user_id: string;
  aura: number;
  at: string;
  /** What the public board shows. */
  shown: string;
  handle: string | null;
  google_name: string | null;
  email: string | null;
  saves: number;
}

export function shownName(player: AdminPlayer | undefined): string {
  if (!player) return "Player";
  return player.show_handle && player.instagram_handle ? `@${player.instagram_handle}` : player.display_name;
}

export function adminBoard(data: Pick<AdminData, "players" | "scores">, roundId: string): AdminBoardRow[] {
  const players = new Map(data.players.map((p) => [p.user_id, p]));
  const best = new Map<string, AdminScore>();
  const saves = new Map<string, number>();
  for (const s of data.scores) {
    if (s.round_id !== roundId) continue;
    saves.set(s.user_id, (saves.get(s.user_id) ?? 0) + 1);
    const held = best.get(s.user_id);
    if (
      !held ||
      s.aura > held.aura ||
      (s.aura === held.aura && Date.parse(s.created_at) < Date.parse(held.created_at))
    ) {
      best.set(s.user_id, s);
    }
  }
  return [...best.values()]
    .sort((a, b) => b.aura - a.aura || Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((s, i) => {
      const p = players.get(s.user_id);
      return {
        rank: i + 1,
        score_id: s.id,
        user_id: s.user_id,
        aura: s.aura,
        at: s.created_at,
        shown: shownName(p),
        handle: p?.instagram_handle ?? null,
        google_name: p?.profiles?.full_name ?? null,
        email: p?.profiles?.email ?? null,
        saves: saves.get(s.user_id) ?? 0,
      };
    });
}

/** Everyone who gave a handle, with their best aura across the event. */
export function csvPlayers(data: Pick<AdminData, "players" | "scores">): CsvPlayer[] {
  const best = new Map<string, number>();
  for (const s of data.scores) best.set(s.user_id, Math.max(best.get(s.user_id) ?? 0, s.aura));
  return data.players
    .filter((p) => p.instagram_handle)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((p) => ({
      handle: p.instagram_handle,
      show_handle: p.show_handle,
      best_aura: best.get(p.user_id) ?? null,
      first_played: p.created_at,
    }));
}
