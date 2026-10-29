/**
 * Where to send someone after sign in. Only a path on this site: it must
 * start with one "/", and not "//" or "/\", which browsers read as another
 * host. Anything else goes home.
 *
 * Before 29 October 2026 the callback glued redirectTo straight onto the
 * origin, so `?redirectTo=.evil.example` landed a freshly signed in visitor on
 * tsakanisessions.co.za.evil.example. Bat Rush sends every party guest
 * through sign in from an Instagram link, which made that worth closing.
 */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  // Control characters and backslashes are stripped or rewritten by URL
  // parsers in ways that can change the host. A real path never has them.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return "/";
  return raw;
}
