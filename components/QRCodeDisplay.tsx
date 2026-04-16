"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  url: string;
  size?: number;
  label?: string;
}

export default function QRCodeDisplay({
  url,
  size = 200,
  label,
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
      <p className="text-gray-500 text-xs text-center break-all max-w-[200px]">
        {url}
      </p>
    </div>
  );
}
