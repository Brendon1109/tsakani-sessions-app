import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/captcha";
import { sendOrderConfirmation, sendAdminOrderAlert } from "@/lib/email";

interface ClientOrderItem {
  product_id: string;
  size: string;
  color: string;
  qty: number;
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
    captcha_token,
  } = body as {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    items: ClientOrderItem[];
    captcha_token?: string;
  };

  if (!customer_name || !customer_phone || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // CAPTCHA verification (if configured)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const captchaOk = await verifyTurnstile(captcha_token, ip);
  if (!captchaOk) {
    return NextResponse.json({ error: "CAPTCHA failed" }, { status: 400 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  // Validate product IDs and look up authoritative prices from DB
  const productIds = Array.from(new Set(items.map((i) => i.product_id)));
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price_zar, is_active, sizes, colors")
    .in("id", productIds);

  if (productsError || !products) {
    return NextResponse.json({ error: "Failed to validate products" }, { status: 500 });
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Build authoritative items from DB prices
  const validated: {
    product_id: string;
    name: string;
    size: string;
    color: string;
    qty: number;
    price: number;
  }[] = [];
  let total_zar = 0;

  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product || !product.is_active) {
      return NextResponse.json(
        { error: `Product ${item.product_id} unavailable` },
        { status: 400 }
      );
    }
    if (!product.sizes.includes(item.size)) {
      return NextResponse.json({ error: `Invalid size: ${item.size}` }, { status: 400 });
    }
    if (!product.colors.includes(item.color)) {
      return NextResponse.json({ error: `Invalid color: ${item.color}` }, { status: 400 });
    }
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 50) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    const priceInRand = product.price_zar / 100;
    validated.push({
      product_id: item.product_id,
      name: product.name,
      size: item.size,
      color: item.color,
      qty: item.qty,
      price: priceInRand,
    });
    total_zar += product.price_zar * item.qty;
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      items: validated,
      total_zar,
      status: "pending",
      payment_method: "whatsapp",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget email notifications
  const summary = validated
    .map((v) => `${v.name} (${v.size}, ${v.color}) x${v.qty} — R${v.price * v.qty}`)
    .join("\n");

  Promise.all([
    customer_email
      ? sendOrderConfirmation({
          to: customer_email,
          customerName: customer_name,
          items: validated,
          total: total_zar / 100,
          orderId: data.id,
        })
      : Promise.resolve(false),
    sendAdminOrderAlert({
      type: "merch",
      customerName: customer_name,
      customerPhone: customer_phone,
      customerEmail: customer_email,
      summary,
      total: total_zar / 100,
      orderId: data.id,
    }),
  ]).catch(() => {});

  return NextResponse.json({ ...data, validated_total_zar: total_zar });
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
