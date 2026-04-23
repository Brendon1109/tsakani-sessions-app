"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Check } from "lucide-react";
import Turnstile from "@/components/Turnstile";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [consentEvents, setConsentEvents] = useState(false);
  const [consentMerch, setConsentMerch] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const captchaRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const canSubmit =
    email &&
    (consentEvents || consentMerch) &&
    (!captchaRequired || captchaToken) &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          consent_events: consentEvents,
          consent_merch: consentMerch,
          captcha_token: captchaToken,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage({ kind: "err", text: data.error || "Signup failed. Try again." });
        setSubmitting(false);
        return;
      }

      setMessage({ kind: "ok", text: "You're in. Thanks for signing up." });
      setEmail("");
      setConsentEvents(false);
      setConsentMerch(false);
      setCaptchaToken("");
    } catch {
      setMessage({ kind: "err", text: "Something went wrong. Check your connection." });
    } finally {
      setSubmitting(false);
    }
  }

  if (message?.kind === "ok") {
    return (
      <div className="bg-dark-300/50 border border-gold-500/20 rounded-xl p-5 flex items-start gap-3">
        <Check size={18} className="text-gold-500 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm text-gray-300">{message.text}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" aria-label="Newsletter signup">
      <label className="sr-only" htmlFor="newsletter-email">
        Email address
      </label>
      <div className="relative">
        <Mail
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          maxLength={254}
          autoComplete="email"
          className="w-full bg-dark-300 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none transition-colors"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">What do you want to receive</legend>
        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={consentEvents}
            onChange={(e) => setConsentEvents(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-gold-500 cursor-pointer shrink-0"
          />
          <span className="text-gray-400 text-xs leading-snug group-hover:text-gray-300 transition-colors">
            Send me news about upcoming <strong className="text-gray-300">events</strong>.
          </span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={consentMerch}
            onChange={(e) => setConsentMerch(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-gold-500 cursor-pointer shrink-0"
          />
          <span className="text-gray-400 text-xs leading-snug group-hover:text-gray-300 transition-colors">
            Tell me about new <strong className="text-gray-300">Tsakani merch</strong> drops.
          </span>
        </label>
      </fieldset>

      {captchaRequired && (
        <div>
          <Turnstile onToken={setCaptchaToken} />
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-gold-gradient text-black font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {submitting ? "Signing up..." : "Sign up"}
      </button>

      <p className="text-gray-500 text-xs leading-relaxed">
        By signing up you agree to our{" "}
        <Link
          href="/privacy"
          className="text-gold-500 hover:text-gold-400 underline"
        >
          Privacy Policy
        </Link>
        . We may share your email with event partners or collaborating brands
        to promote Tsakani Sessions. Unsubscribe any time.
      </p>

      {message?.kind === "err" && (
        <p className="text-red-400 text-xs" role="alert">
          {message.text}
        </p>
      )}
    </form>
  );
}
