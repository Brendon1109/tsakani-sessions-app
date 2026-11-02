import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { distance, photoMatches, MATCH_DISTANCE, MODEL_URL, scanUrl } from "@/lib/find-me";
import { CONSENT, CONSENT_VERSION } from "@/app/gallery/[slug]/FindMe";

/**
 * Find me's promises, held by tests. The rules come from
 * legal/tsakani-find-my-photos-popia-2026-11-02.md in Brendon's Breazy repo:
 * nothing about a face leaves the device, nothing is kept, the model comes
 * from this site, and the consent words are the approved version.
 */

const SOURCES = ["lib/find-me.ts", "app/gallery/[slug]/FindMe.tsx"].map((f) => [
  f,
  readFileSync(f, "utf8"),
]);

describe("Find me sends nothing and keeps nothing", () => {
  it.each(SOURCES)("%s never posts, puts or beacons", (_f, src) => {
    expect(src).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)["']/i);
    expect(src).not.toMatch(/sendBeacon|XMLHttpRequest|WebSocket|EventSource/);
  });

  it.each(SOURCES)("%s stores nothing on the device", (_f, src) => {
    expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB|caches\.|serviceWorker/);
  });

  it.each(SOURCES)("%s loads nothing from another host", (_f, src) => {
    expect(src).not.toMatch(/https?:\/\/(?!tsakanisessions\.co\.za)/);
  });

  it("the one count it makes carries no props", () => {
    const ui = SOURCES[1][1];
    const calls = ui.match(/track\([^)]*\)/g) || [];
    expect(calls).toEqual(['track("find_me_used")']);
  });
});

describe("the model is served from this site", () => {
  it("loads from a same origin path", () => {
    expect(MODEL_URL.startsWith("/")).toBe(true);
    expect(scanUrl("https://x.supabase.co/a.jpg").startsWith("/_next/image?")).toBe(true);
  });

  it.each(["ssd_mobilenetv1_model", "face_landmark_68_model", "face_recognition_model"])(
    "public%s has %s and every weight file its manifest names",
    (name) => {
      const dir = `public${MODEL_URL}`;
      const manifest = JSON.parse(readFileSync(`${dir}/${name}-weights_manifest.json`, "utf8"));
      const paths = manifest.flatMap((g: { paths: string[] }) => g.paths);
      expect(paths.length).toBeGreaterThan(0);
      for (const p of paths) expect(existsSync(`${dir}/${p}`)).toBe(true);
    }
  );
});

describe("consent sheet", () => {
  it("is the approved find-me-consent-v1 wording, word for word", () => {
    expect(CONSENT_VERSION).toBe("find-me-consent-v1");
    expect(CONSENT).toEqual({
      heading: "Find your photos",
      body:
        "We use face recognition on this device to spot you in this gallery. Your selfie and face scan stay on this device, never reach us, and are gone when you close the page. It can miss photos, so the full gallery stays here. Only use your own face, and only if you’re 18 or over.",
      link: "How it works",
      agree: "I agree, find me",
      cancel: "Not now",
    });
  });

  it("has no dash punctuation", () => {
    expect(Object.values(CONSENT).join(" ")).not.toMatch(/[–—]| - /);
  });
});

describe("matching", () => {
  it("measures the distance between two face scans", () => {
    expect(distance([0, 0], [3, 4])).toBe(5);
  });

  it("matches a photo when any face in it is close enough", () => {
    const me = [0, 0, 0];
    expect(photoMatches(me, [[1, 1, 1], [0.1, 0.1, 0.1]])).toBe(true);
    expect(photoMatches(me, [[MATCH_DISTANCE, 0, 0]])).toBe(false);
    expect(photoMatches(me, [])).toBe(false);
  });
});
