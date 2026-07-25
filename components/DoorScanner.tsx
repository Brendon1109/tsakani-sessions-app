"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, Flashlight, FlashlightOff } from "lucide-react";

/**
 * The camera half of the door screen.
 *
 * Two decoders, because there is no single one that works on the phones the
 * team actually has. Chrome on Android ships BarcodeDetector, which is hardware
 * accelerated and reads a code across a dark room. Safari does not implement it
 * at all, so every iPhone falls back to decoding frames in JavaScript via jsQR.
 * The fallback is loaded dynamically so Android never downloads it.
 *
 * Everything here assumes a loud, dark venue and a person who is not looking at
 * the screen: the confirmation is a beep and a buzz, not text.
 */

interface DoorScannerProps {
  onCode: (code: string) => void;
  /** Pauses decoding while a result card is up, without tearing the camera down. */
  paused?: boolean;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/** Same code re-read while the phone is still in frame is not a second guest. */
const REPEAT_SUPPRESSION_MS = 3500;

export default function DoorScanner({ onCode, paused = false }: DoorScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  // Read inside the animation loop, which closes over its first render.
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  /** A scan you can feel and hear, because nobody is watching the screen. */
  const feedback = useCallback(() => {
    try {
      navigator.vibrate?.(60);
    } catch {
      /* not supported, not important */
    }
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.16;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
      setTimeout(() => ctx.close().catch(() => {}), 400);
    } catch {
      /* audio is a nicety; a blocked AudioContext must not stop the door */
    }
  }, []);

  const handleCode = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const now = Date.now();
      const last = lastCodeRef.current;
      if (last.code === code && now - last.at < REPEAT_SUPPRESSION_MS) return;
      lastCodeRef.current = { code, at: now };
      feedback();
      onCodeRef.current(code);
    },
    [feedback]
  );

  useEffect(() => {
    let cancelled = false;
    let detector: BarcodeDetectorLike | null = null;
    let jsQR: typeof import("jsqr").default | null = null;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // ideal, not exact: a laptop with only a front camera should still
          // scan rather than throwing OverconstrainedError and showing nothing.
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        // Both are required for iOS Safari to play inline instead of taking
        // over the screen with the native fullscreen player.
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play().catch(() => {});

        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        if (caps?.torch) setCanTorch(true);

        const Detector = (
          window as unknown as {
            BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike;
          }
        ).BarcodeDetector;
        if (Detector) {
          detector = new Detector({ formats: ["qr_code"] });
        } else {
          jsQR = (await import("jsqr")).default;
        }

        if (!cancelled) {
          setReady(true);
          tick();
        }
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera blocked. Tap the padlock in the address bar, allow Camera, then reload."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Could not start the camera. You can still search by name below."
        );
      }
    }

    async function tick() {
      if (cancelled) return;
      const video = videoRef.current;

      if (video && video.readyState >= 2 && !pausedRef.current) {
        try {
          if (detector) {
            const hits = await detector.detect(video);
            if (hits[0]?.rawValue) handleCode(hits[0].rawValue);
          } else if (jsQR) {
            // Downscale before decoding. jsQR is pure JS and cost scales with
            // pixel count; a full 1280px frame drops an older iPhone to a few
            // frames a second, which feels broken when someone is waiting.
            const canvas = (canvasRef.current ||= document.createElement("canvas"));
            const scale = Math.min(1, 480 / (video.videoWidth || 480));
            const w = Math.round((video.videoWidth || 0) * scale);
            const h = Math.round((video.videoHeight || 0) * scale);
            if (w && h) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                // attemptBoth, not dontInvert. Belt and braces alongside the
                // dark-on-light fix in lib/qr-colors.ts: tickets already in
                // people's inboxes and screenshots were rendered inverted, and
                // those have to keep working. Doubles the decode cost of a
                // frame that finds nothing, which is worth it — a scanner that
                // silently cannot read a valid ticket is the expensive failure.
                const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
                  inversionAttempts: "attemptBoth",
                });
                if (hit?.data) handleCode(hit.data);
              }
            }
          }
        } catch {
          // A single bad frame is normal — mid-resize, backgrounded tab. Keep going.
        }
      }

      rafRef.current = requestAnimationFrame(() => void tick());
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [handleCode]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setCanTorch(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-center">
        <CameraOff size={26} className="text-red-300 mx-auto mb-3" />
        <p className="text-sm text-red-200 leading-relaxed">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="w-full h-full object-cover"
      />

      {/* Where to aim. The cutout is the only instruction most people need. */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div
          className={`w-56 h-56 rounded-2xl border-4 transition-colors ${
            paused ? "border-white/30" : "border-gold-500/90"
          }`}
          style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
        />
      </div>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          Starting camera…
        </div>
      )}

      {ready && (
        <p className="absolute bottom-3 inset-x-0 text-center text-white/70 text-xs px-4">
          {paused ? "Paused — clear the result to keep scanning" : "Point at the guest's QR code"}
        </p>
      )}

      {canTorch && (
        <button
          type="button"
          onClick={toggleTorch}
          className="absolute top-3 right-3 bg-black/60 text-white rounded-full p-2.5 backdrop-blur"
          aria-label={torchOn ? "Turn torch off" : "Turn torch on"}
        >
          {torchOn ? <Flashlight size={18} /> : <FlashlightOff size={18} />}
        </button>
      )}
    </div>
  );
}
