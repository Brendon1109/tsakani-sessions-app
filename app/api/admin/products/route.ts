import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

/**
 * Admin CRUD for merch.
 *
 * Prices cross this boundary in CENTS, the same unit the products table stores
 * and the same unit the shop divides by 100 to render. The admin form does the
 * Rand conversion on its side so there is exactly one place where the two units
 * meet, and it is not here.
 */

const CATEGORIES = ["tshirt", "hoodie", "hat", "cup", "accessory", "other"] as const;

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

/** Trimmed, de-duplicated, capped. Anything that is not a string is dropped. */
function cleanList(value: unknown, max = 20, maxLen = 40): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().slice(0, maxLen);
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

/** http(s) only. Empty becomes null so a cleared field really clears. */
function cleanUrl(value: unknown): string | null | { error: string } {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return { error: "Image must be a URL" };
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: `Not a valid image URL: ${trimmed.slice(0, 60)}` };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "Image URLs must start with http or https" };
  }
  return trimmed;
}

function cleanUrlList(value: unknown): string[] | { error: string } {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value.slice(0, 8)) {
    const cleaned = cleanUrl(raw);
    if (cleaned && typeof cleaned === "object") return cleaned;
    if (cleaned && !out.includes(cleaned)) out.push(cleaned);
  }
  return out;
}

interface ProductPayload {
  name: string;
  description: string | null;
  price_zar: number;
  category: string;
  image_url: string | null;
  images: string[];
  sizes: string[];
  colors: string[];
  in_stock: boolean;
  is_active: boolean;
  sort_order: number;
  color_images: Record<string, string>;
}

/**
 * Colour name to photo URL. Only colours the product actually offers are kept,
 * so removing a colour cannot leave an orphan photo behind that nothing can
 * reach but everything still ships to the browser.
 */
function cleanColorImages(
  value: unknown,
  colors: string[]
): { images: Record<string, string> } | { error: string } {
  // Wrapped in { images } rather than returned bare: a Record<string, string>
  // can structurally hold an "error" key, so `"error" in result` would not
  // narrow it and a colour literally named "error" would confuse the caller.
  if (!value || typeof value !== "object" || Array.isArray(value)) return { images: {} };
  const out: Record<string, string> = {};
  for (const [colour, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!colors.includes(colour)) continue;
    const cleaned = cleanUrl(raw);
    if (cleaned && typeof cleaned === "object") return cleaned;
    if (cleaned) out[colour] = cleaned;
  }
  return { images: out };
}

function buildPayload(body: Record<string, unknown>): ProductPayload | { error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "Name is required" };
  if (name.length > 120) return { error: "Name must be under 120 characters" };

  const price = Number(body.price_zar);
  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 0) {
    return { error: "Price must be a whole number of cents" };
  }
  if (price > 100_000_000) return { error: "That price looks wrong. Check the cents." };

  const category = typeof body.category === "string" ? body.category : "other";
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { error: `Category must be one of: ${CATEGORIES.join(", ")}` };
  }

  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, 2000)
      : null;

  const image = cleanUrl(body.image_url);
  if (image && typeof image === "object") return image;

  const images = cleanUrlList(body.images);
  if (!Array.isArray(images)) return images;

  const sortRaw = Number(body.sort_order);
  const sort_order = Number.isFinite(sortRaw) ? Math.trunc(sortRaw) : 0;

  const sizes = cleanList(body.sizes);
  const colors = cleanList(body.colors);

  const colorImages = cleanColorImages(body.color_images, colors);
  if ("error" in colorImages) return colorImages;

  return {
    name,
    description,
    price_zar: price,
    category,
    // Falling back to the first extra shot means a product uploaded through the
    // gallery strip alone still has a card image instead of the logo placeholder.
    image_url: image || images[0] || null,
    images,
    sizes,
    colors,
    in_stock: body.in_stock !== false,
    is_active: body.is_active !== false,
    sort_order,
    color_images: colorImages.images,
  };
}

export async function GET() {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Admins see inactive products too, which is the whole point of this page.
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = buildPayload(await request.json());
  if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: 400 });

  const { data, error } = await supabase
    .from("products")
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "product.create",
    resource_type: "product",
    resource_id: data.id,
    details: { name: payload.name, price_zar: payload.price_zar },
  });

  // /shop is cached for 5 minutes. Without this an admin adds a product, opens
  // the shop, does not see it, and reasonably concludes the save failed.
  revalidatePath("/shop");

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // A quick toggle from the list only sends the one flag it changed, so it must
  // not be forced through the full-product validation and lose everything else.
  const toggleKeys = ["is_active", "in_stock", "sort_order"];
  const sentKeys = Object.keys(body).filter((k) => k !== "id");
  const isToggle = sentKeys.length > 0 && sentKeys.every((k) => toggleKeys.includes(k));

  let updates: Record<string, unknown>;
  if (isToggle) {
    updates = {};
    if ("is_active" in body) updates.is_active = !!body.is_active;
    if ("in_stock" in body) updates.in_stock = !!body.in_stock;
    if ("sort_order" in body) {
      const n = Number(body.sort_order);
      updates.sort_order = Number.isFinite(n) ? Math.trunc(n) : 0;
    }
  } else {
    const payload = buildPayload(body);
    if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: 400 });
    updates = { ...payload };
  }

  const { data, error } = await supabase
    .from("products")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "product.update",
    resource_type: "product",
    resource_id: id,
    details: updates,
  });

  revalidatePath("/shop");

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "product.delete",
    resource_type: "product",
    resource_id: id,
  });

  revalidatePath("/shop");

  return NextResponse.json({ success: true });
}
