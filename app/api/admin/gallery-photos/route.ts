import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sortPhotos } from "@/lib/photo-order";

/**
 * The photos in one gallery, for the admin.
 *
 *   GET     ?gallery_id=<uuid>   every photo, in capture order (lib/photo-order.ts)
 *   DELETE  { ids: uuid[] }      removes the rows and their files in storage
 *
 * Admins only. RLS agrees: "Admins manage photos" on gallery_photos and
 * "Admins delete gallery-photos" on storage.objects.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DELETE = 500;

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
    sortPhotos((data as { id: string; storage_path: string; created_at: string }[]) || []).map((p) => ({
      id: p.id,
      url: bucket.getPublicUrl(p.storage_path).data.publicUrl,
    }))
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
    .select("id, storage_path, thumbnail_path")
    .in("id", ids);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const found = (rows as { id: string; storage_path: string; thumbnail_path: string | null }[]) || [];
  if (found.length === 0) return NextResponse.json({ deleted: 0 });

  const { error: delErr } = await supabase
    .from("gallery_photos")
    .delete()
    .in(
      "id",
      found.map((r) => r.id)
    );
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // The rows are gone, so the photos are off the site. A file left behind by
  // a failed remove only costs storage, never shows.
  const paths = found.flatMap((r) => [r.storage_path, r.thumbnail_path]).filter(Boolean) as string[];
  const { error: rmErr } = await supabase.storage.from("gallery-photos").remove(paths);
  if (rmErr) console.error("[admin/gallery-photos] storage remove failed:", rmErr.message);

  return NextResponse.json({ deleted: found.length, files_removed: !rmErr });
}
