/**
 * Find me: match a guest's selfie against one gallery, entirely in their
 * browser.
 *
 * The rules this file keeps, from legal/tsakani-find-my-photos-popia-2026-11-02.md
 * in Breazy, are tested in __tests__/findMe.test.ts:
 *  - The model is served from this site, /models/face-api, never a CDN.
 *  - Nothing is sent anywhere. This module only GETs the model and the
 *    gallery's own photos, and never POSTs or PUTs.
 *  - Face scans live in memory only, for one search, and are never cached:
 *    no storage, no IndexedDB, no service worker.
 *  - One gallery at a time. The caller passes one gallery's photos.
 */

import type * as FaceApi from "@vladmandic/face-api";

export const MODEL_URL = "/models/face-api";

/**
 * Two faces closer than this count as the same person. face-api's usual line
 * is 0.6, far too loose for a dark party crowd in costume. Measured on 30
 * real Halloween photos on 2 November 2026: true pairs sat at 0.36 to 0.42,
 * the first stranger pair at 0.417 (hats and sunglasses), the next at 0.462.
 */
export const MATCH_DISTANCE = 0.45;

/**
 * Gallery faces weaker or smaller than this are skipped. Blurred and half
 * hidden background faces gave scans that sat close to everyone (0.34 to
 * 0.47 against unrelated people in the same test), so they only added
 * strangers to the results.
 */
export const MIN_FACE_SCORE = 0.6;
export const MIN_FACE_WIDTH = 40; // pixels, at SCAN_WIDTH

/** Width each gallery photo is scanned at, through the site's own resizer. */
export const SCAN_WIDTH = 640;

let loading: Promise<typeof FaceApi> | null = null;

/** Load the library and its three models once per page. Only after consent. */
export function loadFaceApi(): Promise<typeof FaceApi> {
  if (!loading) {
    loading = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      // WebGL runs on the device's GPU and needs no extra download. The CPU
      // backend is the slow fallback. Neither fetches anything from a CDN.
      // The bundled tf is typed narrowly; these two exist at runtime.
      const tf = faceapi.tf as unknown as {
        setBackend(name: string): Promise<boolean>;
        ready(): Promise<void>;
      };
      await tf.setBackend("webgl").catch(() => tf.setBackend("cpu"));
      await tf.ready();
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return faceapi;
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

export function distance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Does any face in a photo match the selfie? */
export function photoMatches(selfie: ArrayLike<number>, faces: ArrayLike<number>[]): boolean {
  return faces.some((f) => distance(selfie, f) < MATCH_DISTANCE);
}

/** The site's own resized copy of a storage photo, same origin, so the canvas stays readable. */
export function scanUrl(url: string): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=${SCAN_WIDTH}&q=75`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("photo did not load"));
    img.src = src;
  });
}

/**
 * The selfie's face scan, or null when there is not exactly one clear face.
 * The largest face wins if a friend leans into the shot.
 */
export async function selfieDescriptor(
  faceapi: typeof FaceApi,
  source: HTMLCanvasElement | HTMLImageElement
): Promise<Float32Array | null> {
  const found = await faceapi
    .detectAllFaces(source, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (found.length === 0) return null;
  const biggest = found.reduce((a, b) =>
    a.detection.box.area >= b.detection.box.area ? a : b
  );
  return biggest.descriptor;
}

/**
 * Scan one gallery and return the indexes of the photos the selfie is in.
 * Photos are scanned one at a time and dropped straight after, so memory
 * stays flat and no face scan outlives this call.
 */
export async function findInGallery(
  faceapi: typeof FaceApi,
  selfie: Float32Array,
  photos: { url: string; skip?: boolean }[],
  onProgress: (done: number, total: number) => void,
  signal: { cancelled: boolean }
): Promise<number[]> {
  const matches: number[] = [];
  const todo = photos.map((p, i) => ({ ...p, i })).filter((p) => !p.skip);
  let done = 0;
  for (const p of todo) {
    if (signal.cancelled) break;
    try {
      const img = await loadImage(scanUrl(p.url));
      const faces = await faceapi
        .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_FACE_SCORE }))
        .withFaceLandmarks()
        .withFaceDescriptors();
      const clear = faces.filter((f) => f.detection.box.width >= MIN_FACE_WIDTH);
      if (photoMatches(selfie, clear.map((f) => f.descriptor))) matches.push(p.i);
      img.src = "";
    } catch {
      // A photo that will not load is just not a match.
    }
    onProgress(++done, todo.length);
  }
  return matches;
}
