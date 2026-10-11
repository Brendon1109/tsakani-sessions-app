import { describe, it, expect, afterEach } from "vitest";
import { clientIp, clientGeo } from "@/lib/request-meta";

/**
 * The IP feeds the rate limiter, Turnstile and the newsletter consent record,
 * and the geo feeds analytics. Cloudflare writes its own headers and passes
 * every other header through from the client untouched, so trusting the
 * wrong one lets a caller pick their own IP or country. These pin which
 * headers count, and that off the Worker none of them do.
 *
 * Vitest has no OpenNext Cloudflare context, so a call without the second
 * argument behaves exactly as it would off the Worker. Passing a request
 * object stands in for a real request on the Worker.
 */

const onWorker = { cf: undefined };

function h(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("clientIp on the Worker", () => {
  it("trusts only cf-connecting-ip", () => {
    const headers = h({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "6.6.6.6, 203.0.113.7",
      "x-real-ip": "6.6.6.6",
    });
    expect(clientIp(headers, onWorker)).toBe("203.0.113.7");
  });

  it("ignores a forged x-forwarded-for or x-real-ip when cf-connecting-ip is missing", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6" }), onWorker)).toBeNull();
    expect(clientIp(h({ "x-real-ip": "6.6.6.6" }), onWorker)).toBeNull();
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
      expect(clientIp(headers, onWorker)).toBe("203.0.113.7");
      process.env.HOST_PLATFORM = "vercel";
      expect(clientIp(headers, onWorker)).toBe("203.0.113.7");
    });
  });
});

describe("clientIp off the Worker", () => {
  it("returns null for a forged cf-connecting-ip", () => {
    const headers = h({ "cf-connecting-ip": "6.6.6.6", "x-forwarded-for": "6.6.6.6" });
    expect(clientIp(headers, null)).toBeNull();
    // No context argument: vitest, like next start or Vercel, has no OpenNext context.
    expect(clientIp(headers)).toBeNull();
  });
});

describe("clientGeo on the Worker", () => {
  it("reads request.cf and ignores forged Vercel geo headers", () => {
    const headers = h({
      "x-vercel-ip-city": "Forged",
      "x-vercel-ip-country": "XX",
    });
    expect(clientGeo(headers, { cf: { city: "Cape Town", regionCode: "WC", country: "ZA" } })).toEqual({
      city: "Cape Town",
      region: "WC",
      country: "ZA",
    });
  });

  it("prefers request.cf's country over cf-ipcountry", () => {
    const headers = h({ "cf-ipcountry": "NA" });
    expect(clientGeo(headers, { cf: { country: "ZA" } }).country).toBe("ZA");
  });

  it("falls back to cf-ipcountry when request.cf is missing", () => {
    expect(clientGeo(h({ "cf-ipcountry": "ZA" }), onWorker)).toEqual({
      city: null,
      region: null,
      country: "ZA",
    });
  });
});

describe("clientGeo off the Worker", () => {
  it("returns nothing for a forged cf-ipcountry or Vercel geo header", () => {
    const headers = h({ "cf-ipcountry": "XX", "x-vercel-ip-country": "XX", "x-vercel-ip-city": "Forged" });
    const empty = { city: null, region: null, country: null };
    expect(clientGeo(headers, null)).toEqual(empty);
    expect(clientGeo(headers)).toEqual(empty);
  });
});
