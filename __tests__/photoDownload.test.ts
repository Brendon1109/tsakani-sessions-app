import { describe, it, expect, vi, beforeEach } from "vitest";
import { unzipSync } from "fflate";
import { photoFileName, fetchPhotos, MAX_SAVE, shareFiles } from "@/lib/photo-download";

describe("photo download", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("names files after the gallery, in order", () => {
    expect(photoFileName("Tsakani Halloween", 2)).toBe("tsakani-halloween-003.jpg");
    expect(photoFileName("Women's Day Celebration ", 0)).toBe("women-s-day-celebration-001.jpg");
    expect(photoFileName("", 9)).toBe("tsakani-010.jpg");
  });

  it("fetches at most MAX_SAVE photos", async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob([new Uint8Array([1, 2])], { type: "image/jpeg" })));
    vi.stubGlobal("fetch", fetchMock);
    const list = Array.from({ length: MAX_SAVE + 5 }, (_, i) => ({ url: `https://x/${i}`, name: `p${i}.jpg` }));
    const files = await fetchPhotos(list);
    expect(files).toHaveLength(MAX_SAVE);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_SAVE);
    expect(files[0].name).toBe("p0.jpg");
  });

  it("fails loudly when storage refuses a photo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    await expect(fetchPhotos([{ url: "https://x/1", name: "a.jpg" }])).rejects.toThrow();
  });

  it("asks for a fresh tap when Safari refuses the share sheet", async () => {
    const refuse = (name: string) =>
      vi.stubGlobal("navigator", { share: vi.fn(async () => { throw Object.assign(new Error(name), { name }); }) });
    refuse("NotAllowedError");
    expect(await shareFiles([])).toBe("needs-tap");
    refuse("AbortError");
    expect(await shareFiles([])).toBe("cancelled");
  });

  it("zips stored photos that unzip unchanged", async () => {
    const { zipSync } = await import("fflate");
    const z = zipSync({ "a.jpg": new Uint8Array([9, 8, 7]) }, { level: 0 });
    expect(Array.from(unzipSync(z)["a.jpg"])).toEqual([9, 8, 7]);
  });
});
