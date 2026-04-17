"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface TurnstileProps {
  onToken: (token: string) => void;
  theme?: "light" | "dark" | "auto";
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export default function Turnstile({ onToken, theme = "dark" }: TurnstileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !ref.current) return;

    const render = () => {
      if (!window.turnstile || !ref.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onToken(token),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          render();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [siteKey, theme, onToken]);

  if (!siteKey) {
    // Not configured — don't render anything (dev-friendly)
    return null;
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
      />
      <div ref={ref} />
    </>
  );
}
