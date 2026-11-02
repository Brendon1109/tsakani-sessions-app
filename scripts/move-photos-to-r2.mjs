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
 *   SUPABASE_ACCESS_TOKEN=... CLOUDFLARE_API_TOKEN=... node scripts/move-photos-to-r2.mjs [--flip] [--gallery <slug>]
 *   SUPABASE_ACCESS_TOKEN=... CLOUDFLARE_API_TOKEN=... node scripts/move-photos-to-r2.mjs --sweep
 *
 * --sweep deletes every R2 object that belongs to no gallery_photos row, for
 * example the copies of a photo deleted after it was copied but before its
 * row was flipped. Run it after any interrupted move.
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
const R2_API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`;
const PHOTOS_ORIGIN = "https://photos.tsakanisessions.co.za";
const SM_WIDTH = 480;
const MD_WIDTH = 1200;
// The same as PHOTO_CACHE_CONTROL in lib/photo-storage.ts, see why there.
const CACHE_CONTROL = "public, max-age=3600";
// Only these are ever stored on the photos domain, never SVG or HTML.
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PARALLEL = 4;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const flip = process.argv.includes("--flip");
const sweep = process.argv.includes("--sweep");
// --gallery <slug> moves one gallery only, to try a small one first.
const gi = process.argv.indexOf("--gallery");
const gallery = gi > 0 ? process.argv[gi + 1] || "" : null;
if (gallery !== null && !/^[a-z0-9-]{1,100}$/.test(gallery)) {
  console.error("--gallery takes a gallery slug");
  process.exit(1);
}

const sbToken = process.env.SUPABASE_ACCESS_TOKEN;
const cfToken = process.env.CLOUDFLARE_API_TOKEN;
if (!sbToken || !cfToken) {
  console.error("Set SUPABASE_ACCESS_TOKEN and CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const enc = (key) => key.split("/").map(encodeURIComponent).join("/");
const int = (n) => (Number.isInteger(n) && n > 0 && n <= 20000 ? String(n) : "null");
const keysOf = (path) => [path, `md/${path}`, `sm/${path}`];

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sbToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(body)) throw new Error(`SQL failed ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function put(key, body, contentType) {
  const res = await fetch(`${R2_API}/${enc(key)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": contentType, "Cache-Control": CACHE_CONTROL },
    body,
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(`R2 put ${key}: ${res.status} ${JSON.stringify(j?.errors)}`);
  if (Number(j.result?.size) !== body.length) {
    throw new Error(`R2 put ${key} stored ${j.result?.size} of ${body.length} bytes`);
  }
}

async function remove(key) {
  const res = await fetch(`${R2_API}/${enc(key)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${cfToken}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete ${key}: ${res.status}`);
}

async function listKeys() {
  const keys = [];
  let cursor = "";
  do {
    const res = await fetch(`${R2_API}?per_page=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, {
      headers: { Authorization: `Bearer ${cfToken}` },
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) throw new Error(`R2 list: ${res.status} ${JSON.stringify(j?.errors)}`);
    keys.push(...j.result.map((o) => o.key));
    cursor = j.result_info?.is_truncated ? j.result_info.cursor : "";
  } while (cursor);
  return keys;
}

/** Does the public address serve this image, at this size? */
async function answers(key, bytes) {
  const res = await fetch(`${PHOTOS_ORIGIN}/${enc(key)}`, { method: "HEAD" });
  return (
    res.ok &&
    Number(res.headers.get("content-length")) === bytes &&
    PHOTO_TYPES.has((res.headers.get("content-type") || "").split(";")[0].trim())
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

if (sweep) {
  const rows = await sql("select storage_path from public.gallery_photos");
  if (rows.length === 0) {
    console.error("No gallery_photos rows came back, so nothing is swept. Check by hand.");
    process.exit(1);
  }
  const wanted = new Set(rows.flatMap((r) => keysOf(r.storage_path)));
  const orphans = (await listKeys()).filter((k) => !wanted.has(k));
  await inParallel(orphans, 8, remove);
  console.log(`swept ${orphans.length} R2 objects with no row${orphans.length ? `:\n  ${orphans.join("\n  ")}` : ""}`);
  process.exit(0);
}

const rows = await sql(
  `select p.id, p.storage_path, p.width, p.height
     from public.gallery_photos p join public.galleries g on g.id = p.gallery_id
    where p.storage = 'supabase'${gallery ? ` and g.slug = '${gallery}'` : ""}
    order by p.created_at`
);
console.log(
  `${rows.length} photos still on Supabase${gallery ? ` in ${gallery}` : ""}, ${flip ? "moving and flipping" : "copying only"}`
);

const copied = [];
const failed = [];

await inParallel(rows, PARALLEL, async (row) => {
  try {
    if (!UUID_RE.test(row.id)) throw new Error("bad id");
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/gallery-photos/${enc(row.storage_path)}`);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!PHOTO_TYPES.has(contentType)) throw new Error(`not a photo: ${contentType || "no type"}`);
    const photo = Buffer.from(await res.arrayBuffer());

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

    // A row deleted while this ran is not flipped, and its fresh copies
    // would stay public with nothing pointing at them. Take them back out.
    const done = new Set(flipped.map((r) => r.id));
    const missed = ready.filter((c) => !done.has(c.id));
    if (missed.length > 0) {
      const still = new Set(
        (await sql(`select id from public.gallery_photos where id in (${missed.map((c) => `'${c.id}'`).join(",")})`)).map(
          (r) => r.id
        )
      );
      const gone = missed.filter((c) => !still.has(c.id));
      await inParallel(gone.flatMap((c) => keysOf(c.path)), 8, remove);
      if (gone.length) console.log(`${gone.length} rows were deleted during the run, their R2 copies removed`);
      const other = missed.filter((c) => still.has(c.id));
      if (other.length) console.log(`${other.length} rows were already flipped by another run`);
    }
  }
}

if (failed.length > 0) {
  console.log(`${failed.length} failed:`);
  for (const f of failed) console.log(`  ${f.path}: ${f.error}`);
  process.exitCode = 1;
}
