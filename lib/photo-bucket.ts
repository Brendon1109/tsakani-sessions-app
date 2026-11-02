import { getCloudflareContext } from "@opennextjs/cloudflare/cloudflare-context";

/**
 * The R2 bucket gallery photos live in, `tsakani-photos`, bound to the Worker
 * as PHOTOS in wrangler.jsonc. See lib/photo-storage.ts for the layout.
 */

/** The part of the R2 binding this app uses. */
export interface PhotoBucket {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

/** The PHOTOS binding on the Worker, or null anywhere else (tests, next dev). */
export function photoBucket(): PhotoBucket | null {
  try {
    const env = getCloudflareContext().env as unknown as { PHOTOS?: PhotoBucket };
    return env.PHOTOS ?? null;
  } catch {
    return null;
  }
}
