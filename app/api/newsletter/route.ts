import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/captcha";
import { sendNewsletterWelcome } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";

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

  // Goes through the subscribe_newsletter SECURITY DEFINER function, never a
  // direct insert or upsert. Visitors are anon and hold only an INSERT policy,
  // so a direct upsert (INSERT ... ON CONFLICT DO UPDATE) is rejected by RLS
  // even when nothing conflicts. That bug rejected every signup for weeks.
  //
  // The function owns the one narrow write we want. Consent is additive there,
  // so a subscriber who returns and ticks merch as well keeps events AND gains
  // merch, while nobody can resubmit someone else's address to strip it.
  // See supabase/subscribe_newsletter_fn.sql and supabase/ticket_confirmation.sql.
  const normalised = email.toLowerCase().trim();
  const { data, error } = await supabase.rpc("subscribe_newsletter", {
    p_email: normalised,
    p_consent_events: wantsEvents,
    p_consent_merch: wantsMerch,
    p_source: "website",
    p_consent_ip: ip || null,
  });

  if (error) {
    console.error("[newsletter] subscribe failed:", error.message);
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  // Confirm in writing, and show the way out in the same email.
  //
  // A token comes back only for an address that was not already an active
  // subscriber, so its presence IS the "welcome this person" signal. Someone who
  // submits the form twice in a row gets null and no second welcome, which is
  // both what we want and what stops the function handing an existing
  // subscriber's token to whoever asked. See supabase/ticket_confirmation.sql.
  //
  // Best effort: their subscription is already recorded, and a mail failure must
  // not tell them the signup didn't work.
  if (row?.unsubscribe_token) {
    // SITE_URL, not a bare env read: an empty base would emit a relative
    // List-Unsubscribe header, which is not a valid URI, so Gmail and Apple Mail
    // would drop the one-click button and the in-body link would be dead too.
    const base = SITE_URL.replace(/\/+$/, "");
    const token = encodeURIComponent(row.unsubscribe_token);
    sendNewsletterWelcome({
      to: normalised,
      consentEvents: wantsEvents,
      consentMerch: wantsMerch,
      unsubscribeUrl: `${base}/unsubscribe?token=${token}`,
      listUnsubscribeUrl: `${base}/api/newsletter/unsubscribe?token=${token}`,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
