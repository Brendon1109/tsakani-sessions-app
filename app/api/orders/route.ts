import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/captcha";
import { sendOrderConfirmation, sendAdminOrderAlert } from "@/lib/email";
import type { EftDetails } from "@/lib/email";
import { buildPaystackUrl } from "@/lib/paystack";

/**
 * Merch checkout.
 *
 * The write goes through the create_merch_order function rather than a plain
 * insert. Two reasons, and the first one was a live bug: `.insert().select()`
 * compiles to INSERT ... RETURNING, and the only SELECT policy on orders is
 * `user_id = auth.uid()`, which a visitor does not have. Every checkout failed
 * on the read-back, which is why the orders table was empty. The same trap is
 * documented in supabase/create_ticket_order_fn.sql.
 *
 * Second, prices, sizes and colours are resolved inside that function from the
 * products table, so nothing a client posts about money is trusted here.
 */

interface ClientOrderItem {
  product_id: string;
  size?: string;
  color?: string;
  qty: number;
}

interface MerchOrderResult {
  order_id: string;
  total_zar: number;
  payment_reference: string;
  eft_enabled: boolean;
  account_holder: string | null;
  bank_name: string | null;
  account_number: string | null;
  branch_code: string | null;
  account_type: string | null;
  payment_email: string | null;
  eft_instructions: string | null;
  paystack_url: string | null;
  paystack_note: string | null;
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 orders per minute per IP
  const limited = await rateLimit(request, "orders", 5, 60);
  if (limited) return limited;

  const body = await request.json();
  const {
    customer_name,
    customer_phone,
    customer_email,
    items,
    payment_method,
    captcha_token,
  } = body as {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    items: ClientOrderItem[];
    payment_method?: string;
    captcha_token?: string;
  };

  if (!customer_name || !customer_phone || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const method =
    payment_method === "eft" || payment_method === "paystack"
      ? payment_method
      : "whatsapp";

  // CAPTCHA verification (if configured)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const captchaOk = await verifyTurnstile(captcha_token, ip);
  if (!captchaOk) {
    return NextResponse.json({ error: "CAPTCHA failed" }, { status: 400 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data, error } = await supabase.rpc("create_merch_order", {
    p_customer_name: customer_name,
    p_customer_phone: customer_phone,
    p_customer_email: customer_email || null,
    p_items: items.map((item) => ({
      product_id: item.product_id,
      size: item.size || "",
      color: item.color || "",
      qty: item.qty,
    })),
    p_payment_method: method,
  });

  if (error) {
    // 22023 is what the function raises for anything a buyer can fix by
    // changing their input, so that message is safe to show them. Anything
    // else is ours and stays generic.
    if (error.code === "22023") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not place the order" }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as MerchOrderResult | undefined;
  if (!row) {
    return NextResponse.json({ error: "Could not place the order" }, { status: 500 });
  }

  // The pay link is assembled here, server side, from the amount the database
  // just calculated. The browser never gets to say what it owes.
  const paystackUrl =
    method === "paystack" && row.paystack_url && customer_email
      ? buildPaystackUrl({
          baseUrl: row.paystack_url,
          amountCents: row.total_zar,
          email: customer_email,
          customerName: customer_name,
        })
      : null;

  const eft: EftDetails | null = row.eft_enabled
    ? {
        account_holder: row.account_holder,
        bank_name: row.bank_name,
        account_number: row.account_number,
        branch_code: row.branch_code,
        account_type: row.account_type,
        payment_email: row.payment_email,
        eft_instructions: row.eft_instructions,
        reference: row.payment_reference,
      }
    : null;

  // Names and prices for the emails come from the products table, not from the
  // client, so a tampered cart cannot put a fake price in a confirmation.
  const { data: storedProducts } = await supabase
    .from("products")
    .select("id, name, price_zar")
    .in("id", Array.from(new Set(items.map((i) => i.product_id))));

  const productById = new Map((storedProducts || []).map((p) => [p.id, p]));
  const emailItems = items.map((item) => {
    const product = productById.get(item.product_id);
    return {
      name: product?.name || "Item",
      size: item.size || "",
      color: item.color || "",
      qty: item.qty,
      // Per unit, in Rand, matching what the email template multiplies out.
      price: product ? product.price_zar / 100 : 0,
    };
  });

  const summary = emailItems
    .map(
      (item) =>
        `${item.name}${
          item.size || item.color
            ? ` (${[item.size, item.color].filter(Boolean).join(", ")})`
            : ""
        } x${item.qty} — R${(item.price * item.qty).toLocaleString("en-ZA")}`
    )
    .join("\n");

  // Fire-and-forget email notifications
  Promise.all([
    customer_email
      ? sendOrderConfirmation({
          to: customer_email,
          customerName: customer_name,
          items: emailItems,
          total: row.total_zar / 100,
          orderId: row.order_id,
          reference: row.payment_reference,
          eft,
          paystackUrl,
          paystackNote: row.paystack_note,
        })
      : Promise.resolve(false),
    sendAdminOrderAlert({
      type: "merch",
      customerName: customer_name,
      customerPhone: customer_phone,
      customerEmail: customer_email,
      summary: `${summary}\nPayment: ${method.toUpperCase()} — ref ${row.payment_reference}`,
      total: row.total_zar / 100,
      orderId: row.order_id,
    }),
  ]).catch(() => {});

  return NextResponse.json({
    id: row.order_id,
    total_zar: row.total_zar,
    validated_total_zar: row.total_zar,
    payment_method: method,
    payment_reference: row.payment_reference,
    eft,
    paystack_url: paystackUrl,
    paystack_note: row.paystack_note,
  });
}

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

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
