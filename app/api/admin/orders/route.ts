import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null, email: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, email: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();
  return {
    supabase,
    user: profile?.role === "admin" ? user : null,
    email: profile?.email || null,
  };
}

export async function GET() {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_email, customer_phone, items, total_zar, status, payment_method, payment_reference, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * Move an order along. With EFT there is no gateway telling us the money
 * landed, so somebody checks the bank against the reference and marks it
 * confirmed here. That is the whole payment reconciliation step.
 */
export async function PATCH(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!ORDER_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      "id, customer_name, customer_email, customer_phone, items, total_zar, status, payment_method, payment_reference, created_at"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "order.status",
    resource_type: "order",
    resource_id: id,
    details: { status },
  });

  return NextResponse.json(data);
}
