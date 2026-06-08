import { describe, it, expect } from "vitest";
import {
  linearRegression,
  movingAverage,
  forecastSeries,
  weekdayAverages,
  busiestWeekday,
  busiestMonth,
  trend,
  topEntries,
  type SeriesPoint,
} from "@/lib/forecast";

function series(values: number[], start = "2025-01-01"): SeriesPoint[] {
  return values.map((value, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), value };
  });
}

describe("linearRegression", () => {
  it("fits a perfect upward line", () => {
    const { slope, intercept } = linearRegression([0, 2, 4, 6, 8]);
    expect(slope).toBeCloseTo(2);
    expect(intercept).toBeCloseTo(0);
  });

  it("handles empty and single-element inputs", () => {
    expect(linearRegression([])).toEqual({ slope: 0, intercept: 0 });
    expect(linearRegression([5])).toEqual({ slope: 0, intercept: 5 });
  });
});

describe("movingAverage", () => {
  it("smooths with a trailing window", () => {
    expect(movingAverage([2, 4, 6], 2)).toEqual([2, 3, 5]);
  });
});

describe("forecastSeries", () => {
  it("projects an upward trend forward and stays non-negative", () => {
    const fc = forecastSeries(series([1, 2, 3, 4, 5]), 3);
    expect(fc).toHaveLength(3);
    expect(fc.every((p) => p.value >= 0)).toBe(true);
    expect(fc.every((p) => p.predicted === true)).toBe(true);
    // continues rising
    expect(fc[2].value).toBeGreaterThanOrEqual(fc[0].value);
  });

  it("clamps a steep decline at zero rather than going negative", () => {
    const fc = forecastSeries(series([10, 7, 4, 1]), 5);
    expect(fc.every((p) => p.value >= 0)).toBe(true);
  });

  it("returns empty for empty input or non-positive horizon", () => {
    expect(forecastSeries([], 5)).toEqual([]);
    expect(forecastSeries(series([1, 2, 3]), 0)).toEqual([]);
  });

  it("generates correctly sequenced future dates", () => {
    const fc = forecastSeries(series([1, 1, 1], "2025-03-30"), 2);
    // last input date is 2025-04-01 → next are 04-02, 04-03
    expect(fc[0].date).toBe("2025-04-02");
    expect(fc[1].date).toBe("2025-04-03");
  });
});

describe("seasonality helpers", () => {
  it("identifies the busiest weekday", () => {
    // 2025-01-01 is a Wednesday; make Saturdays large.
    const points = series(new Array(21).fill(0)).map((p) => {
      const dow = new Date(`${p.date}T00:00:00Z`).getUTCDay();
      return { ...p, value: dow === 6 ? 100 : 5 };
    });
    const busiest = busiestWeekday(points);
    expect(busiest?.label).toBe("Saturday");
  });

  it("ranks weekdays by average and returns 7 entries", () => {
    expect(weekdayAverages(series([1, 2, 3, 4, 5, 6, 7]))).toHaveLength(7);
  });

  it("identifies the busiest month", () => {
    const jan = series(new Array(10).fill(1), "2025-01-01");
    const feb = series(new Array(10).fill(9), "2025-02-01");
    expect(busiestMonth([...jan, ...feb])?.label).toBe("February");
  });

  it("returns null busiest weekday when all zero", () => {
    expect(busiestWeekday(series([0, 0, 0]))).toBeNull();
  });
});

describe("trend", () => {
  it("reports up / down / flat", () => {
    expect(trend([1, 2, 3, 4, 5]).direction).toBe("up");
    expect(trend([5, 4, 3, 2, 1]).direction).toBe("down");
    expect(trend([3, 3, 3, 3]).direction).toBe("flat");
  });
});

describe("topEntries", () => {
  it("sorts by count desc and limits", () => {
    const result = topEntries({ a: 1, b: 9, c: 5 }, 2);
    expect(result).toEqual([
      { key: "b", count: 9 },
      { key: "c", count: 5 },
    ]);
  });
});
