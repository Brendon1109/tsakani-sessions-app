/**
 * The glass crack at the end of a Bat Rush round, and on the story card.
 *
 * makeCrack() is pure geometry: rays out from the impact point, a few
 * branches, and rings joining neighbouring rays like a spider web. Every
 * segment remembers how far its start is from the impact, so drawCrack() can
 * grow the crack outwards by drawing only what is inside a radius.
 */
export interface Pt {
  x: number;
  y: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Distance of the start from the impact point. */
  d: number;
  /** Line width in CSS pixels before scaling. */
  w: number;
}

export interface Crack {
  origin: Pt;
  segments: Segment[];
  /** The furthest any segment starts. Grow to this and it is all drawn. */
  reach: number;
  scale: number;
}

const TAU = Math.PI * 2;

export function makeCrack(
  origin: Pt,
  width: number,
  height: number,
  rand: () => number = Math.random,
): Crack {
  const scale = Math.max(0.6, Math.min(width, height) / 400);
  const reach =
    Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y)) * 1.04;
  const segments: Segment[] = [];
  const rays: { pts: Pt[]; ds: number[] }[] = [];

  const walk = (from: Pt, angle: number, length: number, w0: number, keep: boolean) => {
    const pts: Pt[] = [from];
    const ds: number[] = [Math.hypot(from.x - origin.x, from.y - origin.y)];
    let a = angle;
    let p = from;
    let travelled = 0;
    while (travelled < length) {
      const step = (14 + rand() * 22) * scale;
      a += (rand() - 0.5) * 0.36;
      const next = { x: p.x + Math.cos(a) * step, y: p.y + Math.sin(a) * step };
      const d = Math.hypot(p.x - origin.x, p.y - origin.y);
      // Thick at the impact, hairline at the edges.
      const w = Math.max(0.7, w0 * (1 - Math.min(1, d / (reach * 0.8))));
      segments.push({ x1: p.x, y1: p.y, x2: next.x, y2: next.y, d, w });
      travelled += step;
      p = next;
      pts.push(p);
      ds.push(Math.hypot(p.x - origin.x, p.y - origin.y));
    }
    if (keep) rays.push({ pts, ds });
    return { pts, ds };
  };

  const count = 10 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU + (rand() - 0.5) * (TAU / count) * 0.6;
    const ray = walk(origin, angle, reach, 2.8, true);
    if (rand() < 0.55 && ray.pts.length > 6) {
      const at = Math.floor(ray.pts.length * (0.25 + rand() * 0.45));
      const side = rand() < 0.5 ? -1 : 1;
      walk(ray.pts[at], angle + side * (0.35 + rand() * 0.35), reach * (0.2 + rand() * 0.25), 1.6, false);
    }
  }

  // Rings: join neighbouring rays at a few distances, with a kink in the
  // middle so they read as glass rather than a drawn circle.
  const radii = [0.07, 0.15, 0.27, 0.42].map((f) => f * reach * (0.85 + rand() * 0.3));
  const pointAt = (ray: { pts: Pt[]; ds: number[] }, r: number) => {
    const i = ray.ds.findIndex((d) => d >= r);
    return i === -1 ? null : ray.pts[i];
  };
  for (const r of radii) {
    for (let i = 0; i < rays.length; i++) {
      if (rand() < 0.22) continue;
      const a = pointAt(rays[i], r);
      const b = pointAt(rays[(i + 1) % rays.length], r);
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2 + (rand() - 0.5) * 10 * scale;
      const my = (a.y + b.y) / 2 + (rand() - 0.5) * 10 * scale;
      const w = Math.max(0.6, 1.5 * (1 - r / reach));
      segments.push({ x1: a.x, y1: a.y, x2: mx, y2: my, d: r, w });
      segments.push({ x1: mx, y1: my, x2: b.x, y2: b.y, d: r, w });
    }
  }

  // Splinters right at the impact.
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU;
    const r1 = rand() * 6 * scale;
    const r2 = r1 + (5 + rand() * 9) * scale;
    segments.push({
      x1: origin.x + Math.cos(a) * r1,
      y1: origin.y + Math.sin(a) * r1,
      x2: origin.x + Math.cos(a + 0.3) * r2,
      y2: origin.y + Math.sin(a + 0.3) * r2,
      d: 0,
      w: 1.4,
    });
  }

  return { origin, segments, reach, scale };
}

/**
 * Draws every segment that starts inside `radius`. Two passes, a dark one a
 * pixel down and right for depth and a bright one on top, batched by width so
 * a full crack is a handful of strokes.
 */
export function drawCrack(
  ctx: CanvasRenderingContext2D,
  crack: Crack,
  radius: number,
  opts: { lineScale?: number; alpha?: number } = {},
) {
  const k = opts.lineScale ?? 1;
  const alpha = opts.alpha ?? 1;
  const buckets = new Map<number, Segment[]>();
  for (const s of crack.segments) {
    if (s.d > radius) continue;
    const key = Math.round(s.w * 2) / 2;
    const list = buckets.get(key);
    if (list) list.push(s);
    else buckets.set(key, [s]);
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // The glare at the impact.
  const glare = ctx.createRadialGradient(
    crack.origin.x, crack.origin.y, 0,
    crack.origin.x, crack.origin.y, 70 * crack.scale,
  );
  glare.addColorStop(0, `rgba(255,255,255,${0.28 * alpha})`);
  glare.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.beginPath();
  ctx.arc(crack.origin.x, crack.origin.y, 70 * crack.scale, 0, Math.PI * 2);
  ctx.fill();

  for (const [pass, colour, offset, extra] of [
    ["shadow", `rgba(0,0,0,${0.55 * alpha})`, 1 * k, 1.2],
    ["light", `rgba(255,255,255,${0.88 * alpha})`, 0, 0],
  ] as const) {
    void pass;
    ctx.strokeStyle = colour;
    for (const [w, list] of buckets) {
      ctx.lineWidth = (w + extra) * k;
      ctx.beginPath();
      for (const s of list) {
        ctx.moveTo(s.x1 + offset, s.y1 + offset);
        ctx.lineTo(s.x2 + offset, s.y2 + offset);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
