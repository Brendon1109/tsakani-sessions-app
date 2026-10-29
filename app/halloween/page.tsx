import type { Metadata } from "next";
import BatRushGame from "./BatRushGame";

/**
 * Bat Rush, the Halloween 2026 game. Nothing here reads cookies, headers or
 * the database, so Next marks the page static. That does NOT make it free on
 * this Worker: open-next.config.ts runs with no incremental cache, so OpenNext
 * renders a "static" page on every request, a small render with no database
 * call. Everything after the page loads (the round, the board, the saves)
 * runs in the browser or goes straight to Supabase (components/bat-rush/api.ts)
 * and never touches the Worker, except the analytics beacons.
 */
export const metadata: Metadata = {
  title: "Bat Rush",
  description: "Tsakani Halloween at The Barn UWC. Catch bats, dodge pumpkins, farm your aura.",
  alternates: { canonical: "/halloween" },
  openGraph: {
    title: "Bat Rush | Tsakani Sessions",
    description: "Catch bats, dodge pumpkins, farm your aura.",
    url: "/halloween",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Tsakani Sessions" }],
  },
};

export default function HalloweenPage() {
  return <BatRushGame />;
}
