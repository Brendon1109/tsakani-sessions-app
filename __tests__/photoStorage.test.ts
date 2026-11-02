import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  PHOTOS_ORIGIN,
  MD_WIDTH,
  SM_WIDTH,
  isOnR2,
  photoKeys,
  photoSources,
} from "@/lib/photo-storage";
import { downscaleSteps } from "@/lib/image-optimize";
import { rowSizes } from "@/app/gallery/[slug]/PhotoGrid";

/**
 * Gallery photos on R2 (lib/photo-storage.ts): the keys, the addresses the
 * site shows them at, and the photos still on Supabase keeping their old ones.
 */

const PATH = "galleries/11111111-1111-4111-8111-111111111111/1793588500346-ggj411k6wzj.jpg";
const legacy = () => `https://x.supabase.co/storage/v1/object/public/gallery-photos/${PATH}`;

describe("photo keys", () => {
  it("are the photo and its md and sm copies", () => {
    expect(photoKeys(PATH)).toEqual([PATH, `md/${PATH}`, `sm/${PATH}`]);
  });

  it("only rows marked r2 are on R2", () => {
    expect(isOnR2({ storage: "r2" })).toBe(true);
    expect(isOnR2({ storage: "supabase" })).toBe(false);
    expect(isOnR2({ storage: null })).toBe(false);
    expect(isOnR2({})).toBe(false);
  });
});

describe("photoSources", () => {
  it("serves an R2 photo straight from the photos domain, never through the Worker", () => {
    const s = photoSources({ storage_path: PATH, storage: "r2", width: 1536 }, () => {
      throw new Error("an R2 photo never asks for its Supabase address");
    });
    expect(s.src).toBe(`${PHOTOS_ORIGIN}/sm/${PATH}`);
    expect(s.srcSet).toBe(`${PHOTOS_ORIGIN}/sm/${PATH} ${SM_WIDTH}w, ${PHOTOS_ORIGIN}/md/${PATH} ${MD_WIDTH}w`);
    expect(s.bigSrcSet).toBe(`${s.srcSet}, ${PHOTOS_ORIGIN}/${PATH} 1536w`);
    expect(s.full).toBe(`${PHOTOS_ORIGIN}/${PATH}`);
    for (const url of [s.src, s.srcSet, s.bigSrcSet, s.full, s.download]) {
      expect(url).not.toContain("/_next/image");
      expect(url).not.toContain("supabase");
    }
  });

  it("Save fetches its own address, so a cached copy without CORS can never answer it", () => {
    const s = photoSources({ storage_path: PATH, storage: "r2" }, legacy);
    expect(s.download).toBe(`${PHOTOS_ORIGIN}/${PATH}?dl=1`);
    expect(s.download).not.toBe(s.full);
  });

  it("guesses the full photo at 2048 wide when the row has no width", () => {
    const s = photoSources({ storage_path: PATH, storage: "r2", width: null }, legacy);
    expect(s.bigSrcSet.endsWith(`${PHOTOS_ORIGIN}/${PATH} 2048w`)).toBe(true);
  });

  it("encodes each part of a key, and keeps the slashes", () => {
    const s = photoSources({ storage_path: "galleries/g/my photo#1.jpg", storage: "r2" }, legacy);
    expect(s.full).toBe(`${PHOTOS_ORIGIN}/galleries/g/my%20photo%231.jpg`);
  });

  it("keeps a photo still on Supabase on its old address, resized by next/image", () => {
    const s = photoSources({ storage_path: PATH, storage: "supabase" }, legacy);
    expect(s.full).toBe(legacy());
    expect(s.download).toBe(legacy());
    expect(s.src).toBe(`/_next/image?url=${encodeURIComponent(legacy())}&w=640&q=75`);
    expect(s.srcSet).toContain("&w=1200&q=75 1200w");
    expect(s.bigSrcSet).toContain("&w=1920&q=75 1920w");
  });

  it("the CSP allows the photos domain, for showing and for Save", () => {
    const config = readFileSync("next.config.mjs", "utf8");
    expect(config).toContain(`const PHOTOS_ORIGIN = "${PHOTOS_ORIGIN}"`);
    expect(config).toMatch(/img-src[^`]*\$\{PHOTOS_ORIGIN\}/);
    expect(config).toMatch(/connect-src[^`]*\$\{PHOTOS_ORIGIN\}/);
  });

  it("the Worker has the bucket bound as PHOTOS", () => {
    const wrangler = readFileSync("wrangler.jsonc", "utf8");
    expect(wrangler).toMatch(/"binding":\s*"PHOTOS",\s*"bucket_name":\s*"tsakani-photos"/);
  });
});

describe("making the smaller copies on the phone", () => {
  it("halves while it can, then draws once at the width", () => {
    expect(downscaleSteps(2048, MD_WIDTH)).toEqual([1200]);
    expect(downscaleSteps(1200, SM_WIDTH)).toEqual([600, 480]);
    expect(downscaleSteps(4000, SM_WIDTH)).toEqual([2000, 1000, 500, 480]);
    expect(downscaleSteps(960, SM_WIDTH)).toEqual([480]);
  });
});

describe("Rows view tile sizes", () => {
  it("tell the browser each tile's width at every row height, with room to grow", () => {
    expect(rowSizes(0.75)).toBe("(max-width: 639px) 104px, (max-width: 1023px) 160px, 207px");
    expect(rowSizes(1.5)).toBe("(max-width: 639px) 207px, (max-width: 1023px) 319px, 413px");
  });
});
