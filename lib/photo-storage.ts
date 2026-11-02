/**
 * Where gallery photos live, and the addresses the site shows them at.
 *
 * Since 2 November 2026 gallery photos are on Cloudflare R2, bucket
 * `tsakani-photos`, served straight from photos.tsakanisessions.co.za. No
 * Worker and no image resizing sits in the way, so a busy gallery costs the
 * Worker nothing and uses none of the Cloudflare Images allowance. Each photo
 * is three files, made on the uploader's phone (lib/image-optimize.ts) or, for
 * the photos moved from Supabase, by scripts/move-photos-to-r2.mjs:
 *
 *   <storage_path>      the photo, 2048 px on the long edge, about 1 MB
 *   md/<storage_path>   MD_WIDTH wide, for Large view and the lightbox
 *   sm/<storage_path>   SM_WIDTH wide, for Rows, Compact and the admin
 *
 * A row with storage = 'supabase' is still in the Supabase bucket
 * `gallery-photos` and is shown through next/image, the way every photo was
 * before. supabase/photos_on_r2.sql adds the column.
 */

export const PHOTOS_ORIGIN = "https://photos.tsakanisessions.co.za";
export const SM_WIDTH = 480;
export const MD_WIDTH = 1200;
/**
 * An hour, the same as Supabase served photos with. Longer would be cheaper,
 * but nothing purges Cloudflare's cache when a photo is deleted, so this is
 * also how long a taken down photo can still load from a link someone kept.
 * After an hour the edge checks R2 again, a cheap 304 while the photo exists.
 */
export const PHOTO_CACHE_CONTROL = "public, max-age=3600";

export type PhotoStorage = "supabase" | "r2";

export interface StoredPhoto {
  storage_path: string;
  storage?: string | null;
  width?: number | null;
}

export interface PhotoSources {
  /** The small copy, for grids and the admin. */
  src: string;
  /** srcset for grids: the small and the medium copy. */
  srcSet: string;
  /** srcset for the lightbox, which may also take the full photo. */
  bigSrcSet: string;
  /** The full photo, to open on its own. */
  full: string;
  /** Where Save fetches the full photo from, with CORS. */
  download: string;
}

export function isOnR2(photo: Pick<StoredPhoto, "storage">): boolean {
  return photo.storage === "r2";
}

/** The three R2 keys of one photo. */
export function photoKeys(storagePath: string): string[] {
  return [storagePath, `md/${storagePath}`, `sm/${storagePath}`];
}

function r2Url(key: string): string {
  return `${PHOTOS_ORIGIN}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function nextImage(url: string, w: number): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=75`;
}

/**
 * Every address a photo is shown at. `legacyUrl` gives the Supabase public
 * address, only asked for when the photo has not moved to R2.
 */
export function photoSources(photo: StoredPhoto, legacyUrl: () => string): PhotoSources {
  if (isOnR2(photo)) {
    const full = r2Url(photo.storage_path);
    const md = r2Url(`md/${photo.storage_path}`);
    const sm = r2Url(`sm/${photo.storage_path}`);
    const fullW = photo.width && photo.width > MD_WIDTH ? photo.width : 2048;
    return {
      src: sm,
      srcSet: `${sm} ${SM_WIDTH}w, ${md} ${MD_WIDTH}w`,
      bigSrcSet: `${sm} ${SM_WIDTH}w, ${md} ${MD_WIDTH}w, ${full} ${fullW}w`,
      full,
      // Its own address, because R2 sends no Vary: Origin. Without it the
      // browser could answer Save's CORS fetch with the copy it cached while
      // showing the photo, which has no CORS header, and Save would fail.
      download: `${full}?dl=1`,
    };
  }
  const full = legacyUrl();
  return {
    src: nextImage(full, 640),
    srcSet: `${nextImage(full, 640)} 640w, ${nextImage(full, 1200)} 1200w`,
    bigSrcSet: `${nextImage(full, 640)} 640w, ${nextImage(full, 1200)} 1200w, ${nextImage(full, 1920)} 1920w`,
    full,
    download: full,
  };
}
