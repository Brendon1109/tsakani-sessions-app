"use client";

import { useEffect, useState } from "react";
import { enforceObjection, objected } from "@/lib/analytics";

/**
 * The analytics off switch, and the thing that makes legitimate interest a
 * lawful basis on this site rather than an assertion.
 *
 * POPIA section 11(3) gives a data subject the right to object to processing
 * that rests on legitimate interest, and section 11(4) is what gives that right
 * teeth: unlike GDPR there is no "compelling legitimate grounds" override to
 * weigh the objection against. Once somebody objects, the processing stops.
 * A control that only remembered a preference in the page would not satisfy it.
 *
 * So this calls the server. The server writes the objection cookie, and the
 * collect route reads that cookie before it parses a body, reads a visit cookie
 * or computes anything at all. The objection is in force on the very next
 * request rather than on the next deploy.
 *
 * ---------------------------------------------------------------------------
 * IT HAS TO STOP BOTH PIPELINES, AND THAT IS THE WHOLE POINT OF THIS FILE.
 * ---------------------------------------------------------------------------
 *
 * This site counts visits twice, through /api/track (the older product event
 * pipeline, session id `ts_sid`) and through /api/e (Breazy Analytics). A
 * visitor does not know that and should not have to. They asked the site to
 * stop counting them, so one switch stops both, and the older pipeline's
 * session id is deleted rather than merely left unused.
 *
 * Turning it back on is the same button. Withdrawal has to be as easy as the
 * collection was, which cuts both ways.
 *
 * On failure this says so. A privacy control that reports success the server
 * never gave is worse than one that is honestly broken, because the visitor
 * stops looking for the problem.
 */

type State = "loading" | "on" | "off" | "saving" | "error";

export default function AnalyticsToggle() {
  // Starts as "loading" and is resolved in an effect, never during render.
  // The answer lives in a cookie, which the server rendering this page cannot
  // read at build time, so deciding it during render would either hydrate
  // wrong or force the whole page dynamic.
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    setState(objected() ? "off" : "on");
  }, []);

  async function toggle() {
    const turningOn = state === "off";
    setState("saving");

    try {
      const res = await fetch("/api/e", {
        method: turningOn ? "PUT" : "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`http ${res.status}`);

      // Only now, with the server's answer in hand, change anything locally.
      if (turningOn) {
        window.breazyAnalytics?.optIn?.();
        try {
          localStorage.removeItem("bz-optout");
        } catch {
          /* private mode, the cookie the server just cleared is enough */
        }
        setState("on");
      } else {
        // Mirrors the objection into localStorage and stops the beacon on this
        // page without a reload.
        window.breazyAnalytics?.optOut?.();
        try {
          localStorage.setItem("bz-optout", "1");
        } catch {
          /* private mode, the server cookie still carries the objection */
        }
        // And clear ts_sid, the older pipeline's session id.
        enforceObjection();
        setState("off");
      }
    } catch {
      setState("error");
    }
  }

  const busy = state === "saving" || state === "loading";

  return (
    <div className="bg-gold-500/5 border border-gold-500/20 rounded-xl p-6">
      <p className="text-white font-medium mb-2">Counting on this device</p>

      <p className="text-sm text-gray-400 mb-4">
        {state === "off"
          ? "Off. Nothing on this site is counting your visits, and the visit cookie and session id have been deleted from this browser."
          : "On. We count pages viewed and time on screen. No name, no email, no IP address is kept, and nothing identifies you."}
      </p>

      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-live="polite"
        className="inline-flex items-center justify-center rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "loading"
          ? "Checking…"
          : state === "saving"
            ? "Saving…"
            : state === "off"
              ? "Turn counting back on"
              : "Turn counting off"}
      </button>

      {state === "error" && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          That did not save, so nothing has changed. Please try again, or email{" "}
          <a
            href="mailto:tsakanisessions@gmail.com"
            className="text-gold-500 hover:text-gold-400 underline"
          >
            tsakanisessions@gmail.com
          </a>{" "}
          and we will do it by hand.
        </p>
      )}

      <p className="mt-4 text-xs text-gray-500">
        This choice is remembered on this browser only, because it is stored on
        this device rather than against an account. Choose again on your phone
        if you also browse there, and again if you clear your cookies.
      </p>
    </div>
  );
}
