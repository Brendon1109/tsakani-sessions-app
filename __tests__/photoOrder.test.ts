import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { sortPhotos, cleanTakenAt } from "@/lib/photo-order";
import { readTakenAt } from "@/lib/taken-at";

describe("gallery photo order", () => {
  it("puts photos in capture order, whatever order they uploaded in", () => {
    const photos = [
      { id: "c", taken_at: "2026-10-31T21:30:00Z", created_at: "2026-11-02T02:35:00Z" },
      { id: "a", taken_at: "2026-10-31T19:00:00Z", created_at: "2026-11-02T02:36:00Z" },
      { id: "b", taken_at: "2026-10-31T19:00:02Z", created_at: "2026-11-02T02:35:30Z" },
    ];
    expect(sortPhotos(photos).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("puts photos with no capture time after the timed ones, by upload time", () => {
    const photos = [
      { id: "old2", created_at: "2026-11-02T02:36:00Z" },
      { id: "timed", taken_at: "2026-10-31T19:00:00Z", created_at: "2026-11-02T05:00:00Z" },
      { id: "old1", taken_at: null, created_at: "2026-11-02T02:35:00Z" },
    ];
    expect(sortPhotos(photos).map((p) => p.id)).toEqual(["timed", "old1", "old2"]);
  });

  it("lets an admin's sort_order win over everything", () => {
    const photos = [
      { id: "late", sort_order: 0, taken_at: "2026-10-31T23:00:00Z" },
      { id: "pinned", sort_order: -1, taken_at: "2026-10-31T23:59:00Z" },
    ];
    expect(sortPhotos(photos)[0].id).toBe("pinned");
  });
});

describe("cleanTakenAt", () => {
  it("keeps a real capture time as ISO", () => {
    expect(cleanTakenAt("2026-10-31T19:14:05.000Z")).toBe("2026-10-31T19:14:05.000Z");
  });
  it("drops nonsense and impossible dates", () => {
    expect(cleanTakenAt("not a date")).toBeNull();
    expect(cleanTakenAt("1980-01-01T00:00:00Z")).toBeNull();
    expect(cleanTakenAt("2099-01-01T00:00:00Z")).toBeNull();
    expect(cleanTakenAt(42)).toBeNull();
    expect(cleanTakenAt(null)).toBeNull();
  });
});

describe("readTakenAt", () => {
  it("reads DateTimeOriginal from a JPEG", async () => {
    const bytes = readFileSync("__tests__/fixtures/exif-taken.jpg");
    const file = new File([bytes], "a.jpg", { type: "image/jpeg" });
    const iso = await readTakenAt(file);
    expect(iso).not.toBeNull();
    // EXIF has no zone, so it is read as local time: compare the wall clock.
    const d = new Date(iso!);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2026, 10, 31, 21, 14,
    ]);
  });

  it("returns null for a photo with no capture time", async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "b.jpg", { type: "image/jpeg" });
    expect(await readTakenAt(file)).toBeNull();
  });
});
