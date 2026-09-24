import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// .env.production is committed so Workers Builds can bake the public values
// in. A value copied from a `vercel env pull` once kept its "\n" escape
// without the quotes that give it meaning, so the Worker's Supabase URL ended
// in a literal backslash n, every request went to /n/rest/v1 and got 401, and
// the shop and gallery rendered their empty states (24 September 2026).
function values() {
  const text = readFileSync(path.resolve(__dirname, "../.env.production"), "utf8");
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return { key: l.slice(0, i), value: l.slice(i + 1) };
    });
}

describe(".env.production", () => {
  it("holds plain values, with no quotes, escapes or whitespace", () => {
    for (const { key, value } of values()) {
      expect(value, key).toMatch(/^[^\s"'\\]+$/);
    }
  });

  it("holds only public values", () => {
    for (const { key } of values()) expect(key).toMatch(/^NEXT_PUBLIC_/);
  });

  it("gives Supabase a bare origin", () => {
    const url = values().find((v) => v.key === "NEXT_PUBLIC_SUPABASE_URL")!.value;
    expect(new URL(url).pathname).toBe("/");
    expect(url).toBe(new URL(url).origin);
  });
});
