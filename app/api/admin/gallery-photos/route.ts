import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sortPhotos } from "@/lib/photo-order";
import { photoBucket } from "@/lib/photo-bucket";
import { isOnR2, photoKeys, photoSources, type StoredPhoto } from "@/lib/photo-storage";

/**
 * The photos in one gallery, for the admin.
 *
 *   GET     ?gallery_id=<uuid>   every photo, in capture order (lib/photo-order.ts)
 *   DELETE  { ids: uuid[] }      removes the rows and their files in storage
 *
 * Admins only. RLS agrees: "Admins manage photos" on gallery_photos and
 * "Admins delete gallery-photos" on storage.objects. Files on R2 go through
 * the Worker's PHOTOS binding (lib/photo-storage.ts).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DELETE = 500;
/** R2 deletes at most 1,000 keys a call. Three keys a photo, so whole photos. */
const R2_DELETE_BATCH = 999;

type PhotoRow = StoredPhoto & { id: string; created_at: string; thumbnail_path?: string | null };

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null as Awaited<ReturnType<typeof createClient>>, ok: false };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, ok: profile?.role === "admin" };
}

export async function GET(request: NextRequest) {
  const { supabase, ok } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const galleryId = request.nextUrl.searchParams.get("gallery_id") || "";
  if (!UUID_RE.test(galleryId)) return NextResponse.json({ error: "gallery_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("gallery_photos")
    .select("*")
    .eq("gallery_id", galleryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bucket = supabase.storage.from("gallery-photos");
  return NextResponse.json(
    sortPhotos((data as PhotoRow[]) || []).map((p) => {
      const legacy = () => bucket.getPublicUrl(p.storage_path).data.publicUrl;
      if (!isOnR2(p)) return { id: p.id, url: legacy(), full: legacy() };
      const s = photoSources(p, legacy);
      return { id: p.id, url: s.src, full: s.full };
    })
  );
}

export async function DELETE(request: NextRequest) {
  const { supabase, ok } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const ids: unknown = body.ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_DELETE ||
    !ids.every((id) => typeof id === "string" && UUID_RE.test(id))
  ) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const { data: rows, error: readErr } = await supabase
    .from("gallery_photos")
    .select("*")
    .in("id", ids);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const found = (rows as PhotoRow[]) || [];
  if (found.length === 0) return NextResponse.json({ deleted: 0 });

  const { error: delErr } = await supabase
    .from("gallery_photos")
    .delete()
    .in(
      "id",
      found.map((r) => r.id)
    );
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // The rows are gone, so the photos are off the gallery. The files still
  // load from a direct link until they go too, so a failed remove is
  // reported to the admin rather than only logged.
  let filesRemoved = true;

  // R2 for every row, not only the ones marked r2: scripts/move-photos-to-r2.mjs
  // copies a photo before it flips the row, so a row still marked supabase
  // can already have public copies. Deleting a key that is not there is a
  // no-op. R2 takes at most 1,000 keys a call, so 333 photos at a time.
  const r2Keys = found.flatMap((r) => photoKeys(r.storage_path));
  const r2 = photoBucket();
  try {
    if (!r2) throw new Error("PHOTOS binding missing");
    for (let i = 0; i < r2Keys.length; i += R2_DELETE_BATCH) {
      await r2.delete(r2Keys.slice(i, i + R2_DELETE_BATCH));
    }
  } catch (err) {
    filesRemoved = false;
    console.error("[admin/gallery-photos] R2 delete failed:", err);
  }

  // Photos still in the Supabase bucket, from before the move to R2. Their
  // copies stay there as a backup after a move, so these go too.
  const paths = found
    .flatMap((r) => [r.storage_path, r.thumbnail_path])
    .filter(Boolean) as string[];
  const { error: rmErr } = await supabase.storage.from("gallery-photos").remove(paths);
  if (rmErr) {
    filesRemoved = false;
    console.error("[admin/gallery-photos] storage remove failed:", rmErr.message);
  }

  return NextResponse.json({ deleted: found.length, files_removed: filesRemoved });
}
