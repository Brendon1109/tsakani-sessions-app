import { zipSync } from "fflate";

/**
 * Saving gallery photos to the visitor's own device.
 *
 * The photos live on Supabase storage, another origin, so a plain
 * <a download> is ignored and Safari only opens the image. Instead the photo
 * is fetched (storage answers with Access-Control-Allow-Origin: *, and the
 * CSP allows https://*.supabase.co in connect-src) and then:
 *
 *  - on a phone, handed to the share sheet, where "Save Image" puts it in
 *    the camera roll;
 *  - elsewhere, saved through a same origin blob link, one photo as a JPG,
 *    several as one zip.
 */

/** A phone share sheet stays usable and light up to this many photos. */
export const MAX_SAVE = 30;

export interface SavePhoto {
  url: string;
  name: string;
}

export async function fetchPhotos(photos: SavePhoto[]): Promise<File[]> {
  const files: File[] = [];
  for (const p of photos.slice(0, MAX_SAVE)) {
    const res = await fetch(p.url, { mode: "cors" });
    if (!res.ok) throw new Error(`Could not fetch ${p.name}`);
    const blob = await res.blob();
    files.push(new File([blob], p.name, { type: blob.type || "image/jpeg" }));
  }
  return files;
}

export function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    // Phones and tablets only: a laptop's share sheet has no plain "save".
    window.matchMedia("(pointer: coarse)").matches &&
    navigator.canShare({ files })
  );
}

function saveBlob(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export async function downloadFiles(files: File[], zipName: string) {
  if (files.length === 1) {
    saveBlob(files[0], files[0].name);
    return;
  }
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = new Uint8Array(await f.arrayBuffer());
  // JPGs are already compressed, so store them as they are.
  const zipped = zipSync(entries, { level: 0 });
  saveBlob(new Blob([zipped as BlobPart], { type: "application/zip" }), zipName);
}

/**
 * "shared" and "downloaded" are done. "needs-tap" means the share sheet
 * refused because the fetch outlasted the tap that started it (Safari does
 * this): call shareFiles from a fresh tap. "cancelled" is the visitor closing
 * the sheet.
 */
export type SaveOutcome = "shared" | "downloaded" | "needs-tap" | "cancelled";

export async function shareFiles(files: File[]): Promise<SaveOutcome> {
  try {
    await navigator.share({ files });
    return "shared";
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "AbortError") return "cancelled";
    if (name === "NotAllowedError") return "needs-tap";
    throw err;
  }
}

export async function saveFiles(files: File[], zipName: string): Promise<SaveOutcome> {
  if (canShareFiles(files)) return shareFiles(files);
  await downloadFiles(files, zipName);
  return "downloaded";
}

/** "Tsakani Halloween" and 3 become "tsakani-halloween-003.jpg". */
export function photoFileName(base: string, index: number): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tsakani";
  return `${slug}-${String(index + 1).padStart(3, "0")}.jpg`;
}
