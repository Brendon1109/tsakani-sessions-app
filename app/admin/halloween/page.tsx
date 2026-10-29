"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Crown, Download, Gamepad2, Image as ImageIcon, Loader2, RefreshCw, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { top3Card } from "@/components/bat-rush/cards";
import { adminBoard, csvPlayers, type AdminBoardRow, type AdminData } from "@/lib/bat-rush/admin";
import { playersCsv } from "@/lib/bat-rush/csv";
import {
  fromSastInput,
  roundStatus,
  sastDayClock,
  toSastInput,
  type BatRushRound,
} from "@/lib/bat-rush/rounds";

/**
 * Bat Rush admin. The rounds with their times and prizes, close a round now,
 * each round's board with the Google name and email only admins see, delete a
 * score, mark the play-off winner, the CSV of players who gave a handle, and a
 * Top 3 story card to screenshot when a round closes.
 *
 * Times are typed in Cape Town time. Every text field is text-base: anything
 * under 16px makes iPhone Safari zoom in and leave the page cut off.
 */

const input =
  "w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2.5 text-white text-base focus:border-gold-500 focus:outline-none";

interface Draft {
  opens: string;
  closes: string;
  prize: string;
}

export default function AdminBatRushPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState<AdminBoardRow | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/halloween", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load");
      const next = body as AdminData;
      const at = Date.now();
      setNow(at);
      setData(next);
      setDrafts(
        Object.fromEntries(
          next.rounds.map((r) => [
            r.id,
            { opens: toSastInput(r.opens_at), closes: toSastInput(r.closes_at), prize: r.prize ?? "" },
          ]),
        ),
      );
      setSelected((current) => {
        if (current && next.rounds.some((r) => r.id === current)) return current;
        const open = next.rounds.find((r) => roundStatus(r, at) === "open");
        const closed = [...next.rounds].reverse().find((r) => roundStatus(r, at) === "closed");
        return (open ?? closed ?? next.rounds[0])?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const round = data?.rounds.find((r) => r.id === selected) ?? null;
  const rows = useMemo(() => (data && selected ? adminBoard(data, selected) : []), [data, selected]);

  const call = async (method: string, body: unknown, label: string) => {
    setBusy(label);
    setNotice("");
    try {
      const res = await fetch("/api/admin/halloween", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Failed");
      await load();
      return out;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const saveRound = async (r: BatRushRound) => {
    const d = drafts[r.id];
    const opens = fromSastInput(d.opens);
    const closes = fromSastInput(d.closes);
    if (!opens || !closes) {
      setNotice("Pick a date and time for open and close.");
      return;
    }
    const out = await call("PATCH", { id: r.id, opens_at: opens, closes_at: closes, prize: d.prize }, `save-${r.id}`);
    if (out) setNotice(`${r.name} saved.`);
  };

  const closeNow = async (r: BatRushRound) => {
    const out = await call("POST", { action: "close", id: r.id }, `close-${r.id}`);
    if (out) setNotice(out.opened ? `${out.closed} closed. ${out.opened} is open.` : `${out.closed} closed.`);
  };

  const markWinner = async (row: AdminBoardRow) => {
    if (!round) return;
    const clear = round.winner_user_id === row.user_id;
    await call("POST", { action: "winner", round_id: round.id, user_id: clear ? null : row.user_id }, `win-${row.user_id}`);
  };

  const deleteScore = async () => {
    if (!removing) return;
    const row = removing;
    setRemoving(null);
    await call("DELETE", { score_id: row.score_id }, `del-${row.score_id}`);
  };

  const downloadCsv = () => {
    if (!data) return;
    const blob = new Blob([playersCsv(csvPlayers(data))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bat-rush-handles-${data.event.slug}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const makeCard = async () => {
    if (!round) return;
    setBusy("card");
    try {
      const blob = await top3Card({
        round: round.name,
        rows: rows.slice(0, 3).map((r) => ({ name: r.shown, aura: r.aura, winner: r.user_id === round.winner_user_id })),
        prize: round.prize,
        font: getComputedStyle(document.body).fontFamily,
      });
      if (card) URL.revokeObjectURL(card);
      setCard(URL.createObjectURL(blob));
    } finally {
      setBusy(null);
    }
  };

  const handles = data ? data.players.filter((p) => p.instagram_handle).length : 0;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gamepad2 className="text-gold-500" /> Bat Rush
          </h1>
          <p className="text-gray-400 text-sm">
            {data ? `${data.event.title.trim()} · ${data.players.length} players · ${handles} handles` : "Halloween game"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={selected ? `/admin/halloween/playoff?round=${selected}` : "/admin/halloween/playoff"}
            className="bg-gold-gradient text-black font-semibold px-4 py-2.5 rounded-lg"
          >
            Play-off
          </Link>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!data}
            className="border border-white/15 px-4 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} /> CSV
          </button>
          <button
            type="button"
            onClick={load}
            aria-label="Refresh"
            className="border border-white/15 px-3 py-2.5 rounded-lg"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}
      {notice && <p className="mb-4 text-gold-500">{notice}</p>}

      <h2 className="font-semibold mb-3">Rounds</h2>
      <div className="grid gap-3 sm:grid-cols-2 mb-8">
        {data?.rounds.map((r) => {
          const status = roundStatus(r, now);
          const d = drafts[r.id];
          return (
            <div
              key={r.id}
              className={`rounded-xl border p-4 ${selected === r.id ? "border-gold-500/60 bg-gold-500/5" : "border-white/10 bg-dark-500"}`}
            >
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setSelected(r.id)} className="font-bold text-lg text-left">
                  {r.name}
                </button>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                    status === "open"
                      ? "bg-green-500/15 text-green-400"
                      : status === "upcoming"
                        ? "bg-white/10 text-gray-300"
                        : "bg-red-500/10 text-red-300"
                  }`}
                >
                  {status === "open" ? "Open" : status === "upcoming" ? "Up next" : "Closed"}
                </span>
              </div>
              {d && (
                <div className="space-y-2">
                  <label className="block text-xs text-gray-400">
                    Opens (SAST)
                    <input
                      type="datetime-local"
                      value={d.opens}
                      onChange={(e) => setDrafts({ ...drafts, [r.id]: { ...d, opens: e.target.value } })}
                      className={input}
                    />
                  </label>
                  <label className="block text-xs text-gray-400">
                    Closes (SAST)
                    <input
                      type="datetime-local"
                      value={d.closes}
                      onChange={(e) => setDrafts({ ...drafts, [r.id]: { ...d, closes: e.target.value } })}
                      className={input}
                    />
                  </label>
                  <label className="block text-xs text-gray-400">
                    Prize
                    <input
                      type="text"
                      maxLength={120}
                      value={d.prize}
                      placeholder="Not set"
                      onChange={(e) => setDrafts({ ...drafts, [r.id]: { ...d, prize: e.target.value } })}
                      className={input}
                    />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => saveRound(r)}
                  disabled={busy !== null}
                  className="bg-white text-black font-semibold px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {busy === `save-${r.id}` && <Loader2 size={14} className="animate-spin" />} Save
                </button>
                {status === "open" && (
                  <button
                    type="button"
                    onClick={() => closeNow(r)}
                    disabled={busy !== null}
                    className="border border-red-500/40 text-red-300 font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    Close now
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(r.id)}
                  className="border border-white/15 px-4 py-2 rounded-lg"
                >
                  Board
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {round && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold">
              {round.name} board{" "}
              <span className="text-gray-400 font-normal text-sm">
                {sastDayClock(round.opens_at)} to {sastDayClock(round.closes_at)} · {rows.length} players
              </span>
            </h2>
            <button
              type="button"
              onClick={makeCard}
              disabled={rows.length === 0 || busy === "card"}
              className="border border-white/15 px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              <ImageIcon size={16} /> Top 3 card
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="text-gray-500 mb-8">No saved scores in this round yet.</p>
          ) : (
            <div className="overflow-x-auto mb-8 rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-dark-500 text-gray-400 text-left">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">On the board</th>
                    <th className="px-3 py-2">Google name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2 text-right">Aura</th>
                    <th className="px-3 py-2">Saved</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((row) => {
                    const winner = round.winner_user_id === row.user_id;
                    return (
                      <tr key={row.user_id} className={winner ? "bg-gold-500/10" : ""}>
                        <td className="px-3 py-2 font-bold">{row.rank}</td>
                        <td className="px-3 py-2 font-semibold whitespace-nowrap">
                          {row.shown}
                          {winner && <Crown size={14} className="inline ml-1 text-gold-500" />}
                          {row.handle && !row.shown.startsWith("@") && (
                            <span className="block text-xs text-gray-500">@{row.handle} hidden</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.google_name ?? ""}</td>
                        <td className="px-3 py-2">{row.email ?? ""}</td>
                        <td className="px-3 py-2 text-right font-black text-gold-500">{row.aura}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-400">
                          {sastDayClock(row.at)} · {row.saves}x
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => markWinner(row)}
                            disabled={busy !== null}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold mr-2 ${
                              winner ? "border-gold-500 text-gold-500" : "border-white/15 text-gray-300"
                            }`}
                          >
                            {winner ? "Winner" : "Mark winner"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemoving(row)}
                            disabled={busy !== null}
                            aria-label={`Delete ${row.shown}'s score`}
                            className="p-1.5 rounded-lg border border-red-500/30 text-red-300 align-middle"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {card && (
            <div className="mb-8">
              <p className="text-sm text-gray-400 mb-2">Screenshot it, or long press to save.</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL from a canvas, next/image cannot load it */}
              <img src={card} alt={`${round.name} top 3`} className="w-full max-w-xs rounded-xl border border-white/10" />
              <a
                href={card}
                download={`bat-rush-${round.name.toLowerCase().replace(/\s+/g, "-")}-top3.png`}
                className="inline-flex items-center gap-2 mt-3 border border-white/15 px-4 py-2 rounded-lg"
              >
                <Download size={16} /> Download
              </a>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={removing !== null}
        title="Delete this score?"
        message={
          removing
            ? `${removing.shown}, ${removing.aura} aura in ${round?.name ?? "this round"}. Their next best save in the round takes its place.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={deleteScore}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
