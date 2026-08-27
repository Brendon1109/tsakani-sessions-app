/**
 * First-party, privacy-friendly (POPIA-conscious) event tracking.
 *
 * ===========================================================================
 * THIS SITE RUNS TWO ANALYTICS PIPELINES ON PURPOSE. DO NOT MERGE THEM.
 * ===========================================================================
 *
 * This file and /api/track are the older pipeline. app/api/e is Breazy
 * Analytics, which was EXTRACTED from this one, so the new one is this one's
 * descendant rather than its replacement. Neither is dead code.
 *
 *   this one   knows the PRODUCT. Fifteen named events with a props bag, so it
 *              can answer which event sold tickets, which tee was viewed, which
 *              booking form was abandoned. It cannot see any other site.
 *
 *   /api/e     knows the VISIT, across every site Brendon runs. Time actually
 *              on screen, returning versus new, and one place to compare this
 *              site against the rest. It carries no product detail and never
 *              will, and it redacts ticket and order codes out of paths.
 *
 * Deleting either loses something the other cannot answer. If a future change
 * looks like a tidy up that collapses them, it is a feature removal wearing a
 * refactor's clothes.
 *
 * They share exactly one thing, deliberately: the opt out. A visitor who
 * objects on /privacy stops BOTH. See `objected()` below.
 *
 * app/api/e/core.ts and app/api/e/route.ts are byte for byte copies of the
 * shared upstream in Brendon1109/breazy-analytics. Never hand edit them. A fix
 * goes upstream and is copied down, otherwise the cookie rules drift between
 * sites and the drift is invisible until one site behaves differently.
 *
 * Because they are vendored, .eslintrc.json turns off no-explicit-any for those
 * two paths only. `collect(body: any, ...)` in the shared core would otherwise
 * fail this repo's lint and CI runs lint. That override is the price of keeping
 * the copy identical, and it is scoped to those two files so nothing else in
 * the app loses the rule.
 *
 * - No third-party scripts, no cookies, no cross-site identifiers.
 * - A random session id is kept in localStorage only (cleared by the user any
 *   time). No personal data is sent from the client.
 * - Respects Do-Not-Track and an optional kill switch
 *   (NEXT_PUBLIC_ANALYTICS_DISABLED=true).
 * - Respects a per-visitor objection made on /privacy. The kill switch is an
 *   operator control for the whole site and Do-Not-Track is a browser default,
 *   so neither is the POPIA s11(3) right to object. `objected()` below is.
 * - Coarse geo (city/region/country) is derived server-side from Vercel edge
 *   headers in /api/track; the client never sends an IP or precise location.
 *
 * Posts same-origin to /api/track via navigator.sendBeacon (with a fetch
 * keepalive fallback). Always fire-and-forget — never throws, never blocks.
 */

const SID_KEY = "ts_sid";
const ENDPOINT = "/api/track";

/**
 * The objection markers, shared with the Breazy Analytics beacon in
 * `public/bz.js` and with the collect route at `/api/e`.
 *
 * One objection, both pipelines. A visitor who turns counting off on /privacy
 * would reasonably expect the site to stop counting them, not to stop one of
 * two systems they were never told apart. The cookie is the authoritative one
 * because the server sets it and the server reads it; the localStorage key is
 * a mirror so the client can answer without waiting for a round trip.
 */
const OPT_OUT_COOKIE = "bz_optout=1";
const OPT_OUT_KEY = "bz-optout";

export type TrackProps = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Has this visitor exercised the POPIA s11(3) right to object?
 *
 * s11(4) has no "compelling legitimate grounds" override the way GDPR does, so
 * an objection is not weighed against anything. It simply stops the processing.
 * Hence this is checked before an event is built rather than filtered later.
 */
export function objected(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(OPT_OUT_KEY) === "1") return true;
  } catch {
    // Private mode throws on access. Fall through to the cookie, which is the
    // copy that survives cleared storage anyway.
  }
  try {
    return document.cookie.indexOf(OPT_OUT_COOKIE) !== -1;
  } catch {
    return false;
  }
}

/**
 * Stopping is not enough on its own. An objection should also remove what this
 * pipeline already put on the device, so `ts_sid` goes. Safe to call any time:
 * it does nothing unless the visitor has actually objected.
 */
export function enforceObjection(): void {
  if (typeof window === "undefined" || !objected()) return;
  try {
    localStorage.removeItem(SID_KEY);
  } catch {
    // Nothing else to try. The session id is only readable by this origin and
    // track() is already refusing to send, so no event can carry it regardless.
  }
}

function disabled(): boolean {
  if (process.env.NEXT_PUBLIC_ANALYTICS_DISABLED === "true") return true;
  if (typeof navigator === "undefined") return true;
  if (objected()) return true;
  const dnt =
    // @ts-expect-error vendor-prefixed flags
    navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

function getSessionId(): string | null {
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return null;
  }
}

function referrerHost(): string {
  try {
    return document.referrer ? new URL(document.referrer).host : "";
  } catch {
    return "";
  }
}

/**
 * Track an analytics event. Safe to call from anywhere in client code.
 */
export function track(event: string, props: TrackProps = {}): void {
  if (typeof window === "undefined" || disabled()) return;
  try {
    const body = JSON.stringify({
      site: "app",
      event: String(event).slice(0, 64),
      path: location.pathname.slice(0, 512),
      referrer: referrerHost(),
      session_id: getSessionId(),
      props: props || {},
    });

    if (navigator.sendBeacon) {
      // Same-origin POST — application/json is fine (no CORS preflight).
      navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
    } else {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics must never break the app.
  }
}
