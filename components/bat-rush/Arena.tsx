"use client";

import { useEffect, useRef, useState } from "react";
import { BatRushEngine } from "./engine";
import { makeCrack, drawCrack, type Pt } from "@/lib/bat-rush/crack";
import { COUNTDOWN_MS, ROUND_MS } from "@/lib/bat-rush/rules";

/**
 * One Bat Rush round on screen: 3, 2, 1, thirty seconds of bats, then the
 * glass cracks from the last tap, the screen shakes and an Android phone
 * buzzes. onDone fires once the crack has spread, and the cracked glass stays
 * up underneath whatever the parent shows next. Remount (change the key) for
 * another round.
 *
 * Under prefers-reduced-motion the crack is drawn whole at once and nothing
 * shakes.
 */
export interface ArenaProps {
  font: string;
  calm: boolean;
  /** A name over the clock, for the play-off. */
  label?: string;
  onStart?: () => void;
  onDone: (result: { aura: number }) => void;
}

const CRACK_MS = 480;

export default function Arena({ font, calm, label, onStart, onDone }: ArenaProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const gameCanvas = useRef<HTMLCanvasElement>(null);
  const crackCanvas = useRef<HTMLCanvasElement>(null);
  const auraEl = useRef<HTMLSpanElement>(null);
  const clockEl = useRef<HTMLSpanElement>(null);
  const barEl = useRef<HTMLDivElement>(null);
  const hooks = useRef({ onStart, onDone });
  const [count, setCount] = useState<number | null>(3);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    hooks.current = { onStart, onDone };
  }, [onStart, onDone]);

  useEffect(() => {
    let engine: BatRushEngine | null = null;
    let raf = 0;
    const timers: number[] = [];
    let n = 3;

    const crack = (origin: Pt | null, aura: number) => {
      const cv = crackCanvas.current;
      if (!cv) return;
      const box = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(box.width * dpr);
      cv.height = Math.round(box.height * dpr);
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const o = origin ?? { x: box.width / 2, y: box.height / 2 };
      const shape = makeCrack(o, box.width, box.height);

      try {
        navigator.vibrate?.([70, 40, 150]);
      } catch {
        // iPhones have no vibrate, and some browsers throw without a tap.
      }

      if (calm) {
        drawCrack(ctx, shape, Infinity);
        timers.push(window.setTimeout(() => hooks.current.onDone({ aura }), 250));
        return;
      }

      setShaking(true);
      const start = performance.now();
      const grow = (now: number) => {
        const k = Math.min(1, (now - start) / CRACK_MS);
        const eased = 1 - Math.pow(1 - k, 3);
        ctx.clearRect(0, 0, box.width, box.height);
        drawCrack(ctx, shape, shape.reach * eased);
        if (k < 1) {
          raf = requestAnimationFrame(grow);
        } else {
          timers.push(window.setTimeout(() => hooks.current.onDone({ aura }), 180));
        }
      };
      raf = requestAnimationFrame(grow);
    };

    const begin = () => {
      const cv = gameCanvas.current;
      if (!cv) return;
      engine = new BatRushEngine(
        cv,
        {
          onAura: (aura) => {
            if (auraEl.current) auraEl.current.textContent = String(aura);
          },
          onClock: (left, fraction) => {
            if (clockEl.current) clockEl.current.textContent = String(left);
            if (barEl.current) barEl.current.style.transform = `scaleX(${1 - fraction})`;
          },
          onEnd: ({ aura, origin }) => crack(origin, aura),
        },
        font,
        calm,
      );
      engine.start();
      hooks.current.onStart?.();
    };

    const tick = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCount(n);
      } else {
        window.clearInterval(tick);
        setCount(null);
        begin();
      }
    }, COUNTDOWN_MS / 3);

    return () => {
      window.clearInterval(tick);
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf);
      engine?.destroy();
    };
  }, [font, calm]);

  return (
    <div
      ref={wrap}
      className={`bat-rush-arena absolute inset-0 overflow-hidden ${shaking ? "bat-rush-shake" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div aria-hidden className="bat-rush-sky absolute inset-0" />
      <div
        aria-hidden
        className="halloween-moon absolute top-[14%] right-[8%] w-14 h-14 rounded-full opacity-60"
      />
      <canvas ref={gameCanvas} className="absolute inset-0 w-full h-full" />
      <canvas ref={crackCanvas} className="absolute inset-0 w-full h-full pointer-events-none" />

      <div className="absolute top-0 inset-x-0 pointer-events-none px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] text-[#ff8a1f]">AURA</div>
            <span ref={auraEl} className="block text-4xl font-black tabular-nums leading-none">
              0
            </span>
          </div>
          {label && (
            <div className="text-lg font-bold truncate max-w-[45%] text-center">{label}</div>
          )}
          <div className="text-right">
            <div className="text-[11px] font-bold tracking-[0.2em] text-white/60">TIME</div>
            <span ref={clockEl} className="block text-4xl font-black tabular-nums leading-none">
              {Math.round(ROUND_MS / 1000)}
            </span>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            ref={barEl}
            className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#ff8a1f] to-[#ffd700]"
          />
        </div>
      </div>

      {count !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            key={count}
            className="bat-rush-count text-[9rem] font-black leading-none text-[#ff8a1f] drop-shadow-[0_0_30px_rgba(255,138,31,0.6)]"
          >
            {count}
          </span>
        </div>
      )}
    </div>
  );
}
