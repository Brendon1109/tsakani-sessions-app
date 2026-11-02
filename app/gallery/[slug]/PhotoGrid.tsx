"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

export type GalleryView = "large" | "rows" | "compact";

/** Biggest to smallest, the order a pinch walks through. */
export const VIEWS: GalleryView[] = ["large", "rows", "compact"];

/**
 * One photo's addresses, from lib/photo-storage.ts. Plain <img> with a
 * srcset rather than next/image: the photos on R2 already come in the sizes
 * the grid needs, straight from photos.tsakanisessions.co.za, so the Worker
 * never sees a gallery photo.
 */
export interface GridPhoto {
  src: string;
  srcSet: string;
  bigSrcSet: string;
  download: string;
  caption?: string;
  /** width / height, when the upload recorded it. */
  ratio?: number;
}

/** Row heights in Rows view, matching --row-h below: phone, sm and lg. */
const ROW_H = [110, 170, 220];

/**
 * How wide a Rows tile shows, for the browser to pick a copy. A tile grows
 * past its basis to fill the row, hence the quarter on top.
 */
export function rowSizes(ratio: number): string {
  const [phone, tablet, desktop] = ROW_H.map((h) => Math.ceil(ratio * h * 1.25));
  return `(max-width: 639px) ${phone}px, (max-width: 1023px) ${tablet}px, ${desktop}px`;
}

interface Props {
  photos: GridPhoto[];
  view: GalleryView;
  onViewChange: (v: GalleryView) => void;
  selecting: boolean;
  selected: number[];
  onTap: (index: number) => void;
}

/** A pinch has to change the finger gap by this much to count. */
const PINCH = 1.25;

export function nextView(view: GalleryView, scale: number): GalleryView {
  const i = VIEWS.indexOf(view);
  if (scale >= PINCH) return VIEWS[Math.max(0, i - 1)];
  if (scale <= 1 / PINCH) return VIEWS[Math.min(VIEWS.length - 1, i + 1)];
  return view;
}

export default function PhotoGrid({ photos, view, onViewChange, selecting, selected, onTap }: Props) {
  // Shapes measured in the browser for photos uploaded before sizes were
  // recorded. Until a photo loads it is laid out as a portrait, the common case.
  const [measured, setMeasured] = useState<Record<number, number>>({});
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Pinch to change view, like the Lightroom grid: fingers apart for bigger
  // photos, together for more of them. Two finger moves are kept from zooming
  // the page; one finger still scrolls.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start = 0;
    let last = 0;
    const gap = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) start = last = gap(e.touches);
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && start) {
        e.preventDefault();
        last = gap(e.touches);
      }
    };
    const onEnd = () => {
      if (!start) return;
      const next = nextView(viewRef.current, last / start);
      start = 0;
      if (next !== viewRef.current) onViewChange(next);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [onViewChange]);

  const ratioOf = (i: number) => photos[i].ratio || measured[i] || 2 / 3;

  const remember = (i: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (photos[i].ratio || measured[i]) return;
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setMeasured((m) => ({ ...m, [i]: img.naturalWidth / img.naturalHeight }));
    }
  };

  const tick = (on: boolean, small: boolean) =>
    selecting && (
      <span
        className={`pointer-events-none absolute z-10 rounded-full flex items-center justify-center border-2 ${
          small ? "top-1 right-1 w-5 h-5" : "top-2 right-2 w-7 h-7"
        } ${on ? "bg-gold-500 border-gold-500 text-black" : "bg-black/40 border-white/70"}`}
      >
        {on && <Check size={small ? 12 : 16} />}
      </span>
    );

  const tileProps = (index: number) => {
    const on = selected.includes(index);
    return {
      on,
      button: {
        onClick: () => onTap(index),
        "aria-pressed": selecting ? on : undefined,
        "aria-label": selecting ? `Select photo ${index + 1}` : `Open photo ${index + 1}`,
      },
    };
  };

  const alt = (i: number) => photos[i].caption || `Photo ${i + 1}`;

  return (
    <div ref={ref} style={{ touchAction: "pan-y" }}>
      {view === "large" && (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {photos.map((photo, index) => {
            const { on, button } = tileProps(index);
            return (
              <button
                key={index}
                {...button}
                className={`relative block w-full break-inside-avoid rounded-xl overflow-hidden border-2 transition-colors group ${
                  on ? "border-gold-500" : "border-white/5 hover:border-gold-500/30"
                }`}
              >
                {tick(on, false)}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  srcSet={photo.srcSet}
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 34vw, 25vw"
                  alt={alt(index)}
                  width={600}
                  height={Math.round(600 / ratioOf(index))}
                  loading="lazy"
                  decoding="async"
                  onLoad={remember(index)}
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </button>
            );
          })}
        </div>
      )}

      {view === "rows" && (
        // Justified rows: each photo keeps its shape, every row fills the
        // width, the way Lightroom lays out a grid.
        <div className="flex flex-wrap gap-[3px] [--row-h:110px] sm:[--row-h:170px] lg:[--row-h:220px] after:content-[''] after:grow-[999]">
          {photos.map((photo, index) => {
            const { on, button } = tileProps(index);
            const r = ratioOf(index);
            return (
              <button
                key={index}
                {...button}
                className={`relative overflow-hidden outline-none ${on ? "ring-2 ring-gold-500 ring-inset" : ""}`}
                style={{ flexGrow: r * 100, flexBasis: `calc(${r} * var(--row-h))` }}
              >
                <span className="block" style={{ paddingBottom: `${100 / r}%` }} />
                {tick(on, true)}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  srcSet={photo.srcSet}
                  sizes={rowSizes(r)}
                  alt={alt(index)}
                  loading="lazy"
                  decoding="async"
                  onLoad={remember(index)}
                  className={`absolute inset-0 w-full h-full object-cover ${on ? "opacity-80" : ""}`}
                />
              </button>
            );
          })}
        </div>
      )}

      {view === "compact" && (
        <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-12 gap-[2px]">
          {photos.map((photo, index) => {
            const { on, button } = tileProps(index);
            return (
              <button
                key={index}
                {...button}
                className={`relative aspect-square overflow-hidden outline-none ${on ? "ring-2 ring-gold-500 ring-inset" : ""}`}
              >
                {tick(on, true)}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  srcSet={photo.srcSet}
                  sizes="(max-width: 639px) 20vw, (max-width: 1023px) 13vw, 9vw"
                  alt={alt(index)}
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-cover ${on ? "opacity-80" : ""}`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
