/**
 * Cloudflare Turnstile verification.
 * Free, privacy-friendly alternative to reCAPTCHA.
 *
 * Set env vars:
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  (public, used in frontend)
 *   TURNSTILE_SECRET_KEY             (server-only)
 *
 * If env vars are not set, verification is skipped (dev-friendly).
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Not configured — skip (returns true)
    return true;
  }
  if (!token) return false;

  try {
    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token);
    if (ip) formData.append("remoteip", ip);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: formData }
    );

    const data = await response.json();
    return !!data.success;
  } catch {
    return false;
  }
}

export function turnstileConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}
