import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { isPaystackUrl } from "@/lib/paystack";

/**
 * The bank details EFT checkout pays into. One row, admin only.
 *
 * Nothing public reads this table. Buyers get the details back from
 * create_merch_order once their order exists, which keeps account numbers off
 * a public page where they can be scraped and reused in a fake invoice.
 *
 * Never log the account number into audit details for the same reason.
 */

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

function text(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

export async function GET() {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("store_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || { eft_enabled: false });
}

export async function PUT(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();

  const updates = {
    eft_enabled: !!body.eft_enabled,
    account_holder: text(body.account_holder, 120),
    bank_name: text(body.bank_name, 80),
    account_number: text(body.account_number, 40),
    branch_code: text(body.branch_code, 20),
    account_type: text(body.account_type, 40),
    payment_email: text(body.payment_email, 254),
    eft_instructions: text(body.eft_instructions, 1000),
    paystack_enabled: !!body.paystack_enabled,
    paystack_url: text(body.paystack_url, 500),
    paystack_note: text(body.paystack_note, 500),
    updated_at: new Date().toISOString(),
  };

  // Only Paystack's own hosts. This field is where buyers are sent to type card
  // details, so an admin account that got taken over must not be able to point
  // it at a lookalike page.
  if (updates.paystack_url && !isPaystackUrl(updates.paystack_url)) {
    return NextResponse.json(
      { error: "That is not a Paystack link. It must start with https:// and be on paystack.com or paystack.shop." },
      { status: 400 }
    );
  }

  if (updates.paystack_enabled && !updates.paystack_url) {
    return NextResponse.json(
      { error: "Paste your Paystack payment link before switching card payments on." },
      { status: 400 }
    );
  }

  // Switching EFT on with a blank account number would show buyers a payment
  // panel with nothing to pay into, so refuse rather than half-configure it.
  if (updates.eft_enabled) {
    const missing = (["account_holder", "bank_name", "account_number"] as const).filter(
      (key) => !updates[key]
    );
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error:
            "Fill in the account holder, bank and account number before switching EFT on.",
        },
        { status: 400 }
      );
    }
  }

  if (updates.payment_email && !updates.payment_email.includes("@")) {
    return NextResponse.json({ error: "Proof of payment email is not valid" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("store_settings")
    .upsert({ id: true, ...updates })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "store_settings.update",
    resource_type: "store_settings",
    // Deliberately no account number here.
    details: {
      eft_enabled: updates.eft_enabled,
      bank_name: updates.bank_name,
      paystack_enabled: updates.paystack_enabled,
    },
  });

  // The shop is cached and reads eft_available at render time, so switching EFT
  // on has to bust that cache or the button stays missing for five minutes.
  revalidatePath("/shop");

  return NextResponse.json(data);
}
