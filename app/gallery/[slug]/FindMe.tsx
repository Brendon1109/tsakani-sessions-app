"use client";

import { useEffect, useRef, useState } from "react";
import { ScanFace, Loader2, Camera, ImageIcon, X } from "lucide-react";
import { track } from "@/lib/analytics";
import { findInGallery, loadFaceApi, selfieDescriptor } from "@/lib/find-me";

/**
 * Find me, the consent sheet, the selfie and the scan.
 *
 * The sheet's words are `find-me-consent-v1` from
 * legal/tsakani-find-my-photos-popia-2026-11-02.md in Breazy. Changing a
 * sentence is a new version and goes back to the lawyer first, never an edit
 * in place. The rules it keeps:
 *  - Nothing happens before "I agree, find me": no model download, no camera
 *    prompt. Agreement is asked every time and remembered nowhere.
 *  - "Not now" is the same size as "I agree" and leaves the gallery as it was.
 *  - Camera first. Picking a photo from the library sits behind a second tap.
 *  - The camera stops as soon as the selfie is taken. The selfie and every
 *    face scan stay in memory and are dropped when the sheet closes.
 *  - One anonymous count, find_me_used, with no props.
 */

export const CONSENT_VERSION = "find-me-consent-v1";
export const CONSENT = {
  heading: "Find your photos",
  body:
    "We use face recognition on this device to spot you in this gallery. Your selfie and face scan stay on this device, never reach us, and are gone when you close the page. It can miss photos, so the full gallery stays here. Only use your own face, and only if you’re 18 or over.",
  link: "How it works",
  agree: "I agree, find me",
  cancel: "Not now",
};

type Step = "consent" | "camera" | "scanning" | "error";

interface Props {
  photos: { url: string; skip?: boolean }[];
  onFound: (indexes: number[]) => void;
}

export default function FindMe({ photos, onFound }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("consent");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [phase, setPhase] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef({ cancelled: false });

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function close() {
    cancelRef.current.cancelled = true;
    stopCamera();
    setOpen(false);
    setStep("consent");
    setMessage("");
  }

  useEffect(() => () => stopCamera(), []);

  async function agree() {
    track("find_me_used");
    cancelRef.current = { cancelled: false };
    setStep("camera");
    // Start the model download while the guest lines up the selfie.
    loadFaceApi().catch(() => {});
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setMessage("The camera did not open. Allow camera access, or use a photo of yourself instead.");
    }
  }

  async function run(source: HTMLCanvasElement | HTMLImageElement) {
    setStep("scanning");
    setPhase("Getting ready, about 12 MB the first time");
    setProgress([0, 0]);
    try {
      const faceapi = await loadFaceApi();
      if (cancelRef.current.cancelled) return;
      setPhase("Reading your selfie");
      const selfie = await selfieDescriptor(faceapi, source);
      if (!selfie) {
        setStep("error");
        setMessage("We could not see a face clearly. Try again facing the camera in good light.");
        return;
      }
      setPhase("Looking through the gallery");
      const found = await findInGallery(
        faceapi,
        selfie,
        photos,
        (done, total) => setProgress([done, total]),
        cancelRef.current
      );
      if (cancelRef.current.cancelled) return;
      onFound(found);
      close();
    } catch (err) {
      console.error("Find me failed:", err);
      setStep("error");
      setMessage("Find me could not run on this device. The full gallery is still here.");
    }
  }

  function takeSelfie() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopCamera();
    run(canvas);
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    stopCamera();
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      await run(img);
    } finally {
      URL.revokeObjectURL(url);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const [done, total] = progress;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 border border-gold-500/40 text-gold-500 hover:bg-gold-500/10 px-4 py-2 rounded-lg text-sm transition-colors"
      >
        <ScanFace size={16} />
        Find me
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="find-me-heading"
        >
          <div className="w-full max-w-md bg-dark-500 border border-white/10 rounded-2xl p-6 relative">
            {step !== "consent" && (
              <button
                type="button"
                onClick={close}
                className="absolute top-3 right-3 text-gray-400 hover:text-white p-1"
                aria-label="Close Find me"
              >
                <X size={20} />
              </button>
            )}

            {step === "consent" && (
              <div data-consent-version={CONSENT_VERSION}>
                <h2 id="find-me-heading" className="text-xl font-bold mb-3">
                  {CONSENT.heading}
                </h2>
                <p className="text-sm text-gray-300 leading-relaxed">{CONSENT.body}</p>
                <a
                  href="/privacy#find-my-photos"
                  target="_blank"
                  rel="noopener"
                  className="inline-block mt-2 text-xs text-gold-500 hover:text-gold-400 underline"
                >
                  {CONSENT.link}
                </a>
                <p className="text-[11px] text-gray-500 mt-2">Uses mobile data, about 12 MB plus the gallery.</p>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    type="button"
                    onClick={close}
                    className="border border-white/20 text-white font-semibold py-3 rounded-lg text-sm hover:bg-white/5"
                  >
                    {CONSENT.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={agree}
                    className="border border-gold-500 bg-gold-500/10 text-gold-500 font-semibold py-3 rounded-lg text-sm hover:bg-gold-500/20"
                  >
                    {CONSENT.agree}
                  </button>
                </div>
              </div>
            )}

            {step === "camera" && (
              <div>
                <h2 id="find-me-heading" className="text-lg font-bold mb-3">
                  Take a selfie
                </h2>
                <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                </div>
                {message && <p className="text-xs text-amber-400 mt-3">{message}</p>}
                <button
                  type="button"
                  onClick={takeSelfie}
                  disabled={!!message}
                  className="mt-4 w-full bg-gold-gradient text-black font-semibold py-3 rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Camera size={18} />
                  Take selfie
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-3 w-full text-xs text-gray-400 hover:text-white inline-flex items-center justify-center gap-1.5"
                >
                  <ImageIcon size={14} />
                  Use a photo of yourself instead
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickPhoto(e.target.files?.[0])}
                />
              </div>
            )}

            {step === "scanning" && (
              <div className="text-center py-4">
                <Loader2 size={32} className="text-gold-500 animate-spin mx-auto mb-4" />
                <p className="font-semibold">{phase}</p>
                {total > 0 && (
                  <>
                    <p className="text-sm text-gray-400 mt-1">
                      {done} of {total} photos
                    </p>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden mt-4">
                      <div
                        className="h-full bg-gold-gradient transition-all"
                        style={{ width: `${(done / total) * 100}%` }}
                      />
                    </div>
                  </>
                )}
                <p className="text-[11px] text-gray-500 mt-4">Everything happens on this device.</p>
              </div>
            )}

            {step === "error" && (
              <div className="text-center py-2">
                <p className="text-sm text-gray-300">{message}</p>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    type="button"
                    onClick={close}
                    className="border border-white/20 text-white py-3 rounded-lg text-sm"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMessage("");
                      agree();
                    }}
                    className="border border-gold-500 text-gold-500 font-semibold py-3 rounded-lg text-sm"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
