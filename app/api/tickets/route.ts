import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/captcha";
import { sendAdminOrderAlert } from "@/lib/email";

/**
 * Creates a ticket order so we actually know WHO is coming.
 *
 * Everything goes through the create_ticket_order SECURITY DEFINER function.
 * We cannot insert-and-read-back directly: the only SELECT policy on
 * ticket_orders is `user_id = auth.uid()`, and a visitor has no auth.uid(), so
 * INSERT ... RETURNING (which is what .insert().select() compiles to) is
 * refused by RLS. The function does the write and hands back only the order it
 * just created, and it reserves the seats in the same transaction so a failure
 * cannot leave seats sold to nobody. See supabase/create_ticket_order_fn.sql.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 3 ticket orders per minute per IP
  const limited = await rateLimit(request, "tickets", 3, 60);
  if (limited) return limited;

  const body = await request.json();
  const { ticket_id, buyer_name, buyer_email, buyer_phone, quantity, captcha_token } = body;

  if (!ticket_id || !buyer_name || !buyer_email || !Number.isInteger(quantity)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (quantity < 1 || quantity > 20) {
    return NextResponse.json({ error: "Quantity must be 1-20" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const captchaOk = await verifyTurnstile(captcha_token, ip);
  if (!captchaOk) {
    return NextResponse.json({ error: "CAPTCHA failed" }, { status: 400 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  // Reserves the seats and writes the order atomically. Price is taken from the
  // database inside the function, so a tampered client price is ignored.
  const { data, error } = await supabase.rpc("create_ticket_order", {
    p_ticket_id: ticket_id,
    p_buyer_name: buyer_name,
    p_buyer_email: buyer_email,
    p_buyer_phone: buyer_phone || null,
    p_quantity: quantity,
  });

  const order = Array.isArray(data) ? data[0] : data;

  if (error || !order) {
    console.error("[tickets] order failed:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Not enough tickets available" },
      { status: 400 }
    );
  }

  // Tell the team someone is coming. Best effort, the order is already safe.
  sendAdminOrderAlert({
    type: "ticket",
    customerName: buyer_name,
    customerPhone: buyer_phone || "N/A",
    customerEmail: buyer_email,
    summary: `${quantity} x ${order.ticket_name} ticket(s)`,
    total: order.total_zar,
    orderId: order.order_id,
  }).catch(() => {});

  return NextResponse.json({
    order_id: order.order_id,
    qr_code: order.qr_code,
    total_zar: order.total_zar,
    ticket_name: order.ticket_name,
  });
}
