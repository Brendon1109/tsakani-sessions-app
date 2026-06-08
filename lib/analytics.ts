/**
 * First-party, privacy-friendly (POPIA-conscious) event tracking.
 *
 * - No third-party scripts, no cookies, no cross-site identifiers.
 * - A random session id is kept in localStorage only (cleared by the user any
 *   time). No personal data is sent from the client.
 * - Respects Do-Not-Track and an optional kill switch
 *   (NEXT_PUBLIC_ANALYTICS_DISABLED=true).
 * - Coarse geo (city/region/country) is derived server-side from Vercel edge
 *   headers in /api/track; the client never sends an IP or precise location.
 *
 * Posts same-origin to /api/track via navigator.sendBeacon (with a fetch
 * keepalive fallback). Always fire-and-forget — never throws, never blocks.
 */

const SID_KEY = "ts_sid";
const ENDPOINT = "/api/track";

export type TrackProps = Record<
  string,
  string | number | boolean | null | undefined
>;

function disabled(): boolean {
  if (process.env.NEXT_PUBLIC_ANALYTICS_DISABLED === "true") return true;
  if (typeof navigator === "undefined") return true;
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
