"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { QR_COLORS } from "@/lib/qr-colors";

interface QRCodeDisplayProps {
  url: string;
  size?: number;
  label?: string;
  /**
   * Print the URL as text under the code. Useful for a gallery link someone
   * might want to type out; wrong for a ticket, where the URL is a long
   * unguessable token that should not be sitting in plain view on a phone
   * screen held up in a crowd. Defaults to true so existing callers are
   * unchanged.
   */
  showUrl?: boolean;
}

export default function QRCodeDisplay({
  url,
  size = 200,
  label,
  showUrl = true,
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: size,
        // The quiet zone is part of the symbol, not padding. Decoders use it to
        // find the edges, and the white card below must not crop into it.
        margin: 2,
        // Never restyle these. See lib/qr-colors.ts: gold-on-dark here produced
        // a ticket the door scanner could not read.
        color: { ...QR_COLORS },
      });
    }
  }, [url, size]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* The white card is the styling. The code itself stays untouched, so it
          reads the same on a phone screen as it does printed. */}
      <div className="bg-white rounded-xl p-2 inline-flex">
        <canvas ref={canvasRef} className="block" />
      </div>
      {label && <p className="text-gray-400 text-sm text-center">{label}</p>}
      {showUrl && (
        <p className="text-gray-500 text-xs text-center break-all max-w-[200px]">
          {url}
        </p>
      )}
    </div>
  );
}
