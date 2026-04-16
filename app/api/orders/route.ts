import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { customer_name, customer_phone, customer_email, items, total_zar } = body;

  if (!customer_name || !customer_phone || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_name,
      customer_phone,
      customer_email,
      items,
      total_zar,
      status: "pending",
      payment_method: "whatsapp",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
