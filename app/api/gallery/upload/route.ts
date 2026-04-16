import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
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

    const { data: record, error: dbError } = await supabase
      .from("gallery_photos")
      .insert({
        gallery_id: galleryId,
        storage_path: path,
        sort_order: uploaded.length,
      })
      .select()
      .single();

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
