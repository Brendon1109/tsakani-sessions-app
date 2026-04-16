"use client";

import { useState, useEffect, useCallback } from "react";
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
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, goNext, goPrev]);

  const current = images[currentIndex];

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center">
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white/70 hover:text-white p-2 transition-colors"
        aria-label="Close"
      >
        <X size={28} />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 text-white/50 text-sm">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Download */}
      <a
        href={current.url}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-16 z-10 text-white/70 hover:text-white p-2 transition-colors"
        aria-label="Download"
      >
        <Download size={22} />
      </a>

      {/* Navigation */}
      {images.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 sm:left-4 z-10 text-white/50 hover:text-white p-2 bg-black/30 rounded-full transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 sm:right-4 z-10 text-white/50 hover:text-white p-2 bg-black/30 rounded-full transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      {/* Image */}
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

      {/* Caption */}
      {current.caption && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/50 px-4 py-2 rounded-lg">
          {current.caption}
        </div>
      )}
    </div>
  );
}
