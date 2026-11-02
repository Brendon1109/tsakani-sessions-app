import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The analytics collector decides which edge headers to trust from
 * BZ_PLATFORM. This site has only run on Cloudflare since 24 September 2026,
 * and the shared upstream copy of app/api/e/route.ts defaults to vercel, so a
 * re-copy must not quietly bring that default back.
 */
describe("analytics platform", () => {
  it("is cloudflare, set on the Worker and as the fallback", () => {
    expect(readFileSync("wrangler.jsonc", "utf8")).toMatch(/"BZ_PLATFORM":\s*"cloudflare"/);
    expect(readFileSync("app/api/e/route.ts", "utf8")).toMatch(/process\.env\.BZ_PLATFORM[^\n]*\|\| "cloudflare"/);
  });
});
