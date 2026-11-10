import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * public/bz.js, the analytics beacon, run against stand in browser globals.
 * Every page view must end in one "leave" beacon carrying the time the page
 * was on screen. Until November 2026 this copy had closeView() set `closed`
 * and then call send(), and send() returned early once closed, so no leave
 * ever left the browser and time on page read 0 everywhere. The upstream
 * copy in g-analytics fixed it on 27 August 2026 and this repo had not been
 * resynced. This runs the real file, so a re-copy of an old version fails here.
 *
 * Plain stand ins rather than happy-dom, see vitest.config.ts. The beacon
 * only touches the handful of globals passed in below.
 */
const SRC = readFileSync("public/bz.js", "utf8");

type Beacon = { url: string; body: Record<string, unknown> };
type Listener = (e: { persisted?: boolean }) => void;

function load({ optedOut = false } = {}) {
  let now = 0;
  let visibility = "visible";
  const beacons: Beacon[] = [];
  const docListeners: Record<string, Listener[]> = {};
  const winListeners: Record<string, Listener[]> = {};
  const store = new Map<string, string>(optedOut ? [["bz-optout", "1"]] : []);
  const on = (bag: Record<string, Listener[]>) => (type: string, fn: Listener) => {
    (bag[type] ||= []).push(fn);
  };
  const fire = (bag: Record<string, Listener[]>, type: string) => {
    (bag[type] || []).forEach((fn) => fn({}));
  };

  const document = {
    currentScript: { getAttribute: (k: string) => (k === "data-site" ? "tsakani" : null) },
    get visibilityState() {
      return visibility;
    },
    cookie: "",
    referrer: "",
    addEventListener: on(docListeners),
  };
  const window = { addEventListener: on(winListeners) };
  const navigator = {
    sendBeacon: (url: string, body: string) => {
      beacons.push({ url, body: JSON.parse(body) });
      return true;
    },
  };
  const location = { pathname: "/", origin: "https://tsakanisessions.co.za" };
  const history = { pushState() {}, replaceState() {} };
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
  const performance = { now: () => now };
  const fetch = () => {
    throw new Error("sendBeacon succeeded, fetch must not run");
  };

  new Function(
    "window",
    "document",
    "navigator",
    "location",
    "history",
    "localStorage",
    "performance",
    "fetch",
    SRC,
  )(window, document, navigator, location, history, localStorage, performance, fetch);

  return {
    beacons,
    location,
    history,
    advance: (ms: number) => {
      now += ms;
    },
    hide: () => {
      visibility = "hidden";
      fire(docListeners, "visibilitychange");
    },
    pagehide: () => fire(winListeners, "pagehide"),
  };
}

describe("bz.js", () => {
  it("sends a view, then one leave with the time on screen when the page is hidden", () => {
    const page = load();
    expect(page.beacons.map((b) => b.body.event)).toEqual(["view"]);
    page.advance(12000);
    page.hide();
    page.pagehide();
    const leaves = page.beacons.filter((b) => b.body.event === "leave");
    expect(leaves).toHaveLength(1);
    expect(leaves[0].url).toBe("/api/e");
    expect(leaves[0].body.site).toBe("tsakani");
    expect(leaves[0].body.dwell_ms).toBe(12000);
  });

  it("closes the old view with a leave on a soft navigation", () => {
    const page = load();
    page.advance(5000);
    page.location.pathname = "/events";
    page.history.pushState();
    expect(page.beacons.map((b) => [b.body.event, b.body.path, b.body.dwell_ms])).toEqual([
      ["view", "/", undefined],
      ["leave", "/", 5000],
      ["view", "/events", undefined],
    ]);
  });

  it("sends nothing at all for someone who has opted out", () => {
    const page = load({ optedOut: true });
    page.advance(3000);
    page.hide();
    page.pagehide();
    expect(page.beacons).toHaveLength(0);
  });
});
