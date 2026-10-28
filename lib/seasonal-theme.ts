/**
 * Halloween 2026. The site turns pumpkin orange from 28 October and goes back
 * to gold by itself at 00:00 on 1 November, Cape Town time, with no deploy.
 *
 * The check runs in the browser before first paint, not on the server. Static
 * pages are rendered once at build time and the service worker keeps old HTML,
 * so a server side check would leave some pages orange long after the window.
 * Date.now() is UTC, so the visitor's time zone makes no difference.
 *
 * The colours live in globals.css under html[data-theme="halloween"], the bats
 * in components/HalloweenBats.tsx and the moon in the home page hero. Once the
 * window has passed, delete this file, those three, and the script in
 * app/layout.tsx. The gold scale as CSS variables stays, it is how the next
 * seasonal theme gets in.
 */
export const HALLOWEEN_START = Date.parse("2026-10-28T00:00:00+02:00");
export const HALLOWEEN_END = Date.parse("2026-11-01T00:00:00+02:00");

export function isHalloween(now: number): boolean {
  return now >= HALLOWEEN_START && now < HALLOWEEN_END;
}

// Inline in <head>, so it must stay plain ES5 with no imports.
export const halloweenScript = `(function(){var n=Date.now();if(n>=${HALLOWEEN_START}&&n<${HALLOWEEN_END})document.documentElement.setAttribute("data-theme","halloween")})()`;
