"use client";

import { Crown, RefreshCw } from "lucide-react";
import { sastClock, sastDayClock } from "@/lib/bat-rush/rounds";

export interface BoardRow {
  rank: number;
  name: string;
  aura: number;
  winner: boolean;
}

export interface Board {
  round: {
    name: string;
    opens_at: string;
    closes_at: string;
    prize: string | null;
    open: boolean;
  } | null;
  rows: BoardRow[];
  /** Worked out when the board was fetched, so render stays pure. */
  status: "open" | "closed" | "upcoming" | "none";
}

/**
 * The public top 10, straight from bat_rush_board in Supabase. It refreshes
 * after each game and when tapped, never on a timer: a few hundred phones
 * polling would spend the day's requests for nothing.
 */
export default function Leaderboard({
  board,
  loading,
  onRefresh,
}: {
  board: Board | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const round = board?.round ?? null;
  let label = "";
  if (round && board) {
    if (board.status === "open") label = `${round.name} · closes ${sastClock(round.closes_at)}`;
    else if (board.status === "upcoming") label = `${round.name} · opens ${sastDayClock(round.opens_at)}`;
    else label = `${round.name} · closed`;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black tracking-wide">LEADERBOARD</h2>
          {label && <p className="text-sm text-gray-400 truncate">{label}</p>}
          {round?.prize && <p className="text-sm text-gold-500 font-semibold mt-0.5">{round.prize}</p>}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh the leaderboard"
          className="shrink-0 w-11 h-11 rounded-full border border-white/15 flex items-center justify-center text-gray-300 active:bg-white/10"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {!board && <p className="mt-4 text-gray-500 text-sm">{loading ? "Loading" : "Board unavailable"}</p>}

      {board && board.rows.length === 0 && (
        <p className="mt-4 text-gray-400">No aura on the board yet. Be first.</p>
      )}

      {board && board.rows.length > 0 && (
        <ol className="mt-3 divide-y divide-white/5">
          {board.rows.map((row) => (
            <li key={row.rank} className="flex items-center gap-3 py-2.5">
              <span
                className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-black ${
                  row.rank === 1
                    ? "bg-[#ffd700] text-black"
                    : row.rank === 2
                      ? "bg-[#d9dde3] text-black"
                      : row.rank === 3
                        ? "bg-[#d08a4a] text-black"
                        : "bg-white/10 text-gray-300"
                }`}
              >
                {row.rank}
              </span>
              <span className="flex-1 min-w-0 truncate font-semibold">
                {row.name}
                {row.winner && <Crown size={16} className="inline ml-1.5 -mt-1 text-[#ffd700]" aria-label="Winner" />}
              </span>
              <span className="font-black tabular-nums text-gold-500">{row.aura}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
