import { createClient } from "@/lib/supabase/server";

export interface FeaturedPost {
  id: string;
  platform: "tiktok" | "instagram" | "youtube" | "custom";
  post_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export async function getFeaturedPosts(
  platform?: FeaturedPost["platform"]
): Promise<FeaturedPost[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("featured_posts")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data } = await query;
  return (data as FeaturedPost[]) || [];
}

/**
 * Fetch TikTok oEmbed data for a video URL.
 * Free, no auth required, works for public videos.
 */
export async function fetchTikTokOEmbed(videoUrl: string): Promise<{
  title: string;
  thumbnail_url: string;
  author: string;
} | null> {
  try {
    const response = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
      { next: { revalidate: 86400 } } // cache 24h
    );
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: data.title || "",
      thumbnail_url: data.thumbnail_url || "",
      author: data.author_name || "",
    };
  } catch {
    return null;
  }
}

/**
 * Detect platform from URL.
 */
export function detectPlatform(url: string): FeaturedPost["platform"] | null {
  if (/tiktok\.com/.test(url)) return "tiktok";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  return null;
}
