import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/captcha";

export async function POST(request: NextRequest) {
  // Rate limit: 3 signups per 10 min per IP
  const limited = await rateLimit(request, "newsletter", 3, 600);
  if (limited) return limited;

  const { email, captcha_token, consent_events, consent_merch } = await request.json();

  if (!email || typeof email !== "string" || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const wantsEvents = consent_events === true;
  const wantsMerch = consent_merch === true;
  if (!wantsEvents && !wantsMerch) {
    return NextResponse.json(
      { error: "Tick at least one box so we know what to send you" },
      { status: 400 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const captchaOk = await verifyTurnstile(captcha_token, ip);
  if (!captchaOk) {
    return NextResponse.json({ error: "CAPTCHA failed" }, { status: 400 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  // Plain insert, NOT upsert. An upsert compiles to INSERT ... ON CONFLICT DO
  // UPDATE, and Postgres then demands an UPDATE policy even when the email is
  // brand new and nothing actually conflicts. Visitors are anon and only hold
  // the "Anyone can subscribe" INSERT policy, so every single signup was being
  // rejected with "new row violates row-level security policy". Giving anon an
  // UPDATE policy would be the wrong fix: it would let anyone rewrite another
  // person's consent flags. So we insert, and treat an existing email as a win.
  const { error } = await supabase.from("newsletter_subscribers").insert({
    email: email.toLowerCase().trim(),
    source: "website",
    is_active: true,
    consent_events: wantsEvents,
    consent_merch: wantsMerch,
    consent_at: new Date().toISOString(),
    consent_ip: ip || null,
  });

  // 23505 = unique violation, they are already on the list. That is a success
  // from the subscriber's point of view, so do not show them an error.
  if (error && error.code !== "23505") {
    console.error("[newsletter] insert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
