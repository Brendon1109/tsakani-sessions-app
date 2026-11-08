/**
 * The Bat Rush banner on the home page. It shows from 12:00 on 31 October to
 * 06:00 on 1 November, Cape Town time, so the game can be live on Friday and
 * reachable only by its link while it is tested.
 *
 * Same pattern as lib/seasonal-theme.ts: a plain script in <head> sets an
 * attribute on <html> before first paint, and globals.css shows anything with
 * the bat-rush-only class while it is set. Static pages and service worker
 * copies follow the clock with no deploy. Delete with the rest of Bat Rush.
 */
export const BAT_RUSH_BANNER_START = Date.parse("2026-10-31T12:00:00+02:00");
export const BAT_RUSH_BANNER_END = Date.parse("2026-11-01T06:00:00+02:00");

export function isBatRushBannerOn(now: number): boolean {
  return now >= BAT_RUSH_BANNER_START && now < BAT_RUSH_BANNER_END;
}

/**
 * True once the window has closed for good. From then the home page does not
 * render the banner at all, so it leaves the HTML as well as the screen. The
 * script below only hides it, which left "Bat Rush is live" in the page for
 * anything that reads the HTML without the CSS: search engines, link previews,
 * text readers. The script still hides it on a copy rendered before the end,
 * such as the one the service worker keeps.
 */
export function isBatRushBannerOver(now: number = Date.now()): boolean {
  return now >= BAT_RUSH_BANNER_END;
}

// Inline in <head>, so it must stay plain ES5 with no imports.
export const batRushBannerScript = `(function(){var n=Date.now();if(n>=${BAT_RUSH_BANNER_START}&&n<${BAT_RUSH_BANNER_END})document.documentElement.setAttribute("data-bat-rush","on")})()`;
