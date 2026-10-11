import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

/**
 * The rate limiter. Its key must never hold an IP address: it is an HMAC of
 * the IP under the server only BZ_SALT, the same for the same visitor so the
 * limit still counts, different for a different visitor or another salt. It
 * counts through rate_limit_hit on the service role key, answers 429 with
 * Retry-After when the function says no, and fails open on anything else.
 */

type RpcResult = { data: unknown; error: { message: string } | null };

const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
let rpcResult: RpcResult | (() => never);
let serviceAvailable = true;

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () =>
    serviceAvailable
      ? {
          rpc: async (fn: string, args: Record<string, unknown>) => {
            rpcCalls.push({ fn, args });
            if (typeof rpcResult === "function") return rpcResult();
            return rpcResult;
          },
        }
      : null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    throw new Error("the rate limiter must not use the anon client");
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
  rpcCalls.length = 0;
  serviceAvailable = true;
  rpcResult = { data: [{ allowed: true, retry_after: 60 }], error: null };
  vi.stubEnv("HOST_PLATFORM", "cloudflare");
  vi.stubEnv("BZ_SALT", "salt-a");
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

  it("is the HMAC of the IP under its own rate-limit prefix, so it shares nothing with the daily counting value", async () => {
    const expected = createHmac("sha256", "salt-a").update(`rate-limit:${IP}`).digest("hex").slice(0, 32);
    expect(await rateLimitKey("orders", IP, "salt-a")).toBe(`orders:${expected}`);
  });

  it("falls back to one shared key when there is no IP", async () => {
    expect(await rateLimitKey("orders", null, "salt-a")).toBe("orders:anonymous");
  });
});

describe("rateLimit", () => {
  it("lets an allowed request through, counted under the hashed key", async () => {
    expect(await rateLimit(request(IP), "orders", 5, 60)).toBeNull();
    expect(rpcCalls).toEqual([
      {
        fn: "rate_limit_hit",
        args: { p_key: await rateLimitKey("orders", IP, "salt-a"), p_limit: 5, p_window_seconds: 60 },
      },
    ]);
    expect(JSON.stringify(rpcCalls)).not.toContain(IP);
  });

  it("answers 429 with Retry-After once the function says the limit is reached", async () => {
    rpcResult = { data: [{ allowed: false, retry_after: 42 }], error: null };
    const res = await rateLimit(request(IP), "orders", 5, 60);
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("42");
    expect(await res?.json()).toEqual({ error: "Too many requests. Please slow down." });
  });

  it("fails open when the database answers with an error", async () => {
    rpcResult = { data: null, error: { message: "permission denied" } };
    expect(await rateLimit(request(IP), "orders", 5, 60)).toBeNull();
  });

  it("fails open when the call throws", async () => {
    rpcResult = () => {
      throw new Error("network down");
    };
    expect(await rateLimit(request(IP), "orders", 5, 60)).toBeNull();
  });

  it("fails open on an answer it does not understand", async () => {
    rpcResult = { data: [], error: null };
    expect(await rateLimit(request(IP), "orders", 5, 60)).toBeNull();
  });

  it("stands aside without the service role key", async () => {
    serviceAvailable = false;
    expect(await rateLimit(request(IP), "orders", 5, 60)).toBeNull();
    expect(rpcCalls).toHaveLength(0);
  });

  it("says once, not on every request, that it is standing aside", async () => {
    vi.resetModules();
    const fresh = await import("@/lib/rate-limit");
    serviceAvailable = false;
    const spy = vi.mocked(console.error);
    spy.mockClear();
    await fresh.rateLimit(request(IP), "orders", 5, 60);
    await fresh.rateLimit(request(IP), "orders", 5, 60);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("stands aside without the salt rather than store the IP", async () => {
    vi.stubEnv("BZ_SALT", "");
    expect(await rateLimit(request(IP), "orders", 5, 60)).toBeNull();
    expect(rpcCalls).toHaveLength(0);
  });
});
