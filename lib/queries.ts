import { createClient } from "@/lib/supabase/server";
import type { Event, Product, Gallery, GalleryPhoto } from "@/lib/types";

/**
 * Shared data-fetching functions for server components.
 * All queries use the anon key with RLS — no service role needed at runtime.
 * Returns empty arrays/null gracefully when Supabase isn't configured.
 */

export async function getPublishedEvents(): Promise<Event[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("date", { ascending: true });

  return (data as Event[]) || [];
}

export async function getFeaturedEvents(): Promise<Event[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("date", { ascending: true })
    .limit(4);

  return (data as Event[]) || [];
}

export async function getEventBySlug(slug: string): Promise<Event | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .single();

  return data as Event | null;
}

export async function getActiveProducts(): Promise<Product[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (data as Product[]) || [];
}

export async function getGalleries(): Promise<(Gallery & { photo_count: number; event: Event | null })[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data: galleries } = await supabase
    .from("galleries")
    .select("*, event:events(*)")
    .order("created_at", { ascending: false });

  if (!galleries) return [];

  // Get photo counts
  const results = await Promise.all(
    galleries.map(async (g: Gallery & { event: Event | null }) => {
      const { count } = await supabase
        .from("gallery_photos")
        .select("id", { count: "exact", head: true })
        .eq("gallery_id", g.id);

      return { ...g, photo_count: count || 0 };
    })
  );

  return results;
}

export async function getGalleryBySlug(
  slug: string
): Promise<{ gallery: Gallery; photos: GalleryPhoto[]; event: Event | null } | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data: gallery } = await supabase
    .from("galleries")
    .select("*, event:events(*)")
    .eq("slug", slug)
    .single();

  if (!gallery) return null;

  const { data: photos } = await supabase
    .from("gallery_photos")
    .select("*")
    .eq("gallery_id", gallery.id)
    .order("sort_order", { ascending: true });

  // Build public URLs for photos
  const photosWithUrls = (photos || []).map((photo: GalleryPhoto) => {
    const { data: urlData } = supabase.storage
      .from("gallery-photos")
      .getPublicUrl(photo.storage_path);

    return {
      ...photo,
      url: urlData?.publicUrl || "",
    };
  });

  return {
    gallery: gallery as Gallery,
    photos: photosWithUrls,
    event: (gallery as Gallery & { event: Event | null }).event,
  };
}
