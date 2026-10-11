/**
 * The DJ roster: slugs, photos and their fallbacks, the admin payload, and the
 * one rule the booking API lives by. Kept pure so it is tested without a DB or
 * a request, the same way lib/bookings.ts is.
 *
 * Images: an uploaded photo wins. Without one, the thumbnail of the DJ's
 * YouTube video stands in, and without a video a gold monogram does. All of
 * them are drawn through next/image, so the browser only ever loads images
 * from this origin. That matters for returning visitors: the service worker
 * fetches on the page's behalf, and its CSP has no i.ytimg.com in connect-src.
 */

import type { Dj } from "@/lib/types";

export const DJ_PHOTO_BUCKET = "gallery-photos";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const DJ_PHOTO_PATH_RE = /^djs\/[A-Za-z0-9._-]{1,120}$/;
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export const DJ_NOT_FOUND = "That DJ is not on the roster.";

export function isDjSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 60 && SLUG_RE.test(value);
}

/** "PONTSO_THAT_DJ" becomes "pontso-that-dj", "GLOWGANG.ZA" "glowgang-za". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56)
    .replace(/-+$/g, "");
}

/**
 * The slug for a name, unique against the slugs already taken: "mandz", then
 * "mandz-2", "mandz-3". A name with no letters or digits at all gets "dj".
 */
export function uniqueDjSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(name) || "dj";
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** The 11 character video id from a link to one YouTube video, or null. */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = parsed.pathname.split("/")[1] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname === "/watch") {
      id = parsed.searchParams.get("v");
    } else {
      id = parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1] ?? null;
    }
  }
  return id && YOUTUBE_ID_RE.test(id) ? id : null;
}

/**
 * Privacy enhanced embed. The DJ page only mounts it after the visitor taps
 * play, so YouTube hears nothing from a visitor who never does.
 */
export function youtubeEmbedUrl(videoId: string, autoplay = false): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0${autoplay ? "&autoplay=1" : ""}`;
}

export function youtubeThumbnail(
  videoId: string,
  quality: "maxresdefault" | "hqdefault"
): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

/** Public URL of an uploaded photo. Anything outside djs/ is refused. */
export function djPhotoUrl(
  path: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
): string | null {
  if (!path || !DJ_PHOTO_PATH_RE.test(path) || !supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${DJ_PHOTO_BUCKET}/${path}`;
}

export type DjImage =
  | { kind: "photo"; src: string }
  /**
   * maxresdefault is sharp but YouTube only makes it for HD uploads, so it can
   * 404. hqdefault always exists and carries letterbox bars, which the photo
   * component crops off.
   */
  | { kind: "youtube"; src: string; fallback: string }
  | { kind: "monogram" };

export function djImage(
  dj: Pick<Dj, "photo_path" | "youtube_url">,
  supabaseUrl?: string
): DjImage {
  const photo = djPhotoUrl(dj.photo_path, supabaseUrl);
  if (photo) return { kind: "photo", src: photo };
  const videoId = youtubeVideoId(dj.youtube_url);
  if (videoId) {
    return {
      kind: "youtube",
      src: youtubeThumbnail(videoId, "maxresdefault"),
      fallback: youtubeThumbnail(videoId, "hqdefault"),
    };
  }
  return { kind: "monogram" };
}

/**
 * The share image. hqdefault rather than maxres because a crawler gets one
 * try and maxres can 404. Null means the caller falls back to the site's own
 * share image; Next does not inherit it from the layout on its own.
 */
export function djShareImage(
  dj: Pick<Dj, "photo_path" | "youtube_url">,
  supabaseUrl?: string
): string | null {
  const photo = djPhotoUrl(dj.photo_path, supabaseUrl);
  if (photo) return photo;
  const videoId = youtubeVideoId(dj.youtube_url);
  return videoId ? youtubeThumbnail(videoId, "hqdefault") : null;
}

/** One letter for the monogram, skipping a leading "DJ". "DJY LUVOS" is L. */
export function djMonogram(name: string): string {
  const words = name.split(/[\s_.]+/).filter(Boolean);
  const word = words.find((w) => !/^djy?$/i.test(w)) ?? words[0] ?? "";
  return (word.match(/[A-Za-z0-9]/)?.[0] ?? "T").toUpperCase();
}

// ---------------------------------------------------------------------------
// Booking: the server resolves the DJ, the browser only names a slug
// ---------------------------------------------------------------------------

export interface DjLookupRow {
  id: string;
  name: string;
}

/** Finds a DJ by slug. Throws on a database error, returns null when none. */
export type DjLookup = (slug: string) => Promise<DjLookupRow | null>;

export type DjResolution =
  | { ok: true; dj: DjLookupRow | null }
  | { ok: false; reason: "malformed" | "not_found"; error: string };

/**
 * No slug is fine, most enquiries are not for one DJ. A slug that is malformed
 * or not on the roster is refused as a DJ. The id and the name that end up on
 * the enquiry come from the database row, never from the request.
 *
 * The two refusals differ on purpose. A malformed slug never comes from the
 * site's own form, so the route turns the request away. A well formed slug
 * that is not on the roster is a DJ removed while the visitor had the form
 * open, so the route keeps the enquiry without a DJ rather than lose a lead.
 */
export async function resolveRequestedDj(
  slug: string | null | undefined,
  lookup: DjLookup
): Promise<DjResolution> {
  if (slug == null || slug === "") return { ok: true, dj: null };
  if (!isDjSlug(slug)) return { ok: false, reason: "malformed", error: DJ_NOT_FOUND };
  const row = await lookup(slug);
  if (!row) return { ok: false, reason: "not_found", error: DJ_NOT_FOUND };
  return { ok: true, dj: { id: row.id, name: row.name } };
}

// ---------------------------------------------------------------------------
// Admin payload
// ---------------------------------------------------------------------------

export interface DjPayload {
  name: string;
  description: string | null;
  photo_path: string | null;
  genres: string[];
  youtube_url: string | null;
  tiktok_url: string | null;
  instagram_url: string | null;
  soundcloud_url: string | null;
}

/**
 * Genre tags from an array or comma separated text: trimmed, de-duplicated
 * ignoring case, at most 8 of up to 40 characters each.
 */
export function cleanGenres(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const genre = item.replace(/\s+/g, " ").trim().slice(0, 40);
    if (genre && !out.some((g) => g.toLowerCase() === genre.toLowerCase())) {
      out.push(genre);
    }
    if (out.length >= 8) break;
  }
  return out;
}

/** The one list of which site each link may point at. */
export const DJ_LINKS = [
  { key: "youtube_url", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { key: "tiktok_url", label: "TikTok", hosts: ["tiktok.com"] },
  { key: "instagram_url", label: "Instagram", hosts: ["instagram.com"] },
  { key: "soundcloud_url", label: "SoundCloud", hosts: ["soundcloud.com"] },
] as const;

export type DjLinkKey = (typeof DJ_LINKS)[number]["key"];

/**
 * The links a DJ page may draw, in the order above. Checked again here, not
 * only when an admin saves, because a stolen admin session can write the
 * table straight through the Supabase API and skip that check.
 */
export function publicDjLinks(
  dj: Pick<Dj, DjLinkKey>
): { key: DjLinkKey; label: string; href: string }[] {
  const out: { key: DjLinkKey; label: string; href: string }[] = [];
  for (const link of DJ_LINKS) {
    const value = dj[link.key];
    if (!value || !/^https:\/\//i.test(value)) continue;
    const cleaned = cleanLink(value, [...link.hosts], link.label);
    if (typeof cleaned === "string") out.push({ key: link.key, label: link.label, href: cleaned });
  }
  return out;
}

/**
 * https only, and only on the hosts that field is for, so a taken over admin
 * account cannot turn a DJ's Instagram icon into a link to anywhere. A bare
 * "instagram.com/name" gets https:// in front rather than an error.
 */
function cleanLink(
  value: unknown,
  hosts: string[],
  label: string
): string | null | { error: string } {
  if (value == null) return null;
  if (typeof value !== "string") return { error: `${label} must be a link` };
  let trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[a-z]+:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: `${label} is not a valid link` };
  }
  if (parsed.protocol !== "https:") {
    return { error: `${label} must start with https` };
  }
  const host = parsed.hostname.toLowerCase();
  if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    return { error: `${label} must be a ${hosts[0]} link` };
  }
  const out = parsed.toString();
  if (out.length > 300) return { error: `${label} link is too long` };
  return out;
}

export function buildDjPayload(
  body: Record<string, unknown>
): DjPayload | { error: string } {
  const name =
    typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
  if (!name) return { error: "Give the DJ a name" };
  if (name.length > 80) return { error: "Keep the name under 80 characters" };

  let description: string | null = null;
  if (typeof body.description === "string") {
    // Line breaks are kept, runs of blank lines are not.
    const text = body.description
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (text.length > 500) {
      return { error: "Keep the description under 500 characters" };
    }
    description = text || null;
  }

  let photo_path: string | null = null;
  if (body.photo_path != null && body.photo_path !== "") {
    if (typeof body.photo_path !== "string" || !DJ_PHOTO_PATH_RE.test(body.photo_path)) {
      return { error: "Upload the picture here rather than pasting a link" };
    }
    photo_path = body.photo_path;
  }

  const links = {} as Record<DjLinkKey, string | null>;
  for (const link of DJ_LINKS) {
    const cleaned = cleanLink(body[link.key], [...link.hosts], link.label);
    if (cleaned && typeof cleaned === "object") return cleaned;
    links[link.key] = cleaned;
  }

  return {
    name,
    description,
    photo_path,
    genres: cleanGenres(body.genres),
    ...links,
  };
}
