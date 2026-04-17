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

  const { data, error } = await supabase
    .from("galleries")
    .select("id, slug, title, event_id, event:events(title)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { id: string; slug: string; title: string; event_id: string | null; event: { title: string } | null };
  const normalized = ((data as unknown as Row[]) || []).map((g) => ({
    id: g.id,
    slug: g.slug,
    event_id: g.event_id,
    title: g.event?.title ? `${g.event.title} — ${g.title}` : g.title,
  }));

  return NextResponse.json(normalized);
}
