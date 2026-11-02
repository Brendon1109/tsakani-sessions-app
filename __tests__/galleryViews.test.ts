import { describe, it, expect } from "vitest";
import { nextView } from "@/app/gallery/[slug]/PhotoGrid";

describe("pinch between gallery views", () => {
  it("fingers together shows more, smaller photos", () => {
    expect(nextView("large", 0.5)).toBe("rows");
    expect(nextView("rows", 0.5)).toBe("compact");
    expect(nextView("compact", 0.5)).toBe("compact");
  });

  it("fingers apart shows bigger photos", () => {
    expect(nextView("compact", 2)).toBe("rows");
    expect(nextView("rows", 2)).toBe("large");
    expect(nextView("large", 2)).toBe("large");
  });

  it("a small wobble changes nothing", () => {
    expect(nextView("rows", 1.1)).toBe("rows");
    expect(nextView("rows", 0.9)).toBe("rows");
  });
});
