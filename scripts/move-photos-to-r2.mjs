#!/usr/bin/env node
/**
 * Moves gallery photos from the Supabase bucket gallery-photos to the R2
 * bucket tsakani-photos (lib/photo-storage.ts). Written 2 November 2026.
 *
 * For every gallery_photos row still on 'supabase': download the photo, make
 * its md and sm copies with sharp, and put all three in R2. With --flip it
 * then checks all three answer on photos.tsakanisessions.co.za and only then
 * sets the row to 'r2', filling in width and height where they are missing.
 * The Supabase copy stays as a backup. Safe to re-run, a moved row is skipped.
 *
 *   SUPABASE_ACCESS_TOKEN=... CLOUDFLARE_API_TOKEN=... node scripts/move-photos-to-r2.mjs [--flip]
 *
 * SUPABASE_ACCESS_TOKEN is a personal access token for the Management API.
 * CLOUDFLARE_API_TOKEN needs R2 write on the personal account, and the
 * wrangler login's token works (run `npx wrangler whoami` first to refresh it).
 * sharp is already in node_modules as a dependency of next.
 */
import sharp from "sharp";

const PROJECT = "gryssobrndqukwnjyosf";
const SUPABASE_URL = `https://${PROJECT}.supabase.co`;
const ACCOUNT = "def57486f42c3f50263d4ae8edf11cd0";
const BUCKET = "tsakani-photos";
const PHOTOS_ORIGIN = "https://photos.tsakanisessions.co.za";
const SM_WIDTH = 480;
const MD_WIDTH = 1200;
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const PARALLEL = 4;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const flip = process.argv.includes("--flip");
const sbToken = process.env.SUPABASE_ACCESS_TOKEN;
const cfToken = process.env.CLOUDFLARE_API_TOKEN;
if (!sbToken || !cfToken) {
  console.error("Set SUPABASE_ACCESS_TOKEN and CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const enc = (key) => key.split("/").map(encodeURIComponent).join("/");
const int = (n) => (Number.isInteger(n) && n > 0 && n <= 20000 ? String(n) : "null");

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sbToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`SQL failed ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function put(key, body, contentType) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects/${enc(key)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": contentType, "Cache-Control": CACHE_CONTROL },
      body,
    }
  );
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(`R2 put ${key}: ${res.status} ${JSON.stringify(j?.errors)}`);
  if (Number(j.result?.size) !== body.length) {
    throw new Error(`R2 put ${key} stored ${j.result?.size} of ${body.length} bytes`);
  }
}

/** Does the public address serve this image, at this size? */
async function answers(key, bytes) {
  const res = await fetch(`${PHOTOS_ORIGIN}/${enc(key)}`, { method: "HEAD" });
  return (
    res.ok &&
    Number(res.headers.get("content-length")) === bytes &&
    (res.headers.get("content-type") || "").startsWith("image/")
  );
}

async function inParallel(items, n, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

const rows = await sql(
  "select id, storage_path, width, height from public.gallery_photos where storage = 'supabase' order by created_at"
);
console.log(`${rows.length} photos still on Supabase, ${flip ? "moving and flipping" : "copying only"}`);

const copied = [];
const failed = [];

await inParallel(rows, PARALLEL, async (row) => {
  try {
    if (!UUID_RE.test(row.id)) throw new Error("bad id");
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/gallery-photos/${enc(row.storage_path)}`);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const photo = Buffer.from(await res.arrayBuffer());
    const contentType = (res.headers.get("content-type") || "").startsWith("image/")
      ? res.headers.get("content-type")
      : "image/jpeg";

    // The size the photo shows at, after any EXIF turn.
    const meta = await sharp(photo).metadata();
    const turned = (meta.orientation || 1) >= 5;
    const w = turned ? meta.height : meta.width;
    const h = turned ? meta.width : meta.height;

    const copy = (width, quality) =>
      sharp(photo).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
    const [md, sm] = await Promise.all([copy(MD_WIDTH, 82), copy(SM_WIDTH, 78)]);

    await Promise.all([
      put(row.storage_path, photo, contentType),
      put(`md/${row.storage_path}`, md, "image/jpeg"),
      put(`sm/${row.storage_path}`, sm, "image/jpeg"),
    ]);
    copied.push({ id: row.id, path: row.storage_path, w, h, bytes: [photo.length, md.length, sm.length] });
    process.stdout.write(".");
  } catch (err) {
    failed.push({ id: row.id, path: row.storage_path, error: String(err?.message || err) });
    process.stdout.write("x");
  }
});

const mb = (i) => (copied.reduce((s, c) => s + c.bytes[i], 0) / 1024 / 1024).toFixed(1);
console.log(`\ncopied ${copied.length}: photos ${mb(0)} MB, md ${mb(1)} MB, sm ${mb(2)} MB`);

if (flip && copied.length > 0) {
  const ready = [];
  await inParallel(copied, 8, async (c) => {
    const ok =
      (await answers(c.path, c.bytes[0])) &&
      (await answers(`md/${c.path}`, c.bytes[1])) &&
      (await answers(`sm/${c.path}`, c.bytes[2]));
    if (ok) ready.push(c);
    else failed.push({ id: c.id, path: c.path, error: "not served on the public address" });
  });
  if (ready.length > 0) {
    const values = ready.map((c) => `('${c.id}'::uuid, ${int(c.w)}::int, ${int(c.h)}::int)`).join(",\n");
    const flipped = await sql(`
      update public.gallery_photos g
         set storage = 'r2',
             width = coalesce(g.width, v.w),
             height = coalesce(g.height, v.h)
        from (values ${values}) as v(id, w, h)
       where g.id = v.id and g.storage = 'supabase'
   returning g.id`);
    console.log(`flipped ${flipped.length} rows to r2`);
  }
}

if (failed.length > 0) {
  console.log(`${failed.length} failed:`);
  for (const f of failed) console.log(`  ${f.path}: ${f.error}`);
  process.exitCode = 1;
}
