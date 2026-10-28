"use client";

import { usePathname } from "next/navigation";

/**
 * Halloween 2026 only, delete with lib/seasonal-theme.ts. globals.css hides
 * these outside the window, for reduced motion and in print. Never over a
 * ticket, whose QR a door scanner has to read, and never over admin, where the
 * door scanner itself lives.
 */
const BATS = [
  { top: "14vh", size: 52, duration: 19, delay: 0, reverse: false },
  { top: "27vh", size: 40, duration: 23, delay: 6, reverse: false },
  { top: "36vh", size: 64, duration: 27, delay: 11, reverse: true },
  { top: "20vh", size: 36, duration: 21, delay: 16, reverse: true },
];

const BAT_PATH =
  "M50 16L54 8L57 16Q66 9 80 6Q92 5 99 14Q90 15 87 23Q80 19 73 25Q67 22 62 31Q56 28 52 34L50 38L48 34Q44 28 38 31Q33 22 27 25Q20 19 13 23Q10 15 1 14Q8 5 20 6Q34 9 43 16L46 8Z";

export default function HalloweenBats() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname.startsWith("/ticket")) {
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
