import { describe, it, expect, vi } from "vitest";
import {
  buildDjPayload,
  cleanGenres,
  djImage,
  djMonogram,
  djPhotoUrl,
  djShareImage,
  resolveRequestedDj,
  slugify,
  uniqueDjSlug,
  youtubeVideoId,
  DJ_NOT_FOUND,
} from "@/lib/djs";

const SUPABASE = "https://example.supabase.co";

describe("slugs", () => {
  it("derives a slug from the names on the roster", () => {
    expect(slugify("KENDOUR")).toBe("kendour");
    expect(slugify("PONTSO_THAT_DJ")).toBe("pontso-that-dj");
    expect(slugify("GLOWGANG.ZA")).toBe("glowgang-za");
    expect(slugify("  PHET IS A DJ ")).toBe("phet-is-a-dj");
  });

  it("keeps a slug unique by counting up", () => {
    expect(uniqueDjSlug("MANDZ", [])).toBe("mandz");
    expect(uniqueDjSlug("MANDZ", ["mandz"])).toBe("mandz-2");
    expect(uniqueDjSlug("Mandz!", ["mandz", "mandz-2"])).toBe("mandz-3");
  });

  it("never returns an empty slug", () => {
    expect(uniqueDjSlug("***", [])).toBe("dj");
  });
});

describe("youtubeVideoId", () => {
  it("reads the id from the usual link shapes", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=AeMNGjJQutQ")).toBe("AeMNGjJQutQ");
    expect(youtubeVideoId("https://youtu.be/AeMNGjJQutQ?si=x")).toBe("AeMNGjJQutQ");
    expect(youtubeVideoId("https://m.youtube.com/watch?v=Yb_OpN-nUVM&t=10")).toBe("Yb_OpN-nUVM");
    expect(youtubeVideoId("https://www.youtube.com/shorts/AeMNGjJQutQ")).toBe("AeMNGjJQutQ");
  });

  it("returns null for a channel, a playlist or another site", () => {
    expect(youtubeVideoId("https://www.youtube.com/@tsakanisessions")).toBeNull();
    expect(youtubeVideoId("https://www.youtube.com/playlist?list=PL123")).toBeNull();
    expect(youtubeVideoId("https://evil.example/watch?v=AeMNGjJQutQ")).toBeNull();
    expect(youtubeVideoId("javascript:alert(1)")).toBeNull();
    expect(youtubeVideoId(null)).toBeNull();
  });
});

describe("DJ pictures", () => {
  it("uses the uploaded photo first", () => {
    const image = djImage(
      { photo_path: "djs/1.jpg", youtube_url: "https://youtu.be/AeMNGjJQutQ" },
      SUPABASE
    );
    expect(image).toEqual({
      kind: "photo",
      src: `${SUPABASE}/storage/v1/object/public/gallery-photos/djs/1.jpg`,
    });
  });

  it("falls back to the video thumbnail, sharp first then the one that always exists", () => {
    const image = djImage(
      { photo_path: null, youtube_url: "https://www.youtube.com/watch?v=AeMNGjJQutQ" },
      SUPABASE
    );
    expect(image).toEqual({
      kind: "youtube",
      src: "https://i.ytimg.com/vi/AeMNGjJQutQ/maxresdefault.jpg",
      fallback: "https://i.ytimg.com/vi/AeMNGjJQutQ/hqdefault.jpg",
    });
  });

  it("falls back to the monogram with no photo and no single video", () => {
    expect(djImage({ photo_path: null, youtube_url: null }, SUPABASE)).toEqual({ kind: "monogram" });
    expect(
      djImage({ photo_path: null, youtube_url: "https://www.youtube.com/@someone" }, SUPABASE)
    ).toEqual({ kind: "monogram" });
  });

  it("refuses a photo path outside djs/", () => {
    expect(djPhotoUrl("products/tee.jpg", SUPABASE)).toBeNull();
    expect(djPhotoUrl("djs/../products/tee.jpg", SUPABASE)).toBeNull();
    expect(djPhotoUrl("https://evil.example/a.jpg", SUPABASE)).toBeNull();
  });

  it("shares the thumbnail that always exists", () => {
    expect(djShareImage({ photo_path: null, youtube_url: "https://youtu.be/AeMNGjJQutQ" }, SUPABASE)).toBe(
      "https://i.ytimg.com/vi/AeMNGjJQutQ/hqdefault.jpg"
    );
    expect(djShareImage({ photo_path: null, youtube_url: null }, SUPABASE)).toBeNull();
  });

  it("picks the monogram letter past a leading DJ", () => {
    expect(djMonogram("KENDOUR")).toBe("K");
    expect(djMonogram("DJY LUVOS")).toBe("L");
    expect(djMonogram("DJ LIBZA")).toBe("L");
    expect(djMonogram("EXCLUSIVE DJ")).toBe("E");
    expect(djMonogram("GLOWGANG.ZA")).toBe("G");
  });
});

describe("resolveRequestedDj (the booking API's DJ check)", () => {
  const roster = new Map([["kendour", { id: "id-kendour", name: "KENDOUR" }]]);
  const lookup = vi.fn(async (slug: string) => roster.get(slug) ?? null);

  it("accepts an enquiry with no DJ", async () => {
    expect(await resolveRequestedDj(null, lookup)).toEqual({ ok: true, dj: null });
    expect(await resolveRequestedDj("", lookup)).toEqual({ ok: true, dj: null });
  });

  it("returns the roster's own id and name for a real DJ", async () => {
    expect(await resolveRequestedDj("kendour", lookup)).toEqual({
      ok: true,
      dj: { id: "id-kendour", name: "KENDOUR" },
    });
  });

  it("rejects a DJ who is not on the roster", async () => {
    expect(await resolveRequestedDj("black-coffee", lookup)).toEqual({
      ok: false,
      error: DJ_NOT_FOUND,
    });
  });

  it("rejects a malformed slug without asking the database", async () => {
    lookup.mockClear();
    for (const bad of ["KENDOUR", "../admin", "a b", "x".repeat(61), "kendour-"]) {
      expect((await resolveRequestedDj(bad, lookup)).ok).toBe(false);
    }
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("buildDjPayload", () => {
  it("cleans a full form", () => {
    const result = buildDjPayload({
      name: "  KENDOUR ",
      description: "Deep house.\n\n\n\nSunset sets.",
      photo_path: "djs/1700000000000-abc.jpg",
      genres: ["Deep House", "deep house", " Amapiano "],
      youtube_url: "https://www.youtube.com/watch?v=AeMNGjJQutQ",
      tiktok_url: "tiktok.com/@kendour",
      instagram_url: "https://www.instagram.com/kendour",
      soundcloud_url: "https://soundcloud.com/kendour",
      slug: "ignored",
    });
    expect(result).toEqual({
      name: "KENDOUR",
      description: "Deep house.\n\nSunset sets.",
      photo_path: "djs/1700000000000-abc.jpg",
      genres: ["Deep House", "Amapiano"],
      youtube_url: "https://www.youtube.com/watch?v=AeMNGjJQutQ",
      tiktok_url: "https://tiktok.com/@kendour",
      instagram_url: "https://www.instagram.com/kendour",
      soundcloud_url: "https://soundcloud.com/kendour",
    });
  });

  it("turns empty optional fields into null", () => {
    const result = buildDjPayload({ name: "ONKA", description: "  ", youtube_url: "" });
    expect(result).toMatchObject({
      name: "ONKA",
      description: null,
      photo_path: null,
      genres: [],
      youtube_url: null,
      soundcloud_url: null,
    });
  });

  it("requires a name", () => {
    expect(buildDjPayload({ name: "   " })).toEqual({ error: "Give the DJ a name" });
  });

  it("only takes each link from its own site, over https", () => {
    expect(buildDjPayload({ name: "A", instagram_url: "https://evil.example/x" })).toHaveProperty("error");
    expect(buildDjPayload({ name: "A", soundcloud_url: "https://www.mixcloud.com/x" })).toHaveProperty("error");
    expect(buildDjPayload({ name: "A", tiktok_url: "http://www.tiktok.com/@x" })).toHaveProperty("error");
    expect(buildDjPayload({ name: "A", youtube_url: "https://notyoutube.com/x" })).toHaveProperty("error");
    expect(buildDjPayload({ name: "A", instagram_url: "https://instagram.com.evil.example/x" })).toHaveProperty("error");
  });

  it("accepts a YouTube channel as well as a video", () => {
    expect(buildDjPayload({ name: "A", youtube_url: "https://www.youtube.com/@tsakanisessions" })).toMatchObject({
      youtube_url: "https://www.youtube.com/@tsakanisessions",
    });
  });

  it("only takes a picture uploaded here", () => {
    expect(buildDjPayload({ name: "A", photo_path: "https://evil.example/a.jpg" })).toHaveProperty("error");
    expect(buildDjPayload({ name: "A", photo_path: "products/tee.jpg" })).toHaveProperty("error");
  });

  it("caps genres at eight tags from comma separated text", () => {
    expect(cleanGenres("Gqom, Amapiano, , gqom")).toEqual(["Gqom", "Amapiano"]);
    expect(cleanGenres(Array.from({ length: 12 }, (_, i) => `G${i}`))).toHaveLength(8);
  });
});
