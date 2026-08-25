import { describe, it, expect } from "vitest";
import { randToCents, centsToRand, formatCents } from "@/lib/money";

/**
 * The merch price path is the one place in this app where being wrong by a
 * factor of a hundred is silent and expensive, so the conversion is pinned
 * here rather than trusted to a /100 in a component.
 */

describe("randToCents", () => {
  it("turns a plain Rand amount into cents", () => {
    expect(randToCents("450")).toBe(45000);
    expect(randToCents("0")).toBe(0);
  });

  it("keeps the cents when they are typed", () => {
    expect(randToCents("450.50")).toBe(45050);
    expect(randToCents("9.99")).toBe(999);
  });

  it("ignores anything that is not part of the number", () => {
    expect(randToCents("R450")).toBe(45000);
    expect(randToCents(" 450 ")).toBe(45000);
    expect(randToCents("R1 200")).toBe(120000);
  });

  it("rounds rather than truncating a third decimal", () => {
    expect(randToCents("10.005")).toBe(1001);
    expect(randToCents("10.004")).toBe(1000);
  });

  it("returns null for anything that is not a price", () => {
    expect(randToCents("")).toBeNull();
    expect(randToCents("abc")).toBeNull();
    expect(randToCents("12.3.4")).toBeNull();
  });
});

describe("centsToRand", () => {
  it("drops the decimals on a whole Rand amount", () => {
    expect(centsToRand(45000)).toBe("450");
    expect(centsToRand(0)).toBe("0");
  });

  it("keeps two decimals when there are cents", () => {
    expect(centsToRand(45050)).toBe("450.50");
    expect(centsToRand(999)).toBe("9.99");
  });

  it("round trips through randToCents unchanged", () => {
    for (const cents of [0, 999, 45000, 45050, 120000]) {
      expect(randToCents(centsToRand(cents))).toBe(cents);
    }
  });
});

describe("formatCents", () => {
  it("renders a display price", () => {
    expect(formatCents(45000)).toBe("R450");
    expect(formatCents(45050)).toContain("450");
  });
});
