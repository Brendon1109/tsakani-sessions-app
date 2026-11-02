import exifr from "exifr";

const HEAD = 512 * 1024;

async function dateFrom(bytes: ArrayBuffer): Promise<string | null> {
  const tags = await exifr.parse(bytes, ["DateTimeOriginal", "CreateDate"]);
  const when: unknown = tags?.DateTimeOriginal ?? tags?.CreateDate;
  return when instanceof Date && !Number.isNaN(when.getTime()) ? when.toISOString() : null;
}

/**
 * When the camera took this photo, from EXIF DateTimeOriginal, as ISO. Read
 * from the original file before compression strips it. Works for iPhone HEIC
 * and JPEG. Null when the photo carries no capture time (a screenshot, a
 * photo already saved through an editor that dropped it) or cannot be read.
 *
 * Reads the first 512 KB as bytes, where JPEG keeps its EXIF, and only reads
 * the whole file when that finds nothing in a HEIC, whose metadata can sit
 * further in. One photo at a time, so a big HEIC is still light.
 */
export async function readTakenAt(file: File): Promise<string | null> {
  try {
    const head = await dateFrom(await file.slice(0, HEAD).arrayBuffer());
    if (head || file.size <= HEAD || !/heic|heif/i.test(file.type + file.name)) return head;
    return await dateFrom(await file.arrayBuffer());
  } catch {
    return null;
  }
}
