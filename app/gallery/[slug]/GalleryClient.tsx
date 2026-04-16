"use client";

import { useState } from "react";
import Image from "next/image";
import { Share2, QrCode, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Lightbox from "@/components/Lightbox";
import QRCodeDisplay from "@/components/QRCodeDisplay";

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

  const galleryUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://tsakani-sessions-app.vercel.app/gallery/${slug}`;

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
            <div className="flex items-center gap-3">
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
              {photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => setLightboxIndex(index)}
                  className="block w-full break-inside-avoid rounded-xl overflow-hidden border border-white/5 hover:border-gold-500/30 transition-colors group"
                >
                  <Image
                    src={photo.url}
                    alt={photo.caption || `Photo ${index + 1}`}
                    width={400}
                    height={300}
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {lightboxIndex !== null && (
        <Lightbox
          images={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
