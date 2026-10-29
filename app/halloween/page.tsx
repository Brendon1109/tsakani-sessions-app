import type { Metadata } from "next";
import BatRushGame from "./BatRushGame";

/**
 * Bat Rush, the Halloween 2026 game. Nothing here reads cookies, headers or
 * the database, so Next prerenders the page at build time. The board and the
 * saves go from the browser straight to Supabase (components/bat-rush/api.ts).
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
