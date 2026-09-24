import { createClient } from "@/lib/supabase/server";
import type { Event, Product, Gallery, GalleryPhoto, Ticket, CheckoutOptions } from "@/lib/types";
import { onSaleTickets } from "@/lib/tickets";

export type EventWithTickets = Event & { tickets: Ticket[] };

/**
 * Shared data-fetching functions for server components.
 * All queries use the anon key with RLS — no service role needed at runtime.
 * Returns empty arrays/null gracefully when Supabase isn't configured.
 */

export async function getPublishedEvents(): Promise<EventWithTickets[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("events")
    .select("*, tickets(*)")
    .eq("status", "published")
    .order("date", { ascending: true });

  if (!data) return [];
  return (data as EventWithTickets[]).map((e) => ({
    ...e,
    tickets: onSaleTickets(e.tickets),
  }));
}

export async function getFeaturedEvents(): Promise<EventWithTickets[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("events")
    .select("*, tickets(*)")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("date", { ascending: true })
    .limit(4);

  if (!data) return [];
  return (data as EventWithTickets[]).map((e) => ({
    ...e,
    tickets: onSaleTickets(e.tickets),
  }));
}

export async function getEventBySlug(slug: string): Promise<EventWithTickets | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("events")
    .select("*, tickets(*)")
    .eq("slug", slug)
    .single();

  if (!data) return null;
  const event = data as EventWithTickets;
  event.tickets = onSaleTickets(event.tickets);
  return event;
}

export async function getActiveProducts(): Promise<Product[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  // sort_order first so an admin can put the hero piece at the top of the grid,
  // created_at only as the tie-break for products that were never ordered.
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (data as Product[]) || [];
}

/**
 * Which checkout buttons the shop may draw. Two booleans and nothing more: the
 * bank account and the Paystack link stay admin only, and the buyer gets what
 * they need after their order exists, from create_merch_order.
 */
export async function getCheckoutOptions(): Promise<CheckoutOptions> {
  const supabase = await createClient();
  const off = { eft: false, paystack: false };
  if (!supabase) return off;

  const { data, error } = await supabase.rpc("checkout_options");
  if (error) return off;
  const row = (Array.isArray(data) ? data[0] : data) as CheckoutOptions | undefined;
  return { eft: row?.eft === true, paystack: row?.paystack === true };
}

export async function getGalleries(): Promise<(Gallery & { photo_count: number; event: Event | null })[]> {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
