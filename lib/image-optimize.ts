import imageCompression from "browser-image-compression";

export interface OptimizedImage {
  file: File;
  originalSize: number;
  optimizedSize: number;
  preview: string;
}

/**
 * Compress a photo in the browser before upload.
 * - Resizes to 2048px on longest edge
 * - Compresses to target ~1MB JPEG
 * - Preserves EXIF orientation
 *
 * Mirrors scripts/optimize_photos.py — runs client-side so the admin
 * never has to touch a terminal.
 */
export async function optimizePhoto(
  file: File,
  opts: { maxSizeMB?: number; maxWidthOrHeight?: number } = {}
): Promise<OptimizedImage> {
  const originalSize = file.size;

  // Tiny or non-image files pass through unchanged
  if (!file.type.startsWith("image/") || file.size < 200 * 1024) {
    return {
      file,
      originalSize,
      optimizedSize: file.size,
      preview: URL.createObjectURL(file),
    };
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: opts.maxSizeMB ?? 1,
    maxWidthOrHeight: opts.maxWidthOrHeight ?? 2048,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  });

  // imageCompression returns a Blob; wrap as File with .jpg extension
  const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
  const optimized = new File([compressed], cleanName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  return {
    file: optimized,
    originalSize,
    optimizedSize: optimized.size,
    preview: URL.createObjectURL(optimized),
  };
}

/**
 * The same compression as optimizePhoto, returning only the file, with no
 * preview URL, so a long upload queue holds nothing it does not need.
 */
export async function compressPhoto(file: File, logo?: HTMLImageElement | null): Promise<File> {
  if (!logo && file.size < 200 * 1024 && file.type === "image/jpeg") return file;
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  });
  const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
  const out = new File([compressed], cleanName, { type: "image/jpeg", lastModified: Date.now() });
  return logo ? brandPhoto(out, logo) : out;
}

/** Load a logo for drawing. Storage URLs need CORS so the canvas stays exportable. */
export function loadLogo(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the logo"));
    img.src = src;
  });
}

/**
 * Where the logo sits: bottom centre, its width a fifth of the photo's
 * shorter side, lifted off the edge by 3% of the height. Pure, so it is tested.
 */
export function logoBox(photoW: number, photoH: number, logoW: number, logoH: number) {
  const w = Math.round(Math.min(photoW, photoH) * 0.2);
  const h = Math.round((w * logoH) / logoW);
  return {
    x: Math.round((photoW - w) / 2),
    y: Math.round(photoH - h - photoH * 0.03),
    w,
    h,
  };
}

/** Draw the logo onto an already compressed JPEG, one canvas, freed after. */
export async function brandPhoto(file: File, logo: HTMLImageElement): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const box = logoBox(canvas.width, canvas.height, logo.naturalWidth, logo.naturalHeight);
  // A soft shadow keeps a white logo readable on a bright photo.
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = Math.max(4, Math.round(box.w * 0.04));
  ctx.drawImage(logo, box.x, box.y, box.w, box.h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9)
  );
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) return file;
  return new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * The halving steps from one width down to a target: halve while the next
 * half is still at least the target, then one last draw at the target. Big
 * single jumps leave jagged edges, halves keep them clean. Pure, so it is tested.
 */
export function downscaleSteps(from: number, to: number): number[] {
  const steps: number[] = [];
  let w = from;
  while (w / 2 >= to) {
    w = Math.round(w / 2);
    steps.push(w);
  }
  if (w !== to) steps.push(to);
  return steps;
}

/**
 * The photo's size and its smaller copies at the given widths, as JPEGs, made
 * on the phone so nothing has to resize a gallery photo later
 * (lib/photo-storage.ts). A width the photo does not exceed gives null, and
 * the server then uses the photo itself. Biggest copy first, each smaller one
 * carries on from the last, and every canvas is freed after.
 */
export async function photoCopies(
  file: Blob,
  widths: number[]
): Promise<{ width: number; height: number; copies: (Blob | null)[] }> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const made = new Map<number, Blob | null>();
  const canvases: HTMLCanvasElement[] = [];

  const draw = (src: CanvasImageSource, w: number) => {
    const c = document.createElement("canvas");
    canvases.push(c);
    c.width = w;
    c.height = Math.max(1, Math.round((height * w) / width));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  };

  try {
    let src: HTMLCanvasElement | ImageBitmap = bitmap;
    let srcW = width;
    for (const target of [...widths].sort((a, b) => b - a)) {
      if (target >= width) {
        made.set(target, null);
        continue;
      }
      for (const w of downscaleSteps(srcW, target)) {
        src = draw(src, w);
        srcW = w;
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        (src as HTMLCanvasElement).toBlob(resolve, "image/jpeg", target <= 600 ? 0.78 : 0.82)
      );
      made.set(target, blob);
    }
  } finally {
    bitmap.close();
    for (const c of canvases) {
      c.width = 0;
      c.height = 0;
    }
  }
  return { width, height, copies: widths.map((w) => made.get(w) ?? null) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
