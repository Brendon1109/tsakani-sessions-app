import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildCallbackUrl, wantsUpdates } from "@/lib/signin-updates";

/**
 * Event updates are their own unticked choice at sign in (POPIA section 69).
 * Signing in alone must never subscribe anyone, and the tick must survive the
 * trip through Google and land as events consent with source "signin".
 */

const rpc = vi.fn();
const sendWelcome = vi.fn();
let user: { id: string; email: string | null } | null = { id: "u1", email: "Thandi@Example.com" };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async () => ({ error: null }),
      getUser: async () => ({ data: { user } }),
    },
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        single: async () => ({ data: { id: "u1" }, error: null }),
        insert: async () => ({ error: null }),
      };
      return q;
    },
    rpc: (...args: unknown[]) => rpc(...args),
  }),
}));

vi.mock("@/lib/email", () => ({
  sendNewsletterWelcome: (...args: unknown[]) => sendWelcome(...args),
}));

async function callback(query: string) {
  const { GET } = await import("@/app/auth/callback/route");
  return GET(new Request(`https://tsakanisessions.co.za/auth/callback?${query}`));
}

describe("the return URL", () => {
  it("carries updates=1 only when ticked", () => {
    expect(buildCallbackUrl("https://x.co.za", "/halloween", true)).toBe(
      "https://x.co.za/auth/callback?redirectTo=%2Fhalloween&updates=1",
    );
    expect(buildCallbackUrl("https://x.co.za", "/halloween", false)).toBe(
      "https://x.co.za/auth/callback?redirectTo=%2Fhalloween",
    );
  });

  it("never carries a redirect off the site", () => {
    expect(buildCallbackUrl("https://x.co.za", "//evil.example", false)).toBe(
      "https://x.co.za/auth/callback?redirectTo=%2F",
    );
  });

  it("reads only an exact 1 as a yes", () => {
    expect(wantsUpdates(new URLSearchParams("updates=1"))).toBe(true);
    expect(wantsUpdates(new URLSearchParams("updates=true"))).toBe(false);
    expect(wantsUpdates(new URLSearchParams(""))).toBe(false);
  });
});

describe("the sign in callback", () => {
  beforeEach(() => {
    rpc.mockReset();
    sendWelcome.mockReset();
    sendWelcome.mockResolvedValue(true);
    user = { id: "u1", email: "Thandi@Example.com" };
  });

  it("subscribes nobody when the box was not ticked", async () => {
    const res = await callback("code=abc&redirectTo=%2Fhalloween");
    expect(res.headers.get("location")).toBe("https://tsakanisessions.co.za/halloween");
    expect(rpc).not.toHaveBeenCalled();
    expect(sendWelcome).not.toHaveBeenCalled();
  });

  it("records events consent from the Google email when ticked, with no IP, and welcomes a new subscriber", async () => {
    rpc.mockResolvedValue({ data: [{ unsubscribe_token: "tok-1" }], error: null });
    const res = await callback("code=abc&redirectTo=%2Fhalloween&updates=1");
    expect(res.headers.get("location")).toBe("https://tsakanisessions.co.za/halloween");
    expect(rpc).toHaveBeenCalledWith("subscribe_newsletter", {
      p_email: "thandi@example.com",
      p_consent_events: true,
      p_consent_merch: false,
      p_source: "signin",
      p_consent_ip: null,
    });
    expect(sendWelcome).toHaveBeenCalledTimes(1);
    expect(sendWelcome.mock.calls[0][0]).toMatchObject({ to: "thandi@example.com", consentEvents: true });
  });

  it("sends no second welcome to someone already subscribed", async () => {
    rpc.mockResolvedValue({ data: [{ unsubscribe_token: null }], error: null });
    await callback("code=abc&updates=1");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(sendWelcome).not.toHaveBeenCalled();
  });

  it("still signs them in when the subscribe fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await callback("code=abc&redirectTo=%2Fhalloween&updates=1");
    expect(res.headers.get("location")).toBe("https://tsakanisessions.co.za/halloween");
    expect(sendWelcome).not.toHaveBeenCalled();
  });
});
