import { describe, it, expect, afterEach } from "vitest";
import { clientIp, clientGeo, hostPlatform } from "@/lib/request-meta";

/**
 * The IP feeds the rate limiter and Turnstile, and the geo feeds analytics.
 * Each host's edge writes its own headers and passes every other header
 * through from the client untouched, so trusting the wrong one lets a caller
 * pick their own IP. These pin which header counts on which host.
 */

function h(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("hostPlatform", () => {
  const original = process.env.HOST_PLATFORM;
  afterEach(() => {
    if (original === undefined) delete process.env.HOST_PLATFORM;
    else process.env.HOST_PLATFORM = original;
  });

  it("is vercel unless the Worker declares cloudflare", () => {
    delete process.env.HOST_PLATFORM;
    expect(hostPlatform()).toBe("vercel");
    process.env.HOST_PLATFORM = "something-else";
    expect(hostPlatform()).toBe("vercel");
    process.env.HOST_PLATFORM = "cloudflare";
    expect(hostPlatform()).toBe("cloudflare");
  });
});

describe("clientIp on Cloudflare", () => {
  it("trusts only cf-connecting-ip", () => {
    const headers = h({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "6.6.6.6, 203.0.113.7",
      "x-real-ip": "6.6.6.6",
    });
    expect(clientIp(headers, "cloudflare")).toBe("203.0.113.7");
  });

  it("ignores a forged x-forwarded-for when cf-connecting-ip is missing", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6" }), "cloudflare")).toBeNull();
    expect(clientIp(h({ "x-real-ip": "6.6.6.6" }), "cloudflare")).toBeNull();
  });
});

describe("clientIp on Vercel", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIp(h({ "x-real-ip": "198.51.100.4", "x-forwarded-for": "198.51.100.9" }), "vercel")).toBe(
      "198.51.100.4"
    );
    expect(clientIp(h({ "x-forwarded-for": " 198.51.100.9 , 10.0.0.1" }), "vercel")).toBe("198.51.100.9");
  });

  it("never reads cf-connecting-ip, which Vercel does not write", () => {
    expect(clientIp(h({ "cf-connecting-ip": "6.6.6.6" }), "vercel")).toBeNull();
  });
});

describe("clientGeo", () => {
  it("reads request.cf on Cloudflare and ignores Vercel headers there", () => {
    const headers = h({
      "x-vercel-ip-city": "Forged",
      "x-vercel-ip-country": "XX",
      "cf-ipcountry": "ZA",
    });
    expect(clientGeo(headers, "cloudflare", { city: "Cape Town", regionCode: "WC", country: "ZA" })).toEqual({
      city: "Cape Town",
      region: "WC",
      country: "ZA",
    });
  });

  it("falls back to cf-ipcountry when request.cf is missing", () => {
    expect(clientGeo(h({ "cf-ipcountry": "ZA" }), "cloudflare", undefined)).toEqual({
      city: null,
      region: null,
      country: "ZA",
    });
  });

  it("decodes Vercel's percent encoded city and ignores cf headers there", () => {
    const headers = h({
      "x-vercel-ip-city": "Cape%20Town",
      "x-vercel-ip-country-region": "WC",
      "x-vercel-ip-country": "ZA",
      "cf-ipcountry": "XX",
    });
    expect(clientGeo(headers, "vercel")).toEqual({ city: "Cape Town", region: "WC", country: "ZA" });
  });

  it("keeps a city it cannot decode rather than throwing", () => {
    expect(clientGeo(h({ "x-vercel-ip-city": "%E0%A4%A" }), "vercel").city).toBe("%E0%A4%A");
  });
});
