"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Crown } from "lucide-react";
import Arena from "@/components/bat-rush/Arena";
import { adminBoard, type AdminData } from "@/lib/bat-rush/admin";
import { rankFor } from "@/lib/bat-rush/rules";

/**
 * The live play-off at the DJ booth, filmed on Brendon's phone. Up to three
 * players take one round each in turn on this phone, nothing is saved, and the
 * results go up side by side with the winner. Built to film vertically: dark,
 * big countdown, big numbers, almost no words.
 */

type Step =
  | { s: "setup" }
  | { s: "ready"; i: number }
  | { s: "play"; i: number }
  | { s: "scored"; i: number }
  | { s: "results" };

interface Player {
  name: string;
  aura: number | null;
}

const input =
  "w-full bg-white/10 border border-white/15 rounded-2xl px-4 py-4 text-white text-xl font-bold placeholder:text-gray-500 focus:border-[#ff8a1f] focus:outline-none";

function PlayOff() {
  const params = useSearchParams();
  const roundId = params.get("round");
  const [names, setNames] = useState(["", "", ""]);
  const [roundName, setRoundName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [step, setStep] = useState<Step>({ s: "setup" });
  const [run, setRun] = useState(0);
  // A thumb still tapping when the clock hits zero must not skip the score
  // shot or start the next player's round.
  const [armed, setArmed] = useState(true);
  const armTimer = useRef(0);
  const [env, setEnv] = useState({ font: "system-ui, sans-serif", calm: false });

  // Fill in the round's top three, still editable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextEnv = {
        font: getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
        calm: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
      let top: string[] = [];
      let label = "";
      if (roundId) {
        try {
          const res = await fetch("/api/admin/halloween", { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as AdminData;
            const round = data.rounds.find((r) => r.id === roundId);
            if (round) {
              label = round.name;
              top = adminBoard(data, round.id)
                .slice(0, 3)
                .map((r) => r.shown);
            }
          }
        } catch {
          // Type the names in, then.
        }
      }
      if (cancelled) return;
      setEnv(nextEnv);
      setRoundName(label);
      // Fill in the top three only if nobody has typed yet.
      if (top.length) setNames((typed) => (typed.some((n) => n.trim()) ? typed : [top[0] ?? "", top[1] ?? "", top[2] ?? ""]));
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  // Nothing behind the play-off scrolls or bounces while it is up.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-bat-rush-lock", "");
    return () => root.removeAttribute("data-bat-rush-lock");
  }, []);

  const start = () => {
    const list = names.map((n) => n.trim()).filter(Boolean).slice(0, 3);
    if (!list.length) return;
    setPlayers(list.map((name) => ({ name, aura: null })));
    setStep({ s: "ready", i: 0 });
  };

  const go = (i: number) => {
    setRun((r) => r + 1);
    setStep({ s: "play", i });
  };

  const holdTaps = () => {
    setArmed(false);
    window.clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => setArmed(true), 900);
  };

  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  const onDone = ({ aura }: { aura: number }) => {
    if (step.s !== "play") return;
    const i = step.i;
    setPlayers((list) => list.map((p, j) => (j === i ? { ...p, aura } : p)));
    setStep({ s: "scored", i });
    holdTaps();
  };

  const top = useMemo(() => Math.max(...players.map((p) => p.aura ?? -1)), [players]);
  const leaders = players.filter((p) => p.aura === top);
  const tie = step.s === "results" && leaders.length > 1;

  const runItBack = () => {
    setPlayers(leaders.map((p) => ({ name: p.name, aura: null })));
    setStep({ s: "ready", i: 0 });
  };

  const current = step.s === "ready" || step.s === "play" || step.s === "scored" ? players[step.i] : null;

  return (
    <div className="fixed inset-0 z-[70] bg-[#050308] text-white overflow-hidden">
      <div aria-hidden className="bat-rush-sky absolute inset-0" />

      {step.s === "setup" && (
        <div className="relative h-full overflow-y-auto px-5 pt-10 pb-10 max-w-md mx-auto">
          <p className="text-xs font-bold tracking-[0.3em] text-[#ff8a1f]">BAT RUSH</p>
          <h1 className="text-5xl font-black mt-1">PLAY-OFF</h1>
          {roundName && <p className="text-xl text-gray-300 mt-1">{roundName}</p>}
          <div className="mt-8 space-y-3">
            {names.map((n, i) => (
              <input
                key={i}
                aria-label={`Player ${i + 1}`}
                value={n}
                onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Player ${i + 1}`}
                maxLength={40}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={input}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={start}
            disabled={!names.some((n) => n.trim())}
            className="mt-8 w-full h-16 rounded-full bg-gradient-to-r from-[#ff8a1f] to-[#ffd700] text-black text-2xl font-black disabled:opacity-40"
          >
            START
          </button>
          <Link href="/admin/halloween" className="block text-center mt-6 text-gray-400 font-semibold">
            Back to Bat Rush admin
          </Link>
        </div>
      )}

      {step.s === "ready" && current && (
        <button
          type="button"
          onClick={() => go(step.i)}
          disabled={!armed}
          className="relative h-full w-full flex flex-col items-center justify-center px-6 text-center"
        >
          <span className="text-sm font-bold tracking-[0.35em] text-gray-400">
            PLAYER {step.i + 1} OF {players.length}
          </span>
          <span className="mt-4 text-6xl font-black break-all leading-tight">{current.name}</span>
          <span className="mt-10 rounded-full bg-gradient-to-r from-[#ff8a1f] to-[#ffd700] text-black text-2xl font-black px-10 py-5">
            TAP TO PLAY
          </span>
        </button>
      )}

      {(step.s === "play" || step.s === "scored") && current && (
        <div className="absolute inset-0">
          <Arena key={run} font={env.font} calm={env.calm} label={current.name} onDone={onDone} />
          {step.s === "scored" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center bg-black/55">
              <span className="text-3xl font-black break-all">{current.name}</span>
              <span className="mt-2 text-[8rem] font-black leading-none tabular-nums drop-shadow-[0_0_30px_rgba(255,138,31,0.7)]">
                {current.aura}
              </span>
              <span className="text-3xl font-black text-[#ff8a1f]">{rankFor(current.aura ?? 0)}</span>
              <button
                type="button"
                disabled={!armed}
                onClick={() => {
                  holdTaps();
                  if (step.i + 1 < players.length) setStep({ s: "ready", i: step.i + 1 });
                  else setStep({ s: "results" });
                }}
                className="mt-10 rounded-full bg-white text-black text-2xl font-black px-10 py-5"
              >
                {step.i + 1 < players.length ? "NEXT PLAYER" : "RESULTS"}
              </button>
            </div>
          )}
        </div>
      )}

      {step.s === "results" && (
        <div className="relative h-full flex flex-col items-center justify-center px-3 text-center">
          <p className="text-sm font-bold tracking-[0.35em] text-[#ff8a1f]">
            {roundName ? `${roundName.toUpperCase()} PLAY-OFF` : "PLAY-OFF"}
          </p>
          <h2 className="text-5xl font-black mt-2">{tie ? "TIE" : "WINNER"}</h2>
          <div className="mt-8 w-full max-w-lg grid gap-2" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
            {players.map((p, i) => {
              const won = !tie && p.aura === top;
              return (
                <div
                  key={i}
                  className={`rounded-3xl border px-2 py-6 flex flex-col items-center ${
                    won ? "border-[#ffd700] bg-[#ffd700]/10 shadow-[0_0_40px_rgba(255,215,0,0.35)]" : "border-white/15 bg-white/[0.04]"
                  }`}
                >
                  {won ? <Crown size={36} className="text-[#ffd700]" /> : <span className="h-9" />}
                  <span className="mt-2 text-lg font-black break-all leading-tight">{p.name}</span>
                  <span className={`mt-3 text-6xl font-black tabular-nums ${won ? "text-[#ffd700]" : "text-white"}`}>
                    {p.aura}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-10 flex flex-col gap-3 w-full max-w-xs">
            {tie && (
              <button
                type="button"
                onClick={runItBack}
                className="rounded-full bg-gradient-to-r from-[#ff8a1f] to-[#ffd700] text-black text-xl font-black py-4"
              >
                RUN IT BACK
              </button>
            )}
            <button
              type="button"
              onClick={() => setStep({ s: "setup" })}
              className="rounded-full border border-white/20 font-bold py-3.5"
            >
              New play-off
            </button>
            <Link href="/admin/halloween" className="text-gray-400 font-semibold py-2">
              Back to Bat Rush admin
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlayOffPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[70] bg-[#050308]" />}>
      <PlayOff />
    </Suspense>
  );
}
