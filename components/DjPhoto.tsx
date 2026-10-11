"use client";

import { useState } from "react";
import Image from "next/image";
import { djMonogram, type DjImage } from "@/lib/djs";

/**
 * A DJ's picture, filling its parent (which must be position relative and
 * sized). The fallback chain runs in the browser because only the browser
 * learns that a thumbnail 404'd: uploaded photo, then the video's sharp
 * thumbnail, then the plain one with its letterbox bars cropped off, then a
 * gold monogram so a card is never an empty grey box.
 */
export default function DjPhoto({
  image,
  name,
  sizes,
  priority = false,
  variant = "card",
}: {
  image: DjImage;
  name: string;
  sizes: string;
  priority?: boolean;
  variant?: "card" | "hero";
}) {
  // 0: first choice, 1: the hqdefault fallback, 2: monogram.
  const [step, setStep] = useState(image.kind === "monogram" ? 2 : 0);

  if (image.kind === "monogram" || step === 2) {
    return (
      <div
        role="img"
        aria-label={name}
        className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gold-900/30 via-dark-500 to-dark-700"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,215,0,0.10)_0%,_transparent_70%)]" />
        <span
          className={`relative font-bold text-gold-gradient leading-none ${
            variant === "hero" ? "text-9xl" : "text-6xl sm:text-7xl"
          }`}
        >
          {djMonogram(name)}
        </span>
      </div>
    );
  }

  const letterboxed = image.kind === "youtube" && step === 1;
  const src = letterboxed && image.kind === "youtube" ? image.fallback : image.src;

  return (
    // hqdefault is 4:3 with the 16:9 frame in the middle, so it is scaled by
    // 4/3 to push the black bars outside the frame.
    <div className={`absolute inset-0 ${letterboxed ? "scale-[1.34]" : ""}`}>
      <Image
        key={src}
        src={src}
        alt={name}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        onError={() =>
          setStep((s) => (image.kind === "youtube" && s === 0 ? 1 : 2))
        }
      />
    </div>
  );
}
