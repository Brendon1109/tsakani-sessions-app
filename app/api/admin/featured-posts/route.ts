import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { detectPlatform, fetchTikTokOEmbed } from "@/lib/social";

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, user: profile?.role === "admin" ? user : null };
}

export async function GET() {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("featured_posts")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { post_url, caption, sort_order, thumbnail_url: providedThumb } = body;

  if (!post_url) {
    return NextResponse.json({ error: "post_url required" }, { status: 400 });
  }

  const platform = detectPlatform(post_url);
  if (!platform) {
    return NextResponse.json({ error: "Unsupported URL" }, { status: 400 });
  }

  // Auto-fetch thumbnail for TikTok
  let thumbnail_url = providedThumb || null;
  let autoCaption = caption || null;

  if (platform === "tiktok" && !thumbnail_url) {
    const oembed = await fetchTikTokOEmbed(post_url);
    if (oembed) {
      thumbnail_url = oembed.thumbnail_url;
      if (!autoCaption) autoCaption = oembed.title;
    }
  }

  const { data, error } = await supabase
    .from("featured_posts")
    .insert({
      platform,
      post_url,
      thumbnail_url,
      caption: autoCaption,
      sort_order: sort_order ?? 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, ...updates } = await request.json();
  const { data, error } = await supabase
    .from("featured_posts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  const { error } = await supabase
    .from("featured_posts")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
