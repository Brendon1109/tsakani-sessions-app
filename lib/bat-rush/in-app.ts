/**
 * In-app browsers. Google refuses to sign anyone in from inside an app's
 * embedded browser (error disallowed_useragent), and most people at the party
 * will open the game from an Instagram story or bio. So before sending
 * someone to sign in, the game checks for one and shows an "open in Chrome or
 * Safari" step instead.
 *
 * Instagram puts "Instagram" in its user agent, Facebook and Messenger put
 * FBAN (iOS) or FBAV (both). TikTok's browser is refused by Google the same
 * way and links to this site live there too, so it is caught as well.
 */
export type InAppBrowser = "instagram" | "facebook" | "tiktok";

export function inAppBrowser(ua: string | null | undefined): InAppBrowser | null {
  const s = ua ?? "";
  if (/Instagram/i.test(s)) return "instagram";
  if (/FBAN|FBAV/.test(s)) return "facebook";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(s)) return "tiktok";
  return null;
}

export function isAndroid(ua: string | null | undefined): boolean {
  return /Android/i.test(ua ?? "");
}

export function isIOS(ua: string | null | undefined): boolean {
  return /iPhone|iPad|iPod/i.test(ua ?? "");
}

/**
 * An Android intent link that opens this page in Chrome, falling back to the
 * same page in whatever opened it if Chrome is not installed.
 */
export function chromeIntentUrl(pageUrl: string): string {
  const u = new URL(pageUrl);
  return (
    `intent://${u.host}${u.pathname}${u.search}` +
    `#Intent;scheme=https;package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(u.href)};end`
  );
}
