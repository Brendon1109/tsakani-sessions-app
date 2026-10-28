import { describe, it, expect, afterEach } from "vitest";
import { isHalloween, halloweenScript } from "@/lib/seasonal-theme";

const at = (iso: string) => Date.parse(iso);

describe("Halloween window", () => {
  it("is off before 28 October in Cape Town", () => {
    expect(isHalloween(at("2026-10-27T23:59:59+02:00"))).toBe(false);
  });

  it("is on from 28 October through Halloween night", () => {
    expect(isHalloween(at("2026-10-28T00:00:00+02:00"))).toBe(true);
    expect(isHalloween(at("2026-10-31T23:59:59+02:00"))).toBe(true);
  });

  it("goes back to gold at 00:00 on 1 November", () => {
    expect(isHalloween(at("2026-11-01T00:00:00+02:00"))).toBe(false);
  });

  it("does not come back next year", () => {
    expect(isHalloween(at("2027-10-31T20:00:00+02:00"))).toBe(false);
  });
});

describe("the inline head script", () => {
  const realNow = Date.now;
  afterEach(() => {
    Date.now = realNow;
  });

  // The script runs in the browser before React, so it is checked by running
  // the exact string against a stand in for document.documentElement.
  function run(nowIso: string): string | undefined {
    const attrs: Record<string, string> = {};
    const document = {
      documentElement: {
        setAttribute: (k: string, v: string) => {
          attrs[k] = v;
        },
      },
    };
    Date.now = () => at(nowIso);
    new Function("document", halloweenScript)(document);
    return attrs["data-theme"];
  }

  it("sets the theme inside the window and leaves it alone outside", () => {
    expect(run("2026-10-31T21:00:00+02:00")).toBe("halloween");
    expect(run("2026-11-01T00:00:01+02:00")).toBeUndefined();
    expect(run("2026-10-20T12:00:00+02:00")).toBeUndefined();
  });
});
