import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { wantsUpdates } from "@/lib/signin-updates";
import { sendNewsletterWelcome } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = safeRedirectPath(searchParams.get("redirectTo"));

  if (code) {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.redirect(`${origin}/auth/signin?error=not_configured`);
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure profile exists
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!existingProfile) {
          await supabase.from("profiles").insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name,
            avatar_url: user.user_metadata?.avatar_url,
            role: "user",
          });
        }

        // Only when they ticked "updates" on the sign in screen, see
        // lib/signin-updates.ts. The address is the one Google just verified.
        // Best effort: a failure here must never block the sign in itself.
        if (wantsUpdates(searchParams) && user.email) {
          const email = user.email.toLowerCase().trim();
          const { data, error: subError } = await supabase.rpc("subscribe_newsletter", {
            p_email: email,
            p_consent_events: true,
            p_consent_merch: false,
            p_source: "signin",
            // No IP: the address Google verified plus consent_at is the record,
            // and the 11 October privacy notice stops storing newsletter IPs.
            p_consent_ip: null,
          });
          if (subError) {
            console.error("[signin] updates subscribe failed:", subError.message);
          } else {
            // Same rule as /api/newsletter: a token comes back only for someone
            // who was not already subscribed, so it doubles as "welcome them".
            const row = Array.isArray(data) ? data[0] : data;
            if (row?.unsubscribe_token) {
              const base = SITE_URL.replace(/\/+$/, "");
              const token = encodeURIComponent(row.unsubscribe_token);
              await sendNewsletterWelcome({
                to: email,
                consentEvents: true,
                consentMerch: false,
                unsubscribeUrl: `${base}/unsubscribe?token=${token}`,
                listUnsubscribeUrl: `${base}/api/newsletter/unsubscribe?token=${token}`,
              }).catch(() => {});
            }
          }
        }
      }

      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // Auth failed — redirect to sign in with error
  return NextResponse.redirect(`${origin}/auth/signin?error=auth_failed`);
}
