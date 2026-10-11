import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { DJ_PHOTO_BUCKET } from "@/lib/djs";

/**
 * DJ picture upload. Same bucket and same checks as the product upload, under
 * its own djs/ prefix. Hands back the storage path, which is what the djs row
 * stores, and the public URL for the preview.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  // An SVG announced as an image would serve back from our own origin and run
  // script, so the list is explicit rather than a startsWith("image/") check.
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Use a JPG, PNG, WebP or AVIF image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Max 8MB per photo" }, { status: 400 });
  }

  // The extension comes from the checked type, never the file name, so the
  // path always fits the shape supabase/djs.sql allows.
  const path = `djs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(DJ_PHOTO_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(DJ_PHOTO_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
