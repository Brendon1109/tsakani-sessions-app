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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
