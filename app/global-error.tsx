"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#000", color: "#fff", fontFamily: "system-ui", padding: 40 }}>
        <div style={{ maxWidth: 500, margin: "10vh auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, marginBottom: 16 }}>Something went wrong</h1>
          <p style={{ color: "#a0a0a0", marginBottom: 24 }}>
            We&apos;ve been notified. Please try again or head back to the homepage.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #ffd700, #d4a000)",
              color: "#000",
              padding: "10px 24px",
              borderRadius: 999,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Go home
          </Link>
          {error.digest && (
            <p style={{ color: "#555", fontSize: 12, marginTop: 24 }}>
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
