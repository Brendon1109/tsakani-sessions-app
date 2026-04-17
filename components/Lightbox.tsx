"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface LightboxProps {
  images: { url: string; caption?: string }[];
  initialIndex: number;
  onClose: () => void;
}

export default function Lightbox({
  images,
  initialIndex,
  onClose,
}: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };

    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goNext, goPrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    // Only swipe if horizontal movement is dominant and > 50px
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx > 0) goPrev();
      else goNext();
    }

    // Vertical swipe down to close
    if (dy > 100 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const current = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white/70 hover:text-white p-2 transition-colors"
        aria-label="Close photo viewer"
      >
        <X size={28} />
      </button>

      <div
        className="absolute top-4 left-4 text-white/50 text-sm"
        aria-live="polite"
      >
        {currentIndex + 1} / {images.length}
      </div>

      <a
        href={current.url}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-16 z-10 text-white/70 hover:text-white p-2 transition-colors"
        aria-label="Download photo"
      >
        <Download size={22} />
      </a>

      {images.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 sm:left-4 z-10 text-white/50 hover:text-white p-2 bg-black/30 rounded-full transition-colors"
            aria-label="Previous photo"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 sm:right-4 z-10 text-white/50 hover:text-white p-2 bg-black/30 rounded-full transition-colors"
            aria-label="Next photo"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-12">
        <Image
          src={current.url}
          alt={current.caption || `Photo ${currentIndex + 1}`}
          fill
          className="object-contain"
          sizes="100vw"
          priority
        />
      </div>

      {current.caption && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/50 px-4 py-2 rounded-lg max-w-[90%] text-center">
          {current.caption}
        </div>
      )}

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/30 text-xs sm:hidden">
        Swipe to navigate
      </div>
    </div>
  );
}
