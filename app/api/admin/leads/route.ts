import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Join gallery_views -> profiles -> galleries
  const { data, error } = await supabase
    .from("gallery_views")
    .select("viewed_at, user:profiles(email, full_name), gallery:galleries(title)")
    .order("viewed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    viewed_at: string;
    user: { email: string; full_name: string | null } | null;
    gallery: { title: string } | null;
  };

  // Dedupe by email (show latest view per user)
  const seenEmails = new Set<string>();
  const leads: {
    email: string;
    name: string | null;
    gallery_title: string;
    viewed_at: string;
  }[] = [];

  for (const row of (data as unknown as Row[]) || []) {
    if (!row.user?.email || seenEmails.has(row.user.email)) continue;
    seenEmails.add(row.user.email);
    leads.push({
      email: row.user.email,
      name: row.user.full_name,
      gallery_title: row.gallery?.title || "—",
      viewed_at: row.viewed_at,
    });
  }

  return NextResponse.json(leads);
}
