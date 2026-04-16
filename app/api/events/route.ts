import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
