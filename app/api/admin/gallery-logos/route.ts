import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * The logo library for branding gallery photos, see supabase/gallery_logos.sql.
 *
 *   GET     list, default first
 *   POST    multipart: file (PNG or WebP, up to 2 MB), name. Uploads to
 *           gallery-photos/branding/ and adds a row.
 *   PATCH   { id } makes that logo the default
 *   DELETE  { id } removes a logo that is not the default, and its file
 */

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/webp": "webp" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function GET() {
  const { supabase, ok } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("gallery_logos")
    .select("id, name, src, is_default")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const { supabase, ok } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const rawName = form?.get("name");
  if (!(file instanceof File)) return NextResponse.json({ error: "Pick a logo file" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use a PNG or WebP with a transparent background" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Keep the logo under 2 MB" }, { status: 400 });

  const name =
    (typeof rawName === "string" && rawName.trim().slice(0, 80)) ||
    file.name.replace(/\.[^/.]+$/, "").slice(0, 80) ||
    "Logo";

  const path = `branding/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("gallery-photos")
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const src = supabase.storage.from("gallery-photos").getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase
    .from("gallery_logos")
    .insert({ name, src, storage_path: path })
    .select("id, name, src, is_default")
    .single();
  if (error) {
    await supabase.storage.from("gallery-photos").remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const { supabase, ok } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json().catch(() => ({}));
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const { error } = await supabase.rpc("set_default_gallery_logo", { p_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { supabase, ok } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json().catch(() => ({}));
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const { data: logo } = await supabase
    .from("gallery_logos")
    .select("is_default, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!logo) return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  if (logo.is_default) {
    return NextResponse.json({ error: "Make another logo the default first" }, { status: 409 });
  }

  const { error } = await supabase.from("gallery_logos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (logo.storage_path) await supabase.storage.from("gallery-photos").remove([logo.storage_path]);
  return NextResponse.json({ ok: true });
}
