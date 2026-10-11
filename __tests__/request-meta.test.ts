import { describe, it, expect, afterEach } from "vitest";
import { clientIp, clientGeo } from "@/lib/request-meta";

/**
 * The IP feeds the rate limiter and Turnstile, and the geo feeds analytics.
 * Cloudflare writes its own headers and passes every other header through
 * from the client untouched, so trusting the wrong one lets a caller pick
 * their own IP. These pin which headers count.
 */

function h(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("clientIp", () => {
  it("trusts only cf-connecting-ip", () => {
    const headers = h({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "6.6.6.6, 203.0.113.7",
      "x-real-ip": "6.6.6.6",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("ignores a forged x-forwarded-for or x-real-ip when cf-connecting-ip is missing", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6" }))).toBeNull();
    expect(clientIp(h({ "x-real-ip": "6.6.6.6" }))).toBeNull();
  });

  describe("needs no HOST_PLATFORM", () => {
    const original = process.env.HOST_PLATFORM;
    afterEach(() => {
      if (original === undefined) delete process.env.HOST_PLATFORM;
      else process.env.HOST_PLATFORM = original;
    });

    it("reads cf-connecting-ip whatever HOST_PLATFORM says, or when it is unset", () => {
      const headers = h({ "cf-connecting-ip": "203.0.113.7", "x-real-ip": "6.6.6.6" });
      delete process.env.HOST_PLATFORM;
      expect(clientIp(headers)).toBe("203.0.113.7");
      process.env.HOST_PLATFORM = "vercel";
      expect(clientIp(headers)).toBe("203.0.113.7");
    });
  });
});

describe("clientGeo", () => {
  it("reads request.cf and ignores forged Vercel geo headers", () => {
    const headers = h({
      "x-vercel-ip-city": "Forged",
      "x-vercel-ip-country": "XX",
      "cf-ipcountry": "ZA",
    });
    expect(clientGeo(headers, { city: "Cape Town", regionCode: "WC", country: "ZA" })).toEqual({
      city: "Cape Town",
      region: "WC",
      country: "ZA",
    });
  });

  it("falls back to cf-ipcountry when request.cf is missing", () => {
    expect(clientGeo(h({ "cf-ipcountry": "ZA" }), undefined)).toEqual({
      city: null,
      region: null,
      country: "ZA",
    });
  });

  it("is empty outside the Worker, where there is no request.cf", () => {
    expect(clientGeo(h({ "x-vercel-ip-country": "ZA" }))).toEqual({
      city: null,
      region: null,
      country: null,
    });
  });
});
