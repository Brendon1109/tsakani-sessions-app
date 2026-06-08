"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * Render-null client component that powers first-party analytics:
 *  1. Fires a `page_view` on every route change (App Router has no automatic
 *     page events).
 *  2. Provides a global, capture-phase click delegate so any element can be
 *     instrumented declaratively with `data-track="event_name"` (and an
 *     optional `data-track-props='{"k":"v"}'`) — including Server Components
 *     that cannot attach onClick handlers (e.g. the event ticket links).
 *
 * Mounted once in the root layout, mirroring the PWARegister pattern.
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();

  // Page views (intentionally keyed on pathname only — no useSearchParams, so
  // no Suspense/CSR-bailout requirement at build time).
  useEffect(() => {
    track("page_view");
  }, [pathname]);

  // Declarative click tracking via [data-track].
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.("[data-track]") as HTMLElement | null;
      if (!el) return;
      const name = el.getAttribute("data-track");
      if (!name) return;
      let props: Record<string, string> = {};
      const raw = el.getAttribute("data-track-props");
      if (raw) {
        try {
          props = JSON.parse(raw);
        } catch {
          /* ignore malformed props */
        }
      }
      track(name, props);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
