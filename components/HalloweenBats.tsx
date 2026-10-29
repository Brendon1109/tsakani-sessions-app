"use client";

import { usePathname } from "next/navigation";
import { BAT_PATH } from "@/lib/bat-rush/shapes";

/**
 * Halloween 2026 only, delete with lib/seasonal-theme.ts. globals.css hides
 * these outside the window, for reduced motion and in print. Never over a
 * ticket, whose QR a door scanner has to read, never over admin, where the
 * door scanner itself lives, and never over Bat Rush, where a bat you cannot
 * tap would only confuse.
 */
const BATS = [
  { top: "14vh", size: 52, duration: 19, delay: 0, reverse: false },
  { top: "27vh", size: 40, duration: 23, delay: 6, reverse: false },
  { top: "36vh", size: 64, duration: 27, delay: 11, reverse: true },
  { top: "20vh", size: 36, duration: 21, delay: 16, reverse: true },
];

export default function HalloweenBats() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/ticket") ||
    pathname.startsWith("/halloween")
  ) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="halloween-only halloween-bats fixed inset-0 z-40 pointer-events-none overflow-hidden"
    >
      {BATS.map((bat) => (
        <div
          key={bat.top}
          className="halloween-bat"
          style={{
            top: bat.top,
            width: bat.size,
            animationDuration: `${bat.duration}s`,
            animationDelay: `${bat.delay}s`,
            animationDirection: bat.reverse ? "reverse" : "normal",
          }}
        >
          <svg viewBox="0 0 100 40">
            <path d={BAT_PATH} />
          </svg>
        </div>
      ))}
    </div>
  );
}
