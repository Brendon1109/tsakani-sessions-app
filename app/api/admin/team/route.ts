import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin() {
  const supabase = createClient();
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

  const [membersResult, tasksResult] = await Promise.all([
    supabase.from("team_members").select("*").eq("is_active", true).order("created_at"),
    supabase.from("team_tasks").select("*").order("due_date", { ascending: true }),
  ]);

  return NextResponse.json({
    members: membersResult.data || [],
    tasks: tasksResult.data || [],
  });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { type, ...data } = body;

  const table = type === "member" ? "team_members" : "team_tasks";
  const { data: result, error } = await supabase.from(table).insert(data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { type, id, ...updates } = body;
  const table = type === "member" ? "team_members" : "team_tasks";
  const { data, error } = await supabase.from(table).update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
