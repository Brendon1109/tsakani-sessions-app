import { describe, it, expect } from "vitest";
import { logoBox } from "@/lib/image-optimize";

describe("logoBox", () => {
  it("puts the logo bottom centre, a fifth of the shorter side wide", () => {
    const b = logoBox(1152, 2048, 364, 268);
    expect(b.w).toBe(230);
    expect(b.h).toBe(169);
    expect(b.x).toBe(461);
    expect(b.y + b.h).toBeLessThan(2048);
    expect(2048 - (b.y + b.h)).toBeCloseTo(2048 * 0.03, 0);
  });

  it("sizes by the shorter side on a landscape photo", () => {
    const b = logoBox(2048, 1365, 364, 268);
    expect(b.w).toBe(273);
    expect(Math.abs(b.x + b.w / 2 - 1024)).toBeLessThanOrEqual(1);
  });
});
