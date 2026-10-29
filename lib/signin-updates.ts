import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * Event updates are a separate, unticked choice on the sign in screen.
 *
 * Until 29 October 2026 the screen said "By signing in, you agree to receive
 * updates", which bundled marketing consent into signing in. POPIA section 69
 * wants its own yes for anyone who has not bought anything, and Bat Rush sends
 * a whole party of new people through sign in to save a score. So signing in
 * now does only that, and the tick adds the Google email to the newsletter
 * with events consent, recorded through subscribe_newsletter like the footer
 * form, with source "signin".
 *
 * The choice rides on the OAuth return URL as updates=1. It is never read from
 * the sign in page's own URL, so nobody can send a link that arrives pre-ticked.
 */
export const UPDATES_PARAM = "updates";

export function buildCallbackUrl(origin: string, redirectTo: string | null, wantsUpdates: boolean): string {
  const params = new URLSearchParams({ redirectTo: safeRedirectPath(redirectTo) });
  if (wantsUpdates) params.set(UPDATES_PARAM, "1");
  return `${origin}/auth/callback?${params.toString()}`;
}

export function wantsUpdates(searchParams: URLSearchParams): boolean {
  return searchParams.get(UPDATES_PARAM) === "1";
}
