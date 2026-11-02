"use client";

import { useCallback, useEffect, useState } from "react";
import { Share2, QrCode, ArrowLeft, CheckSquare, X, Square, Rows3, Grid3x3 } from "lucide-react";
import Link from "next/link";
import Lightbox from "@/components/Lightbox";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import SavePhotosButton from "@/components/SavePhotosButton";
import { MAX_SAVE, photoFileName } from "@/lib/photo-download";
import PhotoGrid, { VIEWS, type GalleryView, type GridPhoto } from "./PhotoGrid";
import FindMe from "./FindMe";

const VIEW_KEY = "tsakani-gallery-view";

const VIEW_META: Record<GalleryView, { label: string; Icon: typeof Square }> = {
  large: { label: "Large", Icon: Square },
  rows: { label: "Rows", Icon: Rows3 },
  compact: { label: "Compact", Icon: Grid3x3 },
};

interface GalleryClientProps {
  slug: string;
  title: string;
  description: string | null;
  date: string | null;
  photos: (GridPhoto & { findMeExcluded?: boolean })[];
  /** Admin switched Find me on for this gallery. */
  findMe?: boolean;
}

export default function GalleryClient({
  slug,
  title,
  description,
  date,
  photos,
  findMe = false,
}: GalleryClientProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const atLimit = selected.length >= MAX_SAVE;
  const [view, setView] = useState<GalleryView>("rows");
  // Find me results: indexes into photos, in memory only, gone on reload.
  const [matches, setMatches] = useState<number[] | null>(null);
  const shownIdx = matches ?? photos.map((_, i) => i);
  const shown = shownIdx.map((i) => photos[i]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY) as GalleryView | null;
      if (saved && VIEWS.includes(saved)) setView(saved);
    } catch {}
  }, []);

  const changeView = useCallback((v: GalleryView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  }, []);

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
              {findMe && photos.length > 0 && (
                <FindMe
                  photos={photos.map((p) => ({ url: p.url, skip: p.findMeExcluded }))}
                  onFound={(found) => {
                    setMatches(found);
                    setSelected([]);
                  }}
                />
              )}
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

          {findMe && (
            <p className="text-xs text-gray-500 mb-6 -mt-4">
              Guests can find their own photos here with face recognition on their own phones. Don&rsquo;t want
              that for a photo of you?{" "}
              <a href="/privacy#find-my-photos" className="text-gold-500 hover:text-gold-400 underline">
                Tell us
              </a>
              .
            </p>
          )}

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
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div role="radiogroup" aria-label="Photo view" className="inline-flex rounded-lg border border-white/10 p-0.5">
                  {VIEWS.map((v) => {
                    const { label, Icon } = VIEW_META[v];
                    return (
                      <button
                        key={v}
                        role="radio"
                        aria-checked={view === v}
                        onClick={() => changeView(v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                          view === v ? "bg-gold-500 text-black font-semibold" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-500 sm:hidden">Pinch to change</p>
              </div>
              {matches && (
                <div className="mb-4 bg-gold-500/10 border border-gold-500/30 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    {matches.length === 0
                      ? "We did not spot you this time. Scroll the full gallery, Find me misses photos."
                      : `Found you in ${matches.length} photo${matches.length === 1 ? "" : "s"}. Tap Select to save them.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMatches(null);
                      setSelected([]);
                    }}
                    className="text-sm text-gold-500 hover:text-gold-400 underline"
                  >
                    Show all photos
                  </button>
                </div>
              )}
              <PhotoGrid
                photos={shown}
                view={view}
                onViewChange={changeView}
                selecting={selecting}
                selected={selected.map((i) => shownIdx.indexOf(i)).filter((k) => k >= 0)}
                onTap={(k) => (selecting ? toggle(shownIdx[k]) : setLightboxIndex(k))}
              />
            </>
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
          images={shown}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
