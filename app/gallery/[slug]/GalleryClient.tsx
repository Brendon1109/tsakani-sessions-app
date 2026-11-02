"use client";

import { useState } from "react";
import Image from "next/image";
import { Share2, QrCode, ArrowLeft, CheckSquare, Check, X } from "lucide-react";
import Link from "next/link";
import Lightbox from "@/components/Lightbox";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import SavePhotosButton from "@/components/SavePhotosButton";
import { MAX_SAVE, photoFileName } from "@/lib/photo-download";

interface GalleryClientProps {
  slug: string;
  title: string;
  description: string | null;
  date: string | null;
  photos: { url: string; caption?: string }[];
}

export default function GalleryClient({
  slug,
  title,
  description,
  date,
  photos,
}: GalleryClientProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const atLimit = selected.length >= MAX_SAVE;

  function toggle(index: number) {
    setSelected((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : prev.length >= MAX_SAVE
          ? prev
          : [...prev, index]
    );
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected([]);
  }

  const selectedPhotos = () =>
    [...selected]
      .sort((a, b) => a - b)
      .map((i) => ({ url: photos[i].url, name: photoFileName(title, i) }));

  const galleryUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://tsakanisessions.co.za/gallery/${slug}`;

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: title,
        text: `Check out photos from ${title}`,
        url: galleryUrl,
      });
    } else {
      await navigator.clipboard.writeText(galleryUrl);
    }
  };

  return (
    <div>
      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/gallery"
            className="text-gray-400 hover:text-gold-500 text-sm flex items-center gap-1 mb-6 transition-colors"
          >
            <ArrowLeft size={16} />
            All Galleries
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">{title}</h1>
              <p className="text-gray-400">
                {date && `${date} · `}
                {photos.length} photos
              </p>
              {description && (
                <p className="text-gray-500 text-sm mt-2">{description}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {photos.length > 0 && (
                <button
                  onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                  className="flex items-center gap-2 border border-white/10 text-gray-300 hover:text-gold-500 hover:border-gold-500/30 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {selecting ? <X size={16} /> : <CheckSquare size={16} />}
                  {selecting ? "Cancel" : "Select to save"}
                </button>
              )}
              <button
                onClick={() => setShowQR(!showQR)}
                className="flex items-center gap-2 border border-white/10 text-gray-300 hover:text-gold-500 hover:border-gold-500/30 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <QrCode size={16} />
                QR Code
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 bg-gold-gradient text-black font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity"
              >
                <Share2 size={16} />
                Share
              </button>
            </div>
          </div>

          {showQR && (
            <div className="mb-8 bg-dark-500 border border-white/10 rounded-2xl p-6 w-fit">
              <QRCodeDisplay
                url={galleryUrl}
                size={180}
                label="Scan to view this gallery"
              />
            </div>
          )}
        </div>
      </section>

      <section className="pb-24 px-4">
        <div className="max-w-7xl mx-auto">
          {photos.length === 0 ? (
            <div className="text-center py-16 bg-dark-500 rounded-2xl border border-white/10">
              <p className="text-gray-400 text-lg mb-2">
                No photos yet for this event.
              </p>
              <p className="text-gray-500 text-sm">
                Photos will be uploaded after the event.
              </p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
              {photos.map((photo, index) => {
                const on = selected.includes(index);
                return (
                <button
                  key={index}
                  onClick={() => (selecting ? toggle(index) : setLightboxIndex(index))}
                  aria-pressed={selecting ? on : undefined}
                  aria-label={selecting ? `Select photo ${index + 1}` : `Open photo ${index + 1}`}
                  className={`relative block w-full break-inside-avoid rounded-xl overflow-hidden border-2 transition-colors group ${
                    on ? "border-gold-500" : "border-white/5 hover:border-gold-500/30"
                  }`}
                >
                  {selecting && (
                    <span
                      className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                        on ? "bg-gold-500 border-gold-500 text-black" : "bg-black/40 border-white/70"
                      }`}
                    >
                      {on && <Check size={16} />}
                    </span>
                  )}
                  <Image
                    src={photo.url}
                    alt={photo.caption || `Photo ${index + 1}`}
                    width={400}
                    height={300}
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selecting && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-dark-500/95 backdrop-blur border-t border-white/10 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <p className="text-sm text-gray-300">
              {selected.length === 0
                ? "Tap the photos you want"
                : `${selected.length} selected${atLimit ? `, ${MAX_SAVE} at a time` : ""}`}
            </p>
            {selected.length > 0 && (
              <SavePhotosButton
                photos={selectedPhotos}
                zipName={`${photoFileName(title, 0).replace(/-001\.jpg$/, "")}.zip`}
                label={`Save ${selected.length}`}
                className="bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-lg inline-flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              />
            )}
          </div>
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          fileBase={title}
          images={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
