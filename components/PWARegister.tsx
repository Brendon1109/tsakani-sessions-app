"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    // When a new worker takes over a page an older one started, reload once
    // so nothing on the page is left with the old worker's failures. Workers
    // installed while the site was on Vercel block the gallery photos on R2
    // (public/sw.js). Not on /admin, where a reload would drop an upload queue.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    const onChange = () => {
      if (!hadController || reloaded || window.location.pathname.startsWith("/admin")) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // Silent fail — PWA is progressive enhancement
      });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  return null;
}
