import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The footer signup and POPIA. Sharing an email with partners is its own
 * unticked box, so signing up alone must record share_partners false, only a
 * literal true from that box records true, and the box can never stand in for
 * the events or merch topics that a signup needs.
 */

const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: (...args: unknown[]) => rpc(...args) }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));
vi.mock("@/lib/captcha", () => ({ verifyTurnstile: async () => true }));
vi.mock("@/lib/email", () => ({ sendNewsletterWelcome: async () => true }));

import { POST } from "@/app/api/newsletter/route";

function signup(body: Record<string, unknown>) {
  return POST(
    new NextRequest("https://tsakanisessions.co.za/api/newsletter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const sharedWith = () => rpc.mock.calls[0][1].p_share_partners;

describe("POST /api/newsletter", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [{ unsubscribe_token: null }], error: null });
  });

  it("shares nothing when the partner box was not ticked", async () => {
    const res = await signup({ email: "a@example.com", consent_events: true });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "subscribe_newsletter",
      expect.objectContaining({ p_email: "a@example.com", p_consent_events: true, p_share_partners: false }),
    );
  });

  it("records partner sharing when the box was ticked", async () => {
    await signup({ email: "a@example.com", consent_merch: true, share_partners: true });
    expect(sharedWith()).toBe(true);
  });

  it("reads only a literal true as a yes", async () => {
    await signup({ email: "a@example.com", consent_events: true, share_partners: "true" });
    expect(sharedWith()).toBe(false);
  });

  it("does not let the partner box replace a topic", async () => {
    const res = await signup({ email: "a@example.com", share_partners: true });
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
