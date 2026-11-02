import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { PHOTO_CACHE_CONTROL } from "@/lib/photo-storage";

/**
 * Uploading a gallery photo: admins only, one photo and its two copies into
 * R2, the row last, and nothing left behind when either half fails.
 */

type Who = "nobody" | "visitor" | "admin";
let who: Who = "admin";
let insertError: { message: string } | null = null;
let putFails = false;
let bound = true;
const inserted: Record<string, unknown>[] = [];
const puts: { key: string; bytes: number; contentType?: string; cacheControl?: string }[] = [];
const deletes: string[][] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: who === "nobody" ? null : { id: who } } }) },
    from: (table: string) =>
      table === "profiles"
        ? {
            select: () => ({
              eq: () => ({ single: async () => ({ data: { role: who === "admin" ? "admin" : "user" } }) }),
            }),
          }
        : {
            insert: (row: Record<string, unknown>) => {
              inserted.push(row);
              return {
                select: () => ({
                  single: async () =>
                    insertError ? { data: null, error: insertError } : { data: { id: "new-id" }, error: null },
                }),
              };
            },
          },
  }),
}));

vi.mock("@opennextjs/cloudflare/cloudflare-context", () => ({
  getCloudflareContext: () => ({
    env: bound
      ? {
          PHOTOS: {
            put: async (
              key: string,
              value: ArrayBuffer,
              opts?: { httpMetadata?: { contentType?: string; cacheControl?: string } }
            ) => {
              if (putFails && key.startsWith("sm/")) throw new Error("R2 down");
              puts.push({
                key,
                bytes: value.byteLength,
                contentType: opts?.httpMetadata?.contentType,
                cacheControl: opts?.httpMetadata?.cacheControl,
              });
            },
            delete: async (keys: string | string[]) => {
              deletes.push(Array.isArray(keys) ? keys : [keys]);
            },
          },
        }
      : {},
  }),
}));

import { POST } from "@/app/api/gallery/upload/route";

const G = "11111111-1111-4111-8111-111111111111";

function jpeg(bytes: number, name = "p.jpg") {
  return new File([new Uint8Array(bytes)], name, { type: "image/jpeg" });
}

function upload(fields: Record<string, string | File | (string | File)[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
  }
  return POST(new NextRequest("http://localhost/api/gallery/upload", { method: "POST", body: fd }));
}

beforeEach(() => {
  who = "admin";
  insertError = null;
  putFails = false;
  bound = true;
  inserted.length = 0;
  puts.length = 0;
  deletes.length = 0;
});

describe("gallery upload route", () => {
  it("refuses anyone who is not an admin, before touching storage", async () => {
    who = "nobody";
    expect((await upload({ gallery_id: G, files: jpeg(10) })).status).toBe(401);
    who = "visitor";
    expect((await upload({ gallery_id: G, files: jpeg(10) })).status).toBe(403);
    expect(puts).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it("refuses a gallery id that is not an id, so it can never steer the key", async () => {
    for (const id of ["", "x", "../other", `${G}/..`]) {
      expect((await upload({ gallery_id: id, files: jpeg(10) })).status).toBe(400);
    }
    expect(puts).toHaveLength(0);
  });

  it("takes one photo per upload, and only a photo", async () => {
    expect((await upload({ gallery_id: G })).status).toBe(400);
    expect((await upload({ gallery_id: G, files: [jpeg(10), jpeg(10)] })).status).toBe(400);
    const text = new File(["<svg/>"], "x.svg", { type: "image/svg+xml" });
    expect((await upload({ gallery_id: G, files: text })).status).toBe(400);
    expect(puts).toHaveLength(0);
  });

  it("puts the photo and its copies in R2, cached for good, then saves the row", async () => {
    const res = await upload({
      gallery_id: G,
      files: jpeg(1000),
      md: jpeg(300, "md.jpg"),
      sm: jpeg(50, "sm.jpg"),
      width: "1152",
      height: "2048",
      taken_at: "2026-10-31T21:15:00+02:00",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploaded).toBe(1);

    const path = body.photos[0].storage_path as string;
    expect(path).toMatch(new RegExp(`^galleries/${G}/\\d+-[0-9a-f]{8}\\.jpg$`));
    expect(puts.map((p) => [p.key, p.bytes]).sort()).toEqual(
      [[path, 1000], [`md/${path}`, 300], [`sm/${path}`, 50]].sort()
    );
    for (const p of puts) {
      expect(p.contentType).toBe("image/jpeg");
      expect(p.cacheControl).toBe(PHOTO_CACHE_CONTROL);
    }
    expect(inserted[0]).toMatchObject({
      gallery_id: G,
      storage_path: path,
      storage: "r2",
      width: 1152,
      height: 2048,
    });
    expect(inserted[0].taken_at).toBe("2026-10-31T19:15:00.000Z");
    expect(deletes).toHaveLength(0);
  });

  it("uses the photo itself when the phone could not make the copies", async () => {
    const res = await upload({ gallery_id: G, files: jpeg(800) });
    expect(res.status).toBe(200);
    expect(puts.map((p) => p.bytes)).toEqual([800, 800, 800]);
  });

  it("ignores a copy that is not a JPEG", async () => {
    const png = new File([new Uint8Array(70)], "sm.png", { type: "image/png" });
    await upload({ gallery_id: G, files: jpeg(800), md: jpeg(300), sm: png });
    const sm = puts.find((p) => p.key.startsWith("sm/"));
    expect(sm?.bytes).toBe(800);
  });

  it("takes the files back out when the row cannot be saved", async () => {
    insertError = { message: "insert or update on table violates foreign key constraint" };
    const res = await upload({ gallery_id: G, files: jpeg(100), md: jpeg(30), sm: jpeg(10) });
    expect(res.status).toBe(500);
    const path = inserted[0].storage_path as string;
    expect(deletes).toEqual([[path, `md/${path}`, `sm/${path}`]]);
  });

  it("saves no row when R2 refuses a file, and clears what did land", async () => {
    putFails = true;
    const res = await upload({ gallery_id: G, files: jpeg(100), md: jpeg(30), sm: jpeg(10) });
    expect(res.status).toBe(502);
    expect(inserted).toHaveLength(0);
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toHaveLength(3);
  });

  it("says so when the Worker has no bucket bound", async () => {
    bound = false;
    expect((await upload({ gallery_id: G, files: jpeg(10) })).status).toBe(503);
    expect(inserted).toHaveLength(0);
  });
});
