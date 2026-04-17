import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/captcha";

export async function POST(request: NextRequest) {
  // Rate limit: 3 signups per 10 min per IP
  const limited = await rateLimit(request, "newsletter", 3, 600);
  if (limited) return limited;

  const { email, captcha_token } = await request.json();

  if (!email || typeof email !== "string" || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const captchaOk = await verifyTurnstile(captcha_token, ip);
  if (!captchaOk) {
    return NextResponse.json({ error: "CAPTCHA failed" }, { status: 400 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      { email: email.toLowerCase().trim(), source: "website", is_active: true },
      { onConflict: "email" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
