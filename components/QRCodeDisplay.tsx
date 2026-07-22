"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

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
        margin: 2,
        color: {
          dark: "#ffd700",
          light: "#111111",
        },
      });
    }
  }, [url, size]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="rounded-xl" />
      {label && <p className="text-gray-400 text-sm text-center">{label}</p>}
      {showUrl && (
        <p className="text-gray-500 text-xs text-center break-all max-w-[200px]">
          {url}
        </p>
      )}
    </div>
  );
}
