import type { MetadataRoute } from "next";
import { getDjs, getPublishedEvents } from "@/lib/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://tsakanisessions.co.za";

  const staticRoutes = [
    "/",
    "/events",
    "/djs",
    "/services",
    "/shop",
    "/gallery",
    "/faq",
    "/privacy",
    "/terms",
    "/refund-policy",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "/" ? 1 : 0.8,
  }));

  // Add events from Supabase (cheap fetch — already used by /events page)
  let eventRoutes: MetadataRoute.Sitemap = [];
  try {
    const events = await getPublishedEvents();
    eventRoutes = events.map((event) => ({
      url: `${baseUrl}/events/${event.slug}`,
      lastModified: new Date(event.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }));
  } catch {
    // Fall back to static routes if Supabase is unreachable.
  }

  let djRoutes: MetadataRoute.Sitemap = [];
  try {
    const djs = await getDjs();
    djRoutes = djs.map((dj) => ({
      url: `${baseUrl}/djs/${dj.slug}`,
      lastModified: new Date(dj.updated_at || dj.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {
    // Same fallback as events.
  }

  return [...staticRoutes, ...eventRoutes, ...djRoutes];
}
