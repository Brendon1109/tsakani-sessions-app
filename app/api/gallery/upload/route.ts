import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cleanTakenAt } from "@/lib/photo-order";
import { photoBucket } from "@/lib/photo-bucket";
import { PHOTO_CACHE_CONTROL, photoKeys } from "@/lib/photo-storage";

/**
 * One gallery photo from the admin uploader, into R2 (lib/photo-storage.ts).
 *
 * Form fields: gallery_id, files (the photo), md and sm (its smaller copies,
 * made on the phone), width, height and taken_at. Admins only. The files go
 * to R2 first and the row last, so a photo is never listed before its files
 * exist, and a row that fails takes its files back out.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO = 15 * 1024 * 1024;
const MAX_COPY = 5 * 1024 * 1024;

function asBlob(v: FormDataEntryValue | null): Blob | null {
  return v && typeof v === "object" && typeof (v as Blob).arrayBuffer === "function" ? (v as Blob) : null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bucket = photoBucket();
  if (!bucket) return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });

  const formData = await request.formData().catch(() => null);
  const galleryId = String(formData?.get("gallery_id") || "");
  const files = formData?.getAll("files") || [];
  const file = files.length === 1 ? asBlob(files[0]) : null;
  if (!formData || !UUID_RE.test(galleryId) || !file) {
    return NextResponse.json({ error: "gallery_id and one photo required" }, { status: 400 });
  }
  const ext = PHOTO_TYPES[file.type];
  if (!ext || file.size === 0 || file.size > MAX_PHOTO) {
    return NextResponse.json({ error: "JPEG, PNG or WebP photos up to 15 MB" }, { status: 400 });
  }

  // Sent by the admin uploader so the gallery can lay photos out at their
  // real shape. Ignored unless both are sane whole numbers.
  const dim = (k: string) => {
    const n = Number(formData.get(k));
    return Number.isInteger(n) && n > 0 && n <= 20000 ? n : null;
  };
  const width = dim("width");
  const height = dim("height");
  const takenAt = cleanTakenAt(formData.get("taken_at"));

  // A phone that could not make the smaller copies still gets its photo up,
  // and the photo itself stands in for them.
  const copy = (k: string) => {
    const b = asBlob(formData.get(k));
    return b && b.type === "image/jpeg" && b.size > 0 && b.size <= MAX_COPY ? b : null;
  };
  const photo = await file.arrayBuffer();
  const md = copy("md");
  const sm = copy("sm");

  const path = `galleries/${galleryId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const [fullKey, mdKey, smKey] = photoKeys(path);
  const meta = (contentType: string) => ({ httpMetadata: { contentType, cacheControl: PHOTO_CACHE_CONTROL } });

  try {
    await Promise.all([
      bucket.put(fullKey, photo, meta(file.type)),
      bucket.put(mdKey, md ? await md.arrayBuffer() : photo.slice(0), meta(md ? "image/jpeg" : file.type)),
      bucket.put(smKey, sm ? await sm.arrayBuffer() : photo.slice(0), meta(sm ? "image/jpeg" : file.type)),
    ]);
  } catch (err) {
    console.error("[gallery/upload] R2 put failed:", err);
    await bucket.delete(photoKeys(path)).catch(() => {});
    return NextResponse.json({ error: "Could not store the photo" }, { status: 502 });
  }

  const { data: record, error: dbError } = await supabase
    .from("gallery_photos")
    .insert({
      gallery_id: galleryId,
      storage_path: path,
      storage: "r2",
      sort_order: 0,
      ...(width && height ? { width, height } : {}),
      ...(takenAt ? { taken_at: takenAt } : {}),
    })
    .select("id")
    .single();

  if (dbError || !record) {
    console.error("[gallery/upload] row insert failed:", dbError?.message);
    await bucket.delete(photoKeys(path)).catch(() => {});
    return NextResponse.json({ error: dbError?.message || "Could not save the photo" }, { status: 500 });
  }

  return NextResponse.json({
    uploaded: 1,
    total: 1,
    photos: [{ storage_path: path, id: record.id }],
  });
}
