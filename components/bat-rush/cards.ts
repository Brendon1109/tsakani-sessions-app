/**
 * 1080 by 1920 images for Instagram stories: a player's aura card, and the
 * admin's Top 3 card when a round closes. Drawn on a canvas in the browser,
 * so they cost the Worker nothing and need no image files.
 *
 * Everything that matters sits between 250 and 1650 pixels down, clear of the
 * story bar at the top and the reply box at the bottom.
 */
import { BAT_PATH, GOLD, NIGHT, PUMPKIN } from "@/lib/bat-rush/shapes";
import { makeCrack, drawCrack } from "@/lib/bat-rush/crack";

const W = 1080;
const H = 1920;

function canvas() {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  return { cv, ctx: cv.getContext("2d")! };
}

function backdrop(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0d0618");
  sky.addColorStop(0.55, "#07040c");
  sky.addColorStop(1, "#050308");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const haze = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 1100);
  haze.addColorStop(0, "rgba(124,58,237,0.32)");
  haze.addColorStop(1, "rgba(124,58,237,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 900);
  glow.addColorStop(0, "rgba(255,138,31,0.22)");
  glow.addColorStop(1, "rgba(255,138,31,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // The harvest moon from the home page hero.
  const mx = 900;
  const my = 200;
  const moon = ctx.createRadialGradient(mx - 25, my - 25, 10, mx, my, 100);
  moon.addColorStop(0, "#fff1dc");
  moon.addColorStop(0.55, "#ffc98a");
  moon.addColorStop(1, "#f59e4a");
  ctx.save();
  ctx.shadowColor = "rgba(255,138,31,0.5)";
  ctx.shadowBlur = 90;
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(mx, my, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const path = new Path2D(BAT_PATH);
  for (const [x, y, w, gold] of [
    [80, 150, 210, false],
    [520, 110, 140, false],
    [260, 1720, 150, true],
    [740, 1690, 190, false],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(w / 100, w / 100);
    ctx.shadowColor = gold ? "rgba(255,215,0,0.9)" : "rgba(255,138,31,0.8)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = gold ? GOLD : NIGHT;
    ctx.fill(path);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = gold ? "#fffbe6" : PUMPKIN;
    ctx.stroke(path);
    ctx.restore();
  }
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  y: number,
  size: number,
  font: string,
  colour: string,
  opts: { weight?: number; maxWidth?: number; glow?: string; spacing?: number } = {},
) {
  const weight = opts.weight ?? 800;
  const maxWidth = opts.maxWidth ?? 940;
  let px = size;
  ctx.font = `${weight} ${px}px ${font}`;
  while (ctx.measureText(value).width > maxWidth && px > 24) {
    px -= 4;
    ctx.font = `${weight} ${px}px ${font}`;
  }
  ctx.save();
  if ("letterSpacing" in ctx && opts.spacing) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${opts.spacing}px`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = 40;
  }
  ctx.fillStyle = colour;
  ctx.fillText(value, W / 2, y);
  ctx.restore();
}

function footer(ctx: CanvasRenderingContext2D, font: string) {
  text(ctx, "Tsakani Halloween · The Barn UWC", 1520, 46, font, "rgba(255,255,255,0.82)", { weight: 600 });
  text(ctx, "@tsakani_sessions", 1610, 70, font, PUMPKIN, { weight: 800 });
}

/**
 * The story card is a JPEG: the glows and gradients make a 1080 by 1920 PNG
 * about 2 MB, a lot to upload to Instagram on prepaid data, and the JPEG is a
 * tenth of that with no visible difference. The admin Top 3 card stays PNG.
 */
function toBlob(cv: HTMLCanvasElement, type: "image/png" | "image/jpeg" = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) =>
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), type, 0.9),
  );
}

export async function storyCard(opts: { aura: number; rank: string; font: string }): Promise<Blob> {
  await document.fonts?.ready;
  const { cv, ctx } = canvas();
  backdrop(ctx);
  drawCrack(ctx, makeCrack({ x: 540, y: 980 }, W, H), Infinity, { lineScale: 2.2, alpha: 0.5 });

  text(ctx, "TSAKANI HALLOWEEN", 640, 40, opts.font, PUMPKIN, { weight: 700, spacing: 10 });
  text(ctx, "BAT RUSH", 760, 120, opts.font, "#ffffff", { weight: 900 });
  text(ctx, "AURA", 900, 52, opts.font, "rgba(255,255,255,0.7)", { weight: 700, spacing: 14 });
  text(ctx, String(opts.aura), 1170, 300, opts.font, "#ffffff", {
    weight: 900,
    glow: "rgba(255,138,31,0.85)",
  });
  text(ctx, opts.rank, 1310, 100, opts.font, PUMPKIN, { weight: 900, glow: "rgba(255,138,31,0.5)" });
  footer(ctx, opts.font);
  return toBlob(cv, "image/jpeg");
}

export interface Top3Row {
  name: string;
  aura: number;
  winner?: boolean;
}

export async function top3Card(opts: {
  round: string;
  rows: Top3Row[];
  prize: string | null;
  font: string;
}): Promise<Blob> {
  await document.fonts?.ready;
  const { cv, ctx } = canvas();
  backdrop(ctx);

  text(ctx, "TSAKANI HALLOWEEN · BAT RUSH", 330, 40, opts.font, PUMPKIN, { weight: 700, spacing: 8 });
  text(ctx, opts.round.toUpperCase(), 470, 110, opts.font, "#ffffff", { weight: 900 });
  text(ctx, "TOP 3", 590, 90, opts.font, GOLD, { weight: 900, glow: "rgba(255,215,0,0.5)", spacing: 12 });

  const medals = ["#ffd700", "#d9dde3", "#d08a4a"];
  opts.rows.slice(0, 3).forEach((row, i) => {
    const y = 760 + i * 230;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.strokeStyle = i === 0 ? "rgba(255,215,0,0.6)" : "rgba(255,255,255,0.14)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(90, y - 95, 900, 190);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = medals[i];
    ctx.beginPath();
    ctx.arc(190, y, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NIGHT;
    ctx.font = `900 64px ${opts.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), 190, y + 4);

    let px = 62;
    ctx.font = `800 ${px}px ${opts.font}`;
    while (ctx.measureText(row.name).width > 470 && px > 30) {
      px -= 4;
      ctx.font = `800 ${px}px ${opts.font}`;
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(row.name, 280, y + (row.winner ? -18 : 2));
    if (row.winner) {
      ctx.font = `800 34px ${opts.font}`;
      ctx.fillStyle = GOLD;
      ctx.fillText("WINNER", 280, y + 40);
    }

    ctx.font = `900 76px ${opts.font}`;
    ctx.textAlign = "right";
    ctx.fillStyle = PUMPKIN;
    ctx.fillText(String(row.aura), 950, y + 4);
    ctx.restore();
  });

  if (opts.prize) {
    text(ctx, opts.prize, 1440, 50, opts.font, "#ffffff", { weight: 700 });
  }
  footer(ctx, opts.font);
  return toBlob(cv);
}

/**
 * Hands an image to the phone's share sheet where the browser can share
 * files, else downloads it. Returns how it went, for analytics.
 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<"share" | "download" | "cancel"> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "share";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancel";
      // NotAllowedError and friends: fall through to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "download";
}
