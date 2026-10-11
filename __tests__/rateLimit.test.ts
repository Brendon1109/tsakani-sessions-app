import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The rate limiter's key must never hold an IP address. It is an HMAC of the
 * IP under the server only BZ_SALT, the same for the same visitor so the
 * limit still counts, different for a different visitor or another salt.
 * Without the salt the limiter stands aside rather than store the IP.
 */

const keysSeen: string[] = [];
let clientCreated = 0;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    clientCreated++;
    const query = {
      delete: () => query,
      lt: async () => ({ error: null }),
      select: () => query,
      eq: (_col: string, value: string) => {
        keysSeen.push(value);
        return query;
      },
      single: async () => ({ data: null, error: null }),
      insert: async (row: { key: string }) => {
        keysSeen.push(row.key);
        return { error: null };
      },
    };
    return { from: () => query };
  },
}));

import { rateLimit, rateLimitKey } from "@/lib/rate-limit";

const IP = "196.25.1.200";

function request(ip?: string) {
  return new NextRequest("http://localhost/api/orders", {
    method: "POST",
    headers: ip ? { "cf-connecting-ip": ip } : {},
  });
}

beforeEach(() => {
  keysSeen.length = 0;
  clientCreated = 0;
  vi.stubEnv("HOST_PLATFORM", "cloudflare");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("rateLimitKey", () => {
  it("holds no trace of the IP address", async () => {
    const key = await rateLimitKey("orders", IP, "salt-a");
    expect(key).toMatch(/^orders:[0-9a-f]{32}$/);
    expect(key).not.toContain(IP);
  });

  it("is the same for the same visitor, so the limit still counts", async () => {
    expect(await rateLimitKey("orders", IP, "salt-a")).toBe(await rateLimitKey("orders", IP, "salt-a"));
  });

  it("differs by visitor and by salt, and carries its bucket", async () => {
    const base = await rateLimitKey("orders", IP, "salt-a");
    expect(await rateLimitKey("orders", "196.25.1.201", "salt-a")).not.toBe(base);
    expect(await rateLimitKey("tickets", IP, "salt-a")).toBe(`tickets:${base.split(":")[1]}`);
    expect((await rateLimitKey("orders", IP, "salt-b")).split(":")[1]).not.toBe(base.split(":")[1]);
  });

  it("falls back to one shared key when there is no IP", async () => {
    expect(await rateLimitKey("orders", null, "salt-a")).toBe("orders:anonymous");
  });
});

describe("rateLimit", () => {
  it("never sends the IP to the database", async () => {
    vi.stubEnv("BZ_SALT", "salt-a");
    expect(await rateLimit(request(IP), "orders", 5, 60)).toBeNull();
    expect(keysSeen.length).toBeGreaterThan(0);
    for (const key of keysSeen) expect(key).not.toContain(IP);
    expect(keysSeen[0]).toBe(await rateLimitKey("orders", IP, "salt-a"));
  });

  it("stands aside without the salt rather than store the IP", async () => {
    vi.stubEnv("BZ_SALT", "");
    expect(await rateLimit(request(IP), "orders", 5, 60)).toBeNull();
    expect(clientCreated).toBe(0);
    expect(keysSeen).toHaveLength(0);
  });
});
