"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, MailX } from "lucide-react";

/**
 * Asks before acting, deliberately.
 *
 * The obvious design is to unsubscribe on page load, so the link in the email is
 * genuinely one click. It is also how you unsubscribe people who never clicked:
 * corporate mail filters and link scanners fetch every URL in an email to check
 * it is safe, and a GET that mutates would remove them silently. So the page
 * loads, then a real person presses a real button.
 *
 * Mail clients that offer their own unsubscribe button still get true one-click
 * — they POST to /api/newsletter/unsubscribe via the List-Unsubscribe header,
 * which is an explicit human action and safe to honour immediately.
 */
export default function UnsubscribeClient({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    token ? "idle" : "error"
  );
  const [error, setError] = useState(
    token ? "" : "This unsubscribe link is missing its code. Use the link from your email."
  );

  async function handleUnsubscribe() {
    setState("working");
    setError("");
    try {
      const res = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="bg-dark-700 border border-white/10 rounded-2xl p-7 text-center">
        <div className="w-12 h-12 rounded-full bg-gold-500/10 border border-gold-500/25 flex items-center justify-center mx-auto">
          <Check size={22} className="text-gold-500" />
        </div>
        <h1 className="text-white font-bold text-xl mt-4">You&apos;re unsubscribed.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mt-2">
          We won&apos;t email you again. Thanks for the time you gave us — the door stays open
          if you ever want back in.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center border border-white/10 text-gray-300 font-semibold px-5 py-2.5 rounded-full hover:bg-white/5 transition-colors text-sm"
        >
          Back to the site
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-dark-700 border border-white/10 rounded-2xl p-7 text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
        <MailX size={22} className="text-gray-400" />
      </div>
      <h1 className="text-white font-bold text-xl mt-4">Unsubscribe?</h1>
      <p className="text-gray-400 text-sm leading-relaxed mt-2">
        You&apos;ll stop receiving emails about Tsakani Sessions events and merch drops.
        You can sign up again any time.
      </p>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2 mt-4" role="alert">
          {error}
        </p>
      )}

      {token && (
        <button
          type="button"
          onClick={handleUnsubscribe}
          disabled={state === "working"}
          className="mt-6 w-full bg-gold-gradient text-black font-semibold px-5 py-3 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {state === "working" ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Unsubscribing
            </>
          ) : (
            "Yes, unsubscribe me"
          )}
        </button>
      )}

      <Link
        href="/"
        className="mt-3 block text-gray-400 hover:text-white text-sm transition-colors"
      >
        No, keep me subscribed
      </Link>
    </div>
  );
}
