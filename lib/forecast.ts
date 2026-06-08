/**
 * Lightweight, dependency-free forecasting helpers for the predictive local
 * analytics dashboard. Pure functions only (no Date.now / no side effects) so
 * they are deterministic and unit-testable. Callers pass in dated series.
 *
 * The models are intentionally simple and robust for small-business data
 * volumes: least-squares linear trend + day-of-week / monthly seasonality.
 */

export interface SeriesPoint {
  /** ISO date, YYYY-MM-DD */
  date: string;
  value: number;
}

export interface ForecastPoint extends SeriesPoint {
  predicted: true;
}

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

export function mean(xs: number[]): number {
  return xs.length ? sum(xs) / xs.length : 0;
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Least-squares fit of values against their index (x = 0..n-1). */
export function linearRegression(values: number[]): {
  slope: number;
  intercept: number;
} {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: values[0] };
  const xs = values.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (values[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

/** Simple trailing moving average; output aligned to input length. */
export function movingAverage(values: number[], window: number): number[] {
  if (window <= 1) return [...values];
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    return mean(values.slice(start, i + 1));
  });
}

/**
 * Trend direction and percentage change implied by the linear fit across the
 * series (from fitted start to fitted end).
 */
export function trend(values: number[]): {
  slope: number;
  direction: "up" | "down" | "flat";
  pctChange: number;
} {
  const { slope, intercept } = linearRegression(values);
  const n = values.length;
  const start = intercept;
  const end = intercept + slope * (n - 1);
  const m = mean(values);
  // Percentage growth needs a positive reference. The fitted intercept is <= 0
  // for a series rising from a near-zero base (common early on), which would
  // otherwise force a misleading 0% next to an "up" arrow — fall back to the
  // series mean in that case.
  const ref = start > 1e-9 ? start : m > 1e-9 ? m : 1;
  const pctChange = ((end - start) / ref) * 100;
  // "flat" when the slope is negligible relative to the average level.
  const direction =
    Math.abs(slope) < (m === 0 ? 0.001 : m * 0.01)
      ? "flat"
      : slope > 0
        ? "up"
        : "down";
  return { slope, direction, pctChange };
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Forecast the next `horizon` values using a linear trend fitted to the most
 * recent `lookback` points, nudged by day-of-week seasonality when enough
 * history exists. Values are clamped to >= 0 and rounded.
 */
export function forecastSeries(
  points: SeriesPoint[],
  horizon: number,
  lookback = 28,
): ForecastPoint[] {
  if (points.length === 0 || horizon <= 0) return [];

  const recent = points.slice(-lookback);
  const values = recent.map((p) => p.value);
  const { slope, intercept } = linearRegression(values);
  const n = values.length;

  // Additive day-of-week seasonal offsets from the trend line.
  const dowOffset = new Array(7).fill(0);
  const dowCount = new Array(7).fill(0);
  if (n >= 14) {
    recent.forEach((p, i) => {
      const fitted = intercept + slope * i;
      const dow = new Date(`${p.date}T00:00:00Z`).getUTCDay();
      dowOffset[dow] += p.value - fitted;
      dowCount[dow] += 1;
    });
    for (let d = 0; d < 7; d++) {
      dowOffset[d] = dowCount[d] ? dowOffset[d] / dowCount[d] : 0;
    }
  }

  const lastDate = recent[recent.length - 1].date;
  const out: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const date = addDays(lastDate, h);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const base = intercept + slope * (n - 1 + h) + dowOffset[dow];
    out.push({ date, value: Math.max(0, Math.round(base)), predicted: true });
  }
  return out;
}

/** Average value per weekday (0=Sunday .. 6=Saturday), sorted busiest first. */
export function weekdayAverages(points: SeriesPoint[]): {
  weekday: number;
  label: string;
  average: number;
}[] {
  const totals = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const p of points) {
    const dow = new Date(`${p.date}T00:00:00Z`).getUTCDay();
    totals[dow] += p.value;
    counts[dow] += 1;
  }
  return totals
    .map((t, d) => ({
      weekday: d,
      label: WEEKDAY_LABELS[d],
      average: counts[d] ? t / counts[d] : 0,
    }))
    .sort((a, b) => b.average - a.average);
}

export function busiestWeekday(points: SeriesPoint[]): {
  weekday: number;
  label: string;
  average: number;
} | null {
  const ranked = weekdayAverages(points);
  return ranked.length && ranked[0].average > 0 ? ranked[0] : null;
}

/** Total value per calendar month across the series, sorted busiest first. */
export function monthlyTotals(points: SeriesPoint[]): {
  month: number;
  label: string;
  total: number;
}[] {
  const totals = new Array(12).fill(0);
  for (const p of points) {
    const m = new Date(`${p.date}T00:00:00Z`).getUTCMonth();
    totals[m] += p.value;
  }
  return totals
    .map((t, m) => ({ month: m, label: MONTH_LABELS[m], total: t }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function busiestMonth(points: SeriesPoint[]): {
  month: number;
  label: string;
  total: number;
} | null {
  const ranked = monthlyTotals(points);
  return ranked.length ? ranked[0] : null;
}

/** Top-N entries of a {key: count} map, sorted descending by count. */
export function topEntries(
  counts: Record<string, number>,
  n = 10,
): { key: string; count: number }[] {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
