import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as youtube from "@/lib/youtube";
import {
  FEED_URLS,
  getLatestYouTubeVideos,
  parseFeed,
  resetYouTubeCacheForTests,
} from "@/lib/youtube";

/**
 * The home page's "Latest on YouTube" row. YouTube's feed server answers 404
 * for random feeds at random times, so the list must survive a bad hour: try
 * the second URL, keep the last good list, and never hold the page up.
 */

const HOUR = 60 * 60 * 1000;

function feed(ids: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
 <title>Tsakani Sessions</title>
${ids
  .map(
    (id) => ` <entry>
  <yt:videoId>${id}</yt:videoId>
  <title>Ep ${id} &amp; friends</title>
  <published>2026-05-08T11:00:06+00:00</published>
  <media:statistics views="1234"/>
 </entry>`
  )
  .join("\n")}
</feed>`;
}

let clock = Date.parse("2026-10-11T12:00:00Z");
let calls: string[] = [];
let answer: (url: string) => Response | Promise<Response>;

beforeEach(() => {
  resetYouTubeCacheForTests();
  calls = [];
  clock = Date.parse("2026-10-11T12:00:00Z");
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", (url: string) => {
    calls.push(url);
    return Promise.resolve(answer(url));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ok = (ids: string[]) => () => new Response(feed(ids), { status: 200 });
const notFound = () => new Response("Not Found", { status: 404 });

describe("parseFeed", () => {
  it("reads id, title, date and views from each entry, never the feed's own title", () => {
    const videos = parseFeed(feed(["NB7oaD1XyXs", "BWwOndkDvY0"]));
    expect(videos.map((v) => v.id)).toEqual(["NB7oaD1XyXs", "BWwOndkDvY0"]);
    expect(videos[0]).toEqual({
      id: "NB7oaD1XyXs",
      title: "Ep NB7oaD1XyXs & friends",
      url: "https://www.youtube.com/watch?v=NB7oaD1XyXs",
      thumbnail: "https://i.ytimg.com/vi/NB7oaD1XyXs/hqdefault.jpg",
      published: "2026-05-08T11:00:06+00:00",
      views: 1234,
    });
  });
});

describe("getLatestYouTubeVideos", () => {
  it("returns the newest videos, up to the limit", async () => {
    answer = ok(["a", "b", "c", "d", "e"]);
    const videos = await getLatestYouTubeVideos(4);
    expect(videos.map((v) => v.id)).toEqual(["a", "b", "c", "d"]);
    expect(calls).toEqual([FEED_URLS[0]]);
  });

  it("asks the uploads playlist feed when the channel feed answers 404", async () => {
    answer = (url) => (url === FEED_URLS[0] ? notFound() : ok(["a", "b"])());
    const videos = await getLatestYouTubeVideos(4);
    expect(videos.map((v) => v.id)).toEqual(["a", "b"]);
    expect(calls).toEqual([FEED_URLS[0], FEED_URLS[1]]);
    expect(FEED_URLS[1]).toContain("playlist_id=UUj43M1tbusArVV4AcOBQE0w");
  });

  it("reuses a good list for an hour without asking YouTube again", async () => {
    answer = ok(["a"]);
    await getLatestYouTubeVideos(4);
    clock += HOUR - 1000;
    await getLatestYouTubeVideos(4);
    expect(calls).toHaveLength(1);
  });

  it("keeps showing the last good list while every feed is down", async () => {
    answer = ok(["a", "b"]);
    await getLatestYouTubeVideos(4);

    answer = notFound;
    clock += 2 * HOUR;
    const videos = await getLatestYouTubeVideos(4);
    expect(videos.map((v) => v.id)).toEqual(["a", "b"]);
    expect(calls).toHaveLength(1 + 3);
  });

  it("keeps the last good list for a week of failures and drops it after, so the fallback shows", async () => {
    answer = ok(["a"]);
    await getLatestYouTubeVideos(4);

    answer = notFound;
    clock += 7 * 24 * HOUR - 60 * 1000;
    expect((await getLatestYouTubeVideos(4)).map((v) => v.id)).toEqual(["a"]);
    clock += 2 * 60 * 1000;
    expect(await getLatestYouTubeVideos(4)).toEqual([]);
  });

  it("after a failed refresh with a list in hand, waits five minutes before asking again", async () => {
    answer = ok(["a"]);
    await getLatestYouTubeVideos(4);
    answer = notFound;
    clock += 2 * HOUR;
    await getLatestYouTubeVideos(4);
    expect(calls).toHaveLength(4);

    clock += 4 * 60 * 1000;
    await getLatestYouTubeVideos(4);
    expect(calls).toHaveLength(4);

    clock += 2 * 60 * 1000;
    await getLatestYouTubeVideos(4);
    expect(calls).toHaveLength(7);
  });

  it("keeps the good list when a slower failing render finishes after a succeeding one", async () => {
    let n = 0;
    vi.stubGlobal("fetch", (url: string) => {
      calls.push(url);
      n++;
      const first = n === 1;
      return new Promise<Response>((resolve) =>
        setTimeout(() => resolve(first ? ok(["a"])() : notFound()), first ? 5 : 30)
      );
    });
    const [winner, loser] = await Promise.all([getLatestYouTubeVideos(4), getLatestYouTubeVideos(4)]);
    expect(winner.map((v) => v.id)).toEqual(["a"]);
    // The failing render picks up the list the other one just stored.
    expect(loser.map((v) => v.id)).toEqual(["a"]);

    clock += 10 * 60 * 1000;
    expect((await getLatestYouTubeVideos(4)).map((v) => v.id)).toEqual(["a"]);
  });

  it("returns nothing when there has never been a good list, and waits five minutes before asking again", async () => {
    answer = notFound;
    expect(await getLatestYouTubeVideos(4)).toEqual([]);
    expect(calls).toHaveLength(3);

    clock += 4 * 60 * 1000;
    await getLatestYouTubeVideos(4);
    expect(calls).toHaveLength(3);

    answer = ok(["a"]);
    clock += 2 * 60 * 1000;
    expect((await getLatestYouTubeVideos(4)).map((v) => v.id)).toEqual(["a"]);
    expect(calls).toHaveLength(4);
  });

  it("gives up inside the time budget when YouTube hangs", async () => {
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      calls.push(url);
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    const started = performance.now();
    expect(await getLatestYouTubeVideos(4)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(3000);
    expect(calls).toHaveLength(1);
  });

  it("an isolate keeps its good list when another isolate shares a failure", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("caches", {
      default: {
        match: async (key: string) => (store.has(key) ? new Response(store.get(key)) : undefined),
        put: async (key: string, res: Response) => {
          store.set(key, await res.text());
        },
      },
    });

    vi.resetModules();
    const x = await import("@/lib/youtube");
    answer = ok(["a"]);
    await x.getLatestYouTubeVideos(4);

    // Cloudflare evicts the shared copy, then a cold isolate fails.
    store.clear();
    vi.resetModules();
    const y = await import("@/lib/youtube");
    answer = notFound;
    clock += 61 * 60 * 1000;
    expect(await y.getLatestYouTubeVideos(4)).toEqual([]);
    const asked = calls.length;

    // The first isolate is due, sees the shared failure, keeps its list and
    // waits out the five minutes instead of asking YouTube again.
    expect((await x.getLatestYouTubeVideos(4)).map((v) => v.id)).toEqual(["a"]);
    expect(calls).toHaveLength(asked);
  });

  it("shares a failure across isolates, so a cold one does not ask YouTube again within five minutes", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("caches", {
      default: {
        match: async (key: string) => (store.has(key) ? new Response(store.get(key)) : undefined),
        put: async (key: string, res: Response) => {
          store.set(key, await res.text());
        },
      },
    });
    answer = notFound;
    await getLatestYouTubeVideos(4);
    expect(calls).toHaveLength(3);

    youtube.resetYouTubeCacheForTests();
    clock += 60 * 1000;
    expect(await getLatestYouTubeVideos(4)).toEqual([]);
    expect(calls).toHaveLength(3);
  });

  it("shares a good list across isolates through Cloudflare's cache", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("caches", {
      default: {
        match: async (key: string) => (store.has(key) ? new Response(store.get(key)) : undefined),
        put: async (key: string, res: Response) => {
          store.set(key, await res.text());
        },
      },
    });

    answer = ok(["a"]);
    await getLatestYouTubeVideos(4);
    expect(calls).toHaveLength(1);

    // A fresh isolate in the same data centre.
    resetYouTubeCacheForTests();
    const videos = await getLatestYouTubeVideos(4);
    expect(videos.map((v) => v.id)).toEqual(["a"]);
    expect(calls).toHaveLength(1);
  });
});
