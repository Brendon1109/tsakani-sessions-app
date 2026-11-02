/**
 * The order a gallery shows its photos in: an admin's sort_order first, then
 * when the camera took the photo, then when it was uploaded. Shots from the
 * same moment sit together instead of in whatever order the uploads finished.
 *
 * Sorted here rather than in SQL so a database without the taken_at column
 * (see supabase/photo_taken_at.sql) still works, it just falls back to upload
 * order. A photo with no capture time goes after the timed ones.
 */
export interface OrderablePhoto {
  sort_order?: number | null;
  taken_at?: string | null;
  created_at?: string | null;
}

const time = (v?: string | null) => {
  const t = v ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? Infinity : t;
};

export function comparePhotos(a: OrderablePhoto, b: OrderablePhoto): number {
  return (
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    // Infinity minus Infinity is NaN, which || skips, so untimed pairs fall
    // through to upload time.
    time(a.taken_at) - time(b.taken_at) ||
    time(a.created_at) - time(b.created_at) ||
    0
  );
}

export function sortPhotos<T extends OrderablePhoto>(photos: T[]): T[] {
  return [...photos].sort(comparePhotos);
}

/**
 * A capture time worth keeping: a real date, after 2000 and not more than a
 * day in the future (a phone with a wrong clock or zone). Returns ISO or null.
 */
export function cleanTakenAt(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  if (t < Date.UTC(2000, 0, 1) || t > Date.now() + 24 * 3600 * 1000) return null;
  return new Date(t).toISOString();
}
