import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { sendUnsubscribeConfirmation } from "@/lib/email";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Turning consent off, proven by the token that only reached the subscriber's
 * own inbox.
 *
 * subscribe_newsletter is additive on purpose — it can turn a consent on but
 * never off — precisely so nobody can post a stranger's address and silence
 * them. This route is the other half of that bargain: the one path allowed to
 * write a false, and only for whoever is holding the token.
 */
async function unsubscribe(token: string) {
  if (!UUID.test(token)) {
    return { ok: false as const, status: 400, error: "That unsubscribe link isn't valid." };
  }

  const supabase = createClient();
  if (!supabase) return { ok: false as const, status: 503, error: "Not configured" };

  const { data, error } = await supabase.rpc("unsubscribe_newsletter", { p_token: token });

  if (error) {
    console.error("[newsletter] unsubscribe failed:", error.message);
    return { ok: false as const, status: 500, error: "Something went wrong. Please try again." };
  }

  const row = Array.isArray(data) ? data[0] : data;

  // No row means the token matched nobody. We do not distinguish that from
  // success in the error text — a stranger poking at tokens learns nothing about
  // which addresses are on the list.
  return { ok: true as const, email: row?.email ?? null };
}

/**
 * RFC 8058 one-click, used by the List-Unsubscribe-Post header. Gmail and Apple
 * Mail POST here when someone taps their client's own unsubscribe button, and
 * expect a 2xx. Honouring it properly is also what keeps our sending domain out
 * of the spam folder.
 */
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, "unsubscribe", 10, 60);
  if (limited) return limited;

  const url = new URL(request.url);
  let token = url.searchParams.get("token") || "";

  if (!token) {
    // The page form posts JSON; one-click posts a form body. Accept both.
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await request.json();
        token = typeof body?.token === "string" ? body.token : "";
      } else {
        const form = await request.formData();
        token = String(form.get("token") || "");
      }
    } catch {
      /* fall through to the invalid-token response */
    }
  }

  const result = await unsubscribe(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.email) {
    sendUnsubscribeConfirmation(result.email).catch(() => {});
  }

  return NextResponse.json({ success: true, email: result.email });
}

/**
 * Mail clients and security scanners follow links in emails to check them. A GET
 * here must therefore NOT unsubscribe anyone — a scanner would silently remove
 * people who never clicked. It only forwards to the page, which asks first.
 */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token") || "";
  return NextResponse.redirect(
    new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, request.url)
  );
}
