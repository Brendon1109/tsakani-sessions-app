/**
 * Bat Rush sprites, drawn once per round onto small offscreen canvases so a
 * frame is a handful of drawImage calls. Glows are canvas shadows, which are
 * slow on cheap Android phones, so they are paid for here and never per frame.
 */
import { BAT_PATH, GOLD, NIGHT, PUMPKIN } from "@/lib/bat-rush/shapes";
import type { Kind } from "@/lib/bat-rush/rules";

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Drawn size in CSS pixels, glow included. */
  w: number;
  h: number;
  /** Tap radius in CSS pixels, a little bigger than the body. */
  hit: number;
}

function blank(w: number, h: number, dpr: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

function batSprite(width: number, dpr: number, gold: boolean): Sprite {
  const pad = gold ? 16 : 10;
  const bodyH = width * 0.4;
  const w = width + pad * 2;
  const h = bodyH + pad * 2;
  const { canvas, ctx } = blank(w, h, dpr);
  const path = new Path2D(BAT_PATH);
  const s = width / 100;

  ctx.translate(pad, pad);
  ctx.scale(s, s);
  ctx.shadowColor = gold ? "rgba(255,215,0,0.95)" : "rgba(255,138,31,0.8)";
  ctx.shadowBlur = (gold ? 16 : 9) * dpr;
  if (gold) {
    const g = ctx.createLinearGradient(0, 0, 100, 40);
    g.addColorStop(0, "#fff6c2");
    g.addColorStop(0.5, GOLD);
    g.addColorStop(1, "#d4a000");
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = NIGHT;
  }
  ctx.fill(path);
  // A second fill doubles the glow without a bigger blur.
  ctx.fill(path);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 1.8 / s;
  ctx.strokeStyle = gold ? "#fffbe6" : "rgba(255,138,31,0.95)";
  ctx.stroke(path);

  // Two small eyes, so a bat reads as a creature and not a smudge.
  ctx.fillStyle = gold ? NIGHT : PUMPKIN;
  ctx.beginPath();
  ctx.arc(48, 22, 1.6, 0, Math.PI * 2);
  ctx.arc(52, 22, 1.6, 0, Math.PI * 2);
  ctx.fill();

  return { canvas, w, h, hit: width * 0.55 };
}

function pumpkinSprite(size: number, dpr: number): Sprite {
  const pad = 12;
  const w = size + pad * 2;
  const h = size + pad * 2;
  const { canvas, ctx } = blank(w, h, dpr);
  const cx = w / 2;
  const cy = h / 2 + size * 0.05;
  const rx = size * 0.5;
  const ry = size * 0.42;

  ctx.shadowColor = "rgba(255,138,31,0.75)";
  ctx.shadowBlur = 12 * dpr;
  const body = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, size * 0.05, cx, cy, rx * 1.1);
  body.addColorStop(0, "#ffc27a");
  body.addColorStop(0.55, PUMPKIN);
  body.addColorStop(1, "#b8460a");
  ctx.fillStyle = body;
  for (const [dx, k] of [[-0.42, 0.62], [0.42, 0.62], [0, 0.66]] as const) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * rx, cy, rx * k, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  // Ribs.
  ctx.strokeStyle = "rgba(124,45,18,0.55)";
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (const dx of [-0.32, 0.32]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * rx, cy, rx * 0.28, ry * 0.96, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Stem.
  ctx.fillStyle = "#4d5b16";
  ctx.beginPath();
  ctx.rect(cx - size * 0.06, cy - ry - size * 0.12, size * 0.12, size * 0.17);
  ctx.fill();

  // A lit face, so it reads as the thing not to tap even in a dark bar.
  ctx.shadowColor = "rgba(255,220,120,0.9)";
  ctx.shadowBlur = 6 * dpr;
  ctx.fillStyle = "#ffe27a";
  const eye = (ex: number) => {
    ctx.beginPath();
    ctx.moveTo(cx + ex - size * 0.1, cy - size * 0.02);
    ctx.lineTo(cx + ex, cy - size * 0.17);
    ctx.lineTo(cx + ex + size * 0.1, cy - size * 0.02);
    ctx.closePath();
    ctx.fill();
  };
  eye(-size * 0.17);
  eye(size * 0.17);
  ctx.beginPath();
  const my = cy + size * 0.1;
  ctx.moveTo(cx - size * 0.27, my);
  for (let i = 0; i <= 6; i++) {
    const x = cx - size * 0.27 + (size * 0.54 * i) / 6;
    ctx.lineTo(x, i % 2 ? my + size * 0.07 : my + size * 0.13);
  }
  ctx.lineTo(cx + size * 0.27, my);
  ctx.quadraticCurveTo(cx, my + size * 0.26, cx - size * 0.27, my);
  ctx.fill();

  return { canvas, w, h, hit: size * 0.56 };
}

/** Sizes follow the screen so a target is big on any phone. */
export function makeSprites(screenW: number, dpr: number): Record<Kind, Sprite> {
  const bat = Math.round(Math.max(64, Math.min(104, screenW * 0.2)));
  return {
    bat: batSprite(bat, dpr, false),
    gold: batSprite(Math.round(bat * 0.95), dpr, true),
    pumpkin: pumpkinSprite(Math.round(bat * 0.72), dpr),
  };
}

/** Body colour for the little burst when something is caught. */
export const BURST: Record<Kind, string> = {
  bat: "rgba(255,138,31,",
  gold: "rgba(255,215,0,",
  pumpkin: "rgba(255,90,90,",
};

