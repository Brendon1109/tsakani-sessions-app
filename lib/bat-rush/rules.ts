/**
 * Bat Rush, the Halloween 2026 phone game at /halloween. The rules every
 * other file reads: the round length, the spawn schedule, the points, the
 * score cap and the rank names.
 *
 * The score cap is the one number the database also knows. It is not a guess,
 * it falls out of the spawn schedule:
 *
 *   1. spawnTimes() is deterministic. The gap between two spawns shrinks in a
 *      straight line from SPAWN_START_MS to SPAWN_END_MS over the round, so
 *      every round has exactly MAX_SPAWNS things on screen, one per spawn.
 *   2. Each thing can be caught once. A bat is +1, a gold bat +67 and a
 *      pumpkin only ever takes aura away.
 *   3. planRound() never makes more than GOLD_MAX gold bats.
 *
 * So the best possible round is every spawn caught, GOLD_MAX of them gold and
 * the rest plain bats, with no pumpkin touched:
 *
 *   SCORE_CAP = (MAX_SPAWNS - GOLD_MAX) * 1 + GOLD_MAX * 67
 *
 * supabase/bat_rush.sql refuses anything above it, and a test checks the SQL
 * carries the same number. Change the schedule or the points and the test
 * fails until the SQL is changed to match and re-run.
 */

export const ROUND_MS = 30_000;
export const COUNTDOWN_MS = 3_000;

/** The gap between spawns at the start and at the end of the round. */
export const SPAWN_START_MS = 620;
export const SPAWN_END_MS = 250;
/** The first spawn, and the quiet bit before the clock hits zero. */
export const FIRST_SPAWN_MS = 200;
export const LAST_SPAWN_BEFORE_END_MS = 300;

export const GOLD_MIN = 2;
export const GOLD_MAX = 3;

export type Kind = "bat" | "gold" | "pumpkin";

export const POINTS: Record<Kind, number> = {
  bat: 1,
  gold: 67,
  pumpkin: -10,
};

/** Share of the round that has passed, 0 to 1. */
export function progress(t: number): number {
  return Math.min(1, Math.max(0, t / ROUND_MS));
}

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

/** Milliseconds until the next spawn, at time t into the round. */
export function spawnGap(t: number): number {
  return lerp(SPAWN_START_MS, SPAWN_END_MS, progress(t));
}

/** Every spawn time in a round, in ms from the start. The same every round. */
export function spawnTimes(): number[] {
  const out: number[] = [];
  let t = FIRST_SPAWN_MS;
  while (t <= ROUND_MS - LAST_SPAWN_BEFORE_END_MS) {
    out.push(Math.round(t));
    t += spawnGap(t);
  }
  return out;
}

export const SPAWNS = spawnTimes();
export const MAX_SPAWNS = SPAWNS.length;

export const SCORE_CAP =
  (MAX_SPAWNS - GOLD_MAX) * POINTS.bat + GOLD_MAX * POINTS.gold;

/**
 * What each spawn is, for one round. Gold bats land one per equal slice of
 * the middle of the round, so they never bunch up, and pumpkins get more
 * common as the clock runs down.
 */
export function planRound(rand: () => number = Math.random): Kind[] {
  const n = MAX_SPAWNS;
  const kinds: Kind[] = [];
  const golds = GOLD_MIN + Math.floor(rand() * (GOLD_MAX - GOLD_MIN + 1));
  const goldCount = Math.min(GOLD_MAX, Math.max(GOLD_MIN, golds));

  const from = Math.floor(n * 0.15);
  const to = Math.floor(n * 0.95);
  const slice = (to - from) / goldCount;
  const goldAt = new Set<number>();
  for (let g = 0; g < goldCount; g++) {
    const start = Math.floor(from + slice * g);
    const end = Math.max(start + 1, Math.floor(from + slice * (g + 1)));
    goldAt.add(Math.min(n - 1, start + Math.floor(rand() * (end - start))));
  }

  for (let i = 0; i < n; i++) {
    if (goldAt.has(i)) {
      kinds.push("gold");
      continue;
    }
    const pumpkinChance = lerp(0.12, 0.24, i / n);
    kinds.push(rand() < pumpkinChance ? "pumpkin" : "bat");
  }
  return kinds;
}

/** Aura after one tap. Never below zero. */
export function applyTap(aura: number, kind: Kind): number {
  return Math.max(0, aura + POINTS[kind]);
}

/** How long a spawn takes to cross the screen. Faster as the round goes on. */
export function crossingMs(kind: Kind, spawnT: number): number {
  const p = progress(spawnT);
  if (kind === "gold") return lerp(1500, 1050, p);
  if (kind === "pumpkin") return lerp(3500, 2200, p);
  return lerp(3300, 1800, p);
}

/**
 * Rank names, low to high. A gold bat is worth 67 plain ones, so the tiers
 * mostly read as how many golds you caught:
 *
 *   Cooked          under 30   no gold and a few bats, or a pumpkin habit
 *   It's giving     30 to 99   a gold, or 30 plus bats with none
 *   Aura farmer     100 to 169 a gold and a good run of bats, or two golds
 *   Main character  170 plus   two golds and a busy thumb, or all three
 *
 * Tuned on 20 000 simulated rounds by a bar crowd of mixed skill (median about
 * 60, top 10 percent about 160), which put roughly 40, 33, 18 and 7 percent in
 * the four tiers. bat_rush_end carries auraBucket() so the lines can be moved
 * once real rounds are in.
 */
export const RANKS = [
  { min: 0, name: "Cooked" },
  { min: 30, name: "It's giving" },
  { min: 100, name: "Aura farmer" },
  { min: 170, name: "Main character" },
] as const;

export function rankFor(aura: number): string {
  let name: string = RANKS[0].name;
  for (const r of RANKS) if (aura >= r.min) name = r.name;
  return name;
}

/** Score bucket for analytics, 20 aura wide, so the rank lines can be tuned on real rounds. */
export function auraBucket(aura: number): string {
  if (aura >= 200) return "200+";
  const lo = Math.floor(Math.max(0, aura) / 20) * 20;
  return `${lo}-${lo + 19}`;
}
