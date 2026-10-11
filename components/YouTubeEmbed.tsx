"use client";

import { useState } from "react";
import Image from "next/image";
import { youtubeEmbedUrl, youtubeThumbnail } from "@/lib/djs";

/**
 * A YouTube video that costs nothing until it is wanted. The thumbnail is
 * served through next/image from this site, and the player, which talks to
 * Google, only loads when the visitor taps play. That keeps the privacy
 * notice true: no third party hears from a visitor who just reads the page.
 */
export default function YouTubeEmbed({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        src={youtubeEmbedUrl(videoId, true)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${title}`}
      className="group absolute inset-0 w-full h-full"
    >
      {/* hqdefault always exists. It is 4:3 with letterbox bars, and a 16:9
          frame with object-cover crops exactly those bars away. */}
      <Image
        src={youtubeThumbnail(videoId, "hqdefault")}
        alt=""
        fill
        sizes="(min-width: 1024px) 1000px, 100vw"
        className="object-cover"
      />
      <span className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="bg-red-600 group-hover:bg-red-700 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
