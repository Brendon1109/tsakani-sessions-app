"use client";

import { useState } from "react";
import Image from "next/image";
import { djMonogram, type DjImage } from "@/lib/djs";

interface DjPhotoProps {
  image: DjImage;
  name: string;
  sizes: string;
  priority?: boolean;
  variant?: "card" | "hero";
  /**
   * True where the DJ's name is already right next to the picture, as on a
   * roster card, so a screen reader does not read the name twice.
   */
  decorative?: boolean;
}

/**
 * A DJ's picture, filling its parent (which must be position relative and
 * sized). The fallback chain runs in the browser because only the browser
 * learns that a thumbnail 404'd: uploaded photo, then the video's sharp
 * thumbnail, then the plain one with its letterbox bars cropped off, then a
 * gold monogram so a card is never an empty grey box.
 *
 * Keyed on the first choice, so when the picture changes (an admin uploads a
 * photo to a DJ who was showing the monogram) the chain starts again rather
 * than staying on the step the old picture reached.
 */
export default function DjPhoto(props: DjPhotoProps) {
  const key = props.image.kind === "monogram" ? "monogram" : props.image.src;
  return <DjPhotoChain key={key} {...props} />;
}

function DjPhotoChain({
  image,
  name,
  sizes,
  priority = false,
  variant = "card",
  decorative = false,
}: DjPhotoProps) {
  // 0: first choice, 1: the hqdefault fallback, 2: monogram.
  const [step, setStep] = useState(image.kind === "monogram" ? 2 : 0);

  if (image.kind === "monogram" || step === 2) {
    return (
      <div
        {...(decorative
          ? { "aria-hidden": true }
          : { role: "img", "aria-label": name })}
        className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gold-900/30 via-dark-500 to-dark-700"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgb(var(--gold-500)/0.10)_0%,_transparent_70%)]" />
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
        alt={decorative ? "" : name}
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
