import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/captcha";
import { sendAdminOrderAlert } from "@/lib/email";

export async function POST(request: NextRequest) {
  // Rate limit: 3 ticket purchases per minute per IP
  const limited = await rateLimit(request, "tickets", 3, 60);
  if (limited) return limited;

  const body = await request.json();
  const {
    ticket_id,
    buyer_name,
    buyer_email,
    buyer_phone,
    quantity,
    captcha_token,
  } = body;

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

  // Atomic reservation via DB function (prevents race condition)
  const { data: ticket, error: reserveError } = await supabase.rpc("reserve_tickets", {
    p_ticket_id: ticket_id,
    p_quantity: quantity,
  });

  if (reserveError || !ticket) {
    return NextResponse.json(
      { error: reserveError?.message || "Not enough tickets available" },
      { status: 400 }
    );
  }

  // Price from DB, not from client
  const total_zar = ticket.price_zar * quantity;
  const qr_code = randomUUID();

  const { data: order, error: orderError } = await supabase
    .from("ticket_orders")
    .insert({
      ticket_id,
      buyer_name,
      buyer_email,
      buyer_phone: buyer_phone || null,
      quantity,
      total_zar,
      qr_code,
      status: "pending",
      payment_method: "whatsapp",
    })
    .select()
    .single();

  if (orderError) {
    // Rollback the reservation
    await supabase.rpc("release_tickets", {
      p_ticket_id: ticket_id,
      p_quantity: quantity,
    });
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  // Notify admin
  sendAdminOrderAlert({
    type: "ticket",
    customerName: buyer_name,
    customerPhone: buyer_phone || "N/A",
    customerEmail: buyer_email,
    summary: `${quantity} x ${ticket.name} ticket(s)`,
    total: total_zar / 100,
    orderId: order.id,
  }).catch(() => {});

  return NextResponse.json({ ...order, validated_total_zar: total_zar });
}
