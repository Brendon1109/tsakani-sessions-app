import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { ticket_id, buyer_name, buyer_email, buyer_phone, quantity } = body;

  if (!ticket_id || !buyer_name || !buyer_email || !quantity) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createClient();

  // Get ticket info for pricing
  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticket_id)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: "Ticket type not found" }, { status: 404 });
  }

  if (ticket.quantity_sold + quantity > ticket.quantity_total) {
    return NextResponse.json({ error: "Not enough tickets available" }, { status: 400 });
  }

  const total_zar = ticket.price_zar * quantity;
  const qr_code = randomUUID();

  // Create ticket order
  const { data: order, error: orderError } = await supabase
    .from("ticket_orders")
    .insert({
      ticket_id,
      buyer_name,
      buyer_email,
      buyer_phone,
      quantity,
      total_zar,
      qr_code,
      status: "pending",
      payment_method: "whatsapp",
    })
    .select()
    .single();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  // Update sold count
  await supabase
    .from("tickets")
    .update({ quantity_sold: ticket.quantity_sold + quantity })
    .eq("id", ticket_id);

  return NextResponse.json(order);
}
