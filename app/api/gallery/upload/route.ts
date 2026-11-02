import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cleanTakenAt } from "@/lib/photo-order";

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

  const formData = await request.formData();
  const galleryId = formData.get("gallery_id") as string;
  const files = formData.getAll("files") as File[];

  if (!galleryId || files.length === 0) {
    return NextResponse.json({ error: "gallery_id and files required" }, { status: 400 });
  }

  const uploaded: { storage_path: string; id: string }[] = [];
  // Sent by the admin uploader so the gallery can lay photos out at their
  // real shape. Ignored unless both are sane whole numbers.
  const dim = (k: string) => {
    const n = Number(formData.get(k));
    return Number.isInteger(n) && n > 0 && n <= 20000 ? n : null;
  };
  const width = dim("width");
  const height = dim("height");
  const takenAt = cleanTakenAt(formData.get("taken_at"));

  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `galleries/${galleryId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("gallery-photos")
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      continue;
    }

    const row: Record<string, unknown> = {
      gallery_id: galleryId,
      storage_path: path,
      sort_order: uploaded.length,
      ...(width && height && files.length === 1 ? { width, height } : {}),
    };
    let { data: record, error: dbError } = await supabase
      .from("gallery_photos")
      .insert(takenAt && files.length === 1 ? { ...row, taken_at: takenAt } : row)
      .select()
      .single();
    // Before supabase/photo_taken_at.sql runs there is no taken_at column.
    // Keep the photo rather than lose it, it just sorts by upload time.
    if (dbError && takenAt && /taken_at/.test(dbError.message)) {
      ({ data: record, error: dbError } = await supabase
        .from("gallery_photos")
        .insert(row)
        .select()
        .single());
    }

    if (!dbError && record) {
      uploaded.push({ storage_path: path, id: record.id });
    }
  }

  return NextResponse.json({
    uploaded: uploaded.length,
    total: files.length,
    photos: uploaded,
  });
}
