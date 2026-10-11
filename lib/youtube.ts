/**
 * Fetch latest videos from the Tsakani Sessions YouTube channel.
 * Uses the public Atom feeds, no API key and no quota.
 *
 * YouTube's feed server is flaky: it answers 404 for a random set of feeds,
 * sometimes for hours, and the same URL works again a minute later. So this
 * asks two URLs that list the same uploads (the channel feed and the channel's
 * uploads playlist feed), tries again within a short time budget, and keeps
 * showing the last good list for up to a week while YouTube is down. Only
 * when there is no good list does the home page fall back to its "Visit our
 * YouTube channel" card.
 */

const CHANNEL_ID = "UCj43M1tbusArVV4AcOBQE0w";

// A channel's uploads playlist is its id with UC swapped for UU.
export const FEED_URLS = [
  `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`,
  `https://www.youtube.com/feeds/videos.xml?playlist_id=UU${CHANNEL_ID.slice(2)}`,
] as const;

// Channel feed, playlist feed, channel feed again. A 404 comes back in well
// under a second, so all three usually fit inside the budget.
const ATTEMPT_ORDER = [0, 1, 0];

// The most a home page render ever waits on YouTube, across every attempt.
const BUDGET_MS = 2000;
// A good list is reused for an hour before YouTube is asked again.
const FRESH_MS = 60 * 60 * 1000;
// After a failed refresh, wait this long before asking again, so a YouTube
// outage costs one slow render every few minutes rather than every render.
const RETRY_MS = 5 * 60 * 1000;
// A good list keeps being shown for at most this long while every refresh
// fails. At most: Cloudflare may evict the shared copy sooner (see below).
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

// Cloudflare's per data centre cache, shared by every isolate in that data
// centre. Only the Worker has it; local dev, Node and the tests skip it. Best
// effort: Cloudflare evicts entries nobody reads, whatever max-age says, so a
// quiet data centre can lose the list before the week is up.
const SHARED_KEY = "https://tsakanisessions.co.za/__cache/youtube-latest";

export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  published: string;
  views: number | null;
}

interface Entry {
  videos: YouTubeVideo[];
  // When the list was last fetched successfully. 0 means never.
  fetchedAt: number;
  // When YouTube was last asked, successfully or not.
  checkedAt: number;
}

// This isolate's copy. Plain data only, never a pending promise.
let memo: Entry | null = null;

export async function getLatestYouTubeVideos(limit = 4): Promise<YouTubeVideo[]> {
  const now = Date.now();

  let entry = memo;
  if (!entry || isDue(entry, now)) entry = merge(entry, await readShared());

  if (!entry || isDue(entry, now)) {
    const fresh = await fetchFeed();
    const checked: Entry =
      fresh.length > 0
        ? { videos: fresh, fetchedAt: now, checkedAt: now }
        : { videos: [], fetchedAt: 0, checkedAt: now };
    // Another render or isolate may have stored a better list while this one
    // waited on YouTube, so merge with the latest of both before writing.
    entry = merge(merge(merge(entry, memo), await readShared()), checked) as Entry;
    await writeShared(entry);
  }

  memo = merge(memo, entry);
  return now - entry.fetchedAt < KEEP_MS ? entry.videos.slice(0, limit) : [];
}

// Two views of the same list, combined so a failed check never throws away a
// good list: the videos come from whichever was fetched more recently, the
// time of the last check from whichever checked more recently.
function merge(a: Entry | null, b: Entry | null): Entry | null {
  if (!a) return b;
  if (!b) return a;
  const good = a.fetchedAt >= b.fetchedAt ? a : b;
  return {
    videos: good.videos,
    fetchedAt: good.fetchedAt,
    checkedAt: Math.max(a.checkedAt, b.checkedAt),
  };
}

function isDue(entry: Entry, now: number): boolean {
  const lastCheckFailed = entry.fetchedAt !== entry.checkedAt;
  return now - entry.checkedAt >= (lastCheckFailed ? RETRY_MS : FRESH_MS);
}

async function fetchFeed(): Promise<YouTubeVideo[]> {
  const signal = AbortSignal.timeout(BUDGET_MS);
  for (const index of ATTEMPT_ORDER) {
    if (signal.aborted) break;
    try {
      const response = await fetch(FEED_URLS[index], { signal });
      if (!response.ok) continue;
      const videos = parseFeed(await response.text());
      if (videos.length > 0) return videos;
    } catch {
      // Timed out or the network failed. The loop checks the budget.
    }
  }
  console.error("YouTube feed unavailable, showing the last good list or the fallback");
  return [];
}

export function parseFeed(xml: string): YouTubeVideo[] {
  const videos: YouTubeVideo[] = [];
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];

  for (const entry of entries) {
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
}

function sharedCache(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

async function readShared(): Promise<Entry | null> {
  try {
    const res = await sharedCache()?.match(SHARED_KEY);
    if (!res) return null;
    const data = (await res.json()) as Entry;
    return Array.isArray(data?.videos) &&
      typeof data.fetchedAt === "number" &&
      typeof data.checkedAt === "number"
      ? data
      : null;
  } catch {
    return null;
  }
}

async function writeShared(entry: Entry): Promise<void> {
  try {
    await sharedCache()?.put(
      SHARED_KEY,
      new Response(JSON.stringify(entry), {
        headers: {
          "content-type": "application/json",
          "cache-control": `max-age=${KEEP_MS / 1000}`,
        },
      })
    );
  } catch {
    // The isolate's own copy still holds it.
  }
}

/** Tests only: forget this isolate's copy. */
export function resetYouTubeCacheForTests(): void {
  memo = null;
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
