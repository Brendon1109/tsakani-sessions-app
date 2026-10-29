/**
 * The Bat Rush round itself: a canvas, requestAnimationFrame, and the spawn
 * schedule from lib/bat-rush/rules.ts. Everything on screen is a function of
 * time since the round started, so a tap is judged against where things are
 * at the moment of the tap, not where the last frame drew them.
 *
 * Built for cheap Android phones in a dark bar: devicePixelRatio is capped at
 * 2, sprites are pre-drawn, a frame is drawImage calls and a few fillText, and
 * the score and clock on top are plain DOM updated only when they change.
 */
import {
  ROUND_MS,
  SPAWNS,
  applyTap,
  crossingMs,
  planRound,
  POINTS,
  type Kind,
} from "@/lib/bat-rush/rules";
import type { Pt } from "@/lib/bat-rush/crack";
import { makeSprites, BURST, type Sprite } from "./sprites";

interface Thing {
  kind: Kind;
  born: number;
  dur: number;
  dir: 1 | -1;
  y0: number;
  amp: number;
  waves: number;
  phase: number;
  flap: number;
}

interface Burst {
  x: number;
  y: number;
  born: number;
  colour: string;
}

interface Popup {
  x: number;
  y: number;
  born: number;
  text: string;
  colour: string;
  size: number;
}

export interface EngineHooks {
  onAura: (aura: number) => void;
  onClock: (secondsLeft: number, fraction: number) => void;
  onEnd: (result: { aura: number; origin: Pt | null }) => void;
}

const POPUP_MS = 750;
const BURST_MS = 260;

export class BatRushEngine {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private rect: DOMRect | null = null;
  private sprites!: Record<Kind, Sprite>;
  private plan: Kind[];
  private next = 0;
  private live: Thing[] = [];
  private bursts: Burst[] = [];
  private popups: Popup[] = [];
  private t0 = 0;
  private raf = 0;
  private running = false;
  private aura = 0;
  private lastSecond = -1;
  private lastTap: Pt | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private hooks: EngineHooks,
    private font: string,
    private calm: boolean,
  ) {
    this.ctx = canvas.getContext("2d", { alpha: true })!;
    this.plan = planRound();
    this.resize();
  }

  resize = () => {
    const box = this.canvas.getBoundingClientRect();
    this.rect = box;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = box.width;
    this.h = box.height;
    this.canvas.width = Math.round(box.width * this.dpr);
    this.canvas.height = Math.round(box.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.sprites = makeSprites(this.w, this.dpr);
  };

  start() {
    this.t0 = performance.now();
    this.running = true;
    this.canvas.addEventListener("pointerdown", this.onPointer);
    window.addEventListener("resize", this.resize);
    this.hooks.onAura(0);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onPointer);
    window.removeEventListener("resize", this.resize);
  }

  private spawn(i: number) {
    const kind = this.plan[i];
    const born = SPAWNS[i];
    this.live.push({
      kind,
      born,
      dur: crossingMs(kind, born),
      dir: Math.random() < 0.5 ? 1 : -1,
      // Clear of the score and clock at the top, and of the very bottom edge.
      y0: 0.2 + Math.random() * 0.62,
      amp: kind === "gold" ? 0.07 + Math.random() * 0.05 : 0.02 + Math.random() * 0.05,
      waves: kind === "gold" ? 2 + Math.random() * 1.5 : 0.6 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      flap: Math.random() * Math.PI * 2,
    });
  }

  private where(thing: Thing, t: number): Pt | null {
    const p = (t - thing.born) / thing.dur;
    if (p < 0 || p > 1) return null;
    const sprite = this.sprites[thing.kind];
    const margin = sprite.w / 2;
    const span = this.w + margin * 2;
    const x = thing.dir > 0 ? -margin + span * p : this.w + margin - span * p;
    const y = this.h * (thing.y0 + thing.amp * Math.sin(thing.phase + p * thing.waves * Math.PI * 2));
    return { x, y };
  }

  private onPointer = (e: PointerEvent) => {
    if (!this.running) return;
    const rect = this.rect ?? this.canvas.getBoundingClientRect();
    const tap = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.lastTap = tap;
    const t = performance.now() - this.t0;

    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < this.live.length; i++) {
      const thing = this.live[i];
      const at = this.where(thing, t);
      if (!at) continue;
      const r = this.sprites[thing.kind].hit;
      const d = Math.hypot(at.x - tap.x, (at.y - tap.y) * 1.25);
      if (d <= r && d / r < bestScore) {
        bestScore = d / r;
        best = i;
      }
    }
    if (best === -1) return;

    const [thing] = this.live.splice(best, 1);
    const at = this.where(thing, t) ?? tap;
    this.aura = applyTap(this.aura, thing.kind);
    this.hooks.onAura(this.aura);
    this.bursts.push({ x: at.x, y: at.y, born: t, colour: BURST[thing.kind] });
    const text =
      thing.kind === "pumpkin" ? `−${-POINTS.pumpkin} negative aura` : `+${POINTS[thing.kind]}`;
    const colour = thing.kind === "gold" ? "#ffd700" : thing.kind === "pumpkin" ? "#ff6b6b" : "#ffffff";
    const size = thing.kind === "gold" ? 40 : thing.kind === "pumpkin" ? 22 : 26;
    // Keep a long popup on screen.
    const x = Math.min(this.w - 110, Math.max(110, at.x));
    this.popups.push({ x, y: at.y - 18, born: t, text, colour, size });
    if (this.popups.length > 12) this.popups.shift();
  };

  private frame = (now: number) => {
    if (!this.running) return;
    const t = now - this.t0;

    while (this.next < SPAWNS.length && SPAWNS[this.next] <= t) {
      this.spawn(this.next);
      this.next++;
    }

    const second = Math.max(0, Math.ceil((ROUND_MS - t) / 1000));
    if (second !== this.lastSecond) {
      this.lastSecond = second;
      this.hooks.onClock(second, Math.min(1, t / ROUND_MS));
    }

    this.draw(Math.min(t, ROUND_MS));

    if (t >= ROUND_MS) {
      this.running = false;
      this.canvas.removeEventListener("pointerdown", this.onPointer);
      this.hooks.onClock(0, 1);
      this.hooks.onEnd({ aura: this.aura, origin: this.lastTap });
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(t: number) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);

    this.live = this.live.filter((thing) => t - thing.born <= thing.dur);
    for (const thing of this.live) {
      const at = this.where(thing, t);
      if (!at) continue;
      const s = this.sprites[thing.kind];
      if (thing.kind === "pumpkin") {
        const tilt = Math.sin(thing.flap + t / 420) * 0.22;
        ctx.save();
        ctx.translate(at.x, at.y);
        ctx.rotate(tilt);
        ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h);
        ctx.restore();
      } else {
        const speed = thing.kind === "gold" ? 170 : 250;
        const f = 0.8 + 0.2 * Math.sin(thing.flap + (t / speed) * Math.PI);
        const hh = s.h * f;
        ctx.drawImage(s.canvas, at.x - s.w / 2, at.y - hh / 2, s.w, hh);
      }
    }

    this.bursts = this.bursts.filter((b) => t - b.born < BURST_MS);
    for (const b of this.bursts) {
      const k = (t - b.born) / BURST_MS;
      ctx.strokeStyle = `${b.colour}${(1 - k).toFixed(3)})`;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 12 + k * 34, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.popups = this.popups.filter((p) => t - p.born < POPUP_MS);
    if (this.popups.length) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of this.popups) {
        const k = (t - p.born) / POPUP_MS;
        const rise = this.calm ? 0 : k * 46;
        ctx.globalAlpha = 1 - k * k;
        ctx.font = `800 ${p.size}px ${this.font}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.strokeText(p.text, p.x, p.y - rise);
        ctx.fillStyle = p.colour;
        ctx.fillText(p.text, p.x, p.y - rise);
      }
      ctx.globalAlpha = 1;
    }
  }
}
