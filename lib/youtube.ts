/**
 * Fetch latest videos from the Tsakani Sessions YouTube channel.
 * Uses the public RSS feed — no API key, no quota, completely free.
 */

const CHANNEL_ID = "UCj43M1tbusArVV4AcOBQE0w";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  published: string;
  views: number | null;
}

// The fetch below is cached for an hour by Next's data cache on Vercel. The
// Cloudflare Worker runs without an incremental cache (see
// docs/CLOUDFLARE-MOVE.md), so there that option does nothing and every home
// page render would refetch the feed. This keeps the last good result for an
// hour inside each isolate instead. Plain data only, never a pending promise,
// and a failure is not remembered, so the next request tries again.
const MEMO_MS = 60 * 60 * 1000;
const memo = new Map<number, { at: number; videos: YouTubeVideo[] }>();

export async function getLatestYouTubeVideos(limit = 4): Promise<YouTubeVideo[]> {
  const hit = memo.get(limit);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.videos;
  const videos = await fetchLatestYouTubeVideos(limit);
  if (videos.length > 0) memo.set(limit, { at: Date.now(), videos });
  return videos;
}

async function fetchLatestYouTubeVideos(limit: number): Promise<YouTubeVideo[]> {
  try {
    const response = await fetch(FEED_URL, {
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const videos: YouTubeVideo[] = [];

    // Extract entries from the Atom feed
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    const entries = xml.match(entryRegex) || [];

    for (const entry of entries.slice(0, limit)) {
      const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>([^<]+)<\/title>/)?.[1];
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
      const views = entry.match(/views="(\d+)"/)?.[1];

      if (!videoId || !title) continue;

      videos.push({
        id: videoId,
        title: decodeHtmlEntities(title),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        published: published || "",
        views: views ? parseInt(views, 10) : null,
      });
    }

    return videos;
  } catch (error) {
    console.error("Failed to fetch YouTube videos:", error);
    return [];
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
