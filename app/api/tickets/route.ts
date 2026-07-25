import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/captcha";
import { sendAdminOrderAlert, sendTicketConfirmation } from "@/lib/email";
import { ticketQrPng, ticketUrl } from "@/lib/qr";
import { eventDateLong, eventTime } from "@/lib/date";

/**
 * Creates a ticket order so we actually know WHO is coming.
 *
 * Everything goes through the create_ticket_order SECURITY DEFINER function.
 * We cannot insert-and-read-back directly: the only SELECT policy on
 * ticket_orders is `user_id = auth.uid()`, and a visitor has no auth.uid(), so
 * INSERT ... RETURNING (which is what .insert().select() compiles to) is
 * refused by RLS. The function does the write and hands back only the order it
 * just created, and it reserves the seats in the same transaction so a failure
 * cannot leave seats sold to nobody. See supabase/create_ticket_order_fn.sql
 * and supabase/ticket_confirmation.sql.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 3 ticket orders per minute per IP
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
    birthday_month,
    birthday_day,
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

  // Reserves the seats and writes the order atomically. Price is taken from the
  // database inside the function, so a tampered client price is ignored.
  // The birthday is passed through, never judged here. Whether it earns the
  // package depends on the event's month and its own opt-out, and that decision
  // lives in the function so a crafted POST cannot talk its way into free
  // entry for five.
  const monthValue = Number(birthday_month);
  const dayValue = Number(birthday_day);
  const month =
    Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 12 ? monthValue : null;
  const day = Number.isInteger(dayValue) && dayValue >= 1 && dayValue <= 31 ? dayValue : null;

  const { data, error } = await supabase.rpc("create_ticket_order", {
    p_ticket_id: ticket_id,
    p_buyer_name: buyer_name,
    p_buyer_email: buyer_email,
    p_buyer_phone: buyer_phone || null,
    p_quantity: quantity,
    p_birthday_month: month,
    p_birthday_day: day,
  });

  const order = Array.isArray(data) ? data[0] : data;

  if (error || !order) {
    console.error("[tickets] order failed:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Not enough tickets available" },
      { status: 400 }
    );
  }

  const dateLabel = order.event_date
    ? `${eventDateLong(order.event_date)}, ${eventTime(order.event_date)}`
    : "Date to be confirmed";
  const url = ticketUrl(order.qr_code);

  // The buyer's own copy. This is the whole point of the flow: they leave with
  // something in writing instead of an open WhatsApp thread.
  //
  // Awaited, unlike the admin alert below, because the confirmation screen tells
  // the buyer whether the email is on its way. Promising an email that silently
  // failed is worse than saying it didn't send. A failure here still returns the
  // order — the seats are reserved either way and we never lose the sale over it.
  let emailed = false;
  try {
    const qrPng = await ticketQrPng(url).catch(() => null);
    emailed = await sendTicketConfirmation({
      // create_ticket_order does not hand back the email, so use what was
      // submitted. The database stored a lowercased, trimmed copy of this exact
      // value, so the two cannot disagree about who gets the ticket.
      to: String(buyer_email).trim(),
      buyerName: buyer_name,
      orderRef: order.order_ref,
      qrCode: order.qr_code,
      ticketName: order.ticket_name,
      quantity,
      totalZar: order.total_zar,
      eventTitle: order.event_title,
      eventDateLabel: dateLabel,
      venueName: order.venue_name,
      venueAddress: order.venue_address,
      paymentUrl: order.payment_url,
      paymentNote: order.payment_note,
      ticketUrl: url,
      qrPng,
    });
  } catch (err) {
    console.error("[tickets] confirmation email failed:", err);
  }

  // Tell the team someone is coming. Best effort, the order is already safe.
  sendAdminOrderAlert({
    type: "ticket",
    customerName: buyer_name,
    customerPhone: buyer_phone || "N/A",
    customerEmail: buyer_email,
    summary:
      `${quantity} x ${order.ticket_name} ticket(s)\n${order.event_title}\n${dateLabel}` +
      // Flagged in the alert the team already reads, because the two perks a
      // database cannot deliver — a table and a shout-out — need a person to
      // act before the night, not a report someone remembers to open.
      (order.is_birthday_vip
        ? `\n\n🎂 BIRTHDAY VIP — reserve a table for ${quantity} and give the DJ the name.`
        : ""),
    total: order.total_zar,
    orderId: order.order_ref || order.order_id,
  }).catch(() => {});

  return NextResponse.json({
    order_id: order.order_id,
    order_ref: order.order_ref,
    qr_code: order.qr_code,
    total_zar: order.total_zar,
    is_birthday_vip: order.is_birthday_vip ?? false,
    birthday_group: order.birthday_group ?? 5,
    ticket_name: order.ticket_name,
    event_title: order.event_title,
    event_date_label: dateLabel,
    venue_name: order.venue_name,
    venue_address: order.venue_address,
    payment_url: order.payment_url,
    payment_note: order.payment_note,
    ticket_url: url,
    emailed,
  });
}
