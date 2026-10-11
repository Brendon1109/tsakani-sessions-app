import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * /api/track must never store a code. A ticket link is /ticket/<code> and the
 * code is the whole proof the ticket is yours. Every visit to a ticket page
 * used to write a working code into analytics_events. The path, every string
 * in the props and the referrer all have to come out clean, while ordinary
 * pages, slugs and product names stay readable.
 */

const inserted: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));

import { POST } from "@/app/api/track/route";

const CODE = "3f2b8c1e-9a4d-4c7e-8b1f-2d6a5e9c0b7a";

function beacon(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  inserted.length = 0;
});

describe("POST /api/track", () => {
  it("replaces the ticket code in a ticket page path", async () => {
    const res = await beacon({ event: "page_view", path: `/ticket/${CODE}`, session_id: "s1" });
    expect(res.status).toBe(204);
    expect(inserted[0].path).toBe("/ticket/[id]");
    expect(JSON.stringify(inserted[0])).not.toContain(CODE);
  });

  it("leaves ordinary pages alone", async () => {
    await beacon({ event: "page_view", path: "/events/iron-sharpens-iron" });
    await beacon({ event: "page_view", path: "/shop" });
    expect(inserted.map((r) => r.path)).toEqual(["/events/iron-sharpens-iron", "/shop"]);
  });

  it("stores no path rather than a made up one when none is sent", async () => {
    await beacon({ event: "page_view" });
    expect(inserted[0].path).toBeNull();
  });

  it("redacts a code anywhere in the props, and keeps the readable ones", async () => {
    await beacon({
      event: "ticket_buy_click",
      path: "/events/iron-sharpens-iron",
      props: {
        event: "iron-sharpens-iron",
        ticket: "Early Bird",
        price: 150,
        link: `https://tsakanisessions.co.za/ticket/${CODE}`,
        nested: { code: CODE, list: [CODE, "ok"] },
        [CODE]: true,
      },
    });
    const props = inserted[0].props as Record<string, unknown>;
    expect(JSON.stringify(props)).not.toContain(CODE);
    expect(props.event).toBe("iron-sharpens-iron");
    expect(props.ticket).toBe("Early Bird");
    expect(props.price).toBe(150);
    expect(props.link).toBe("https://tsakanisessions.co.za/ticket/[id]");
    expect(props.nested).toEqual({ code: "[id]", list: ["[id]", "ok"] });
    expect(props["[id]"]).toBe(true);
  });

  it("keeps only the host of a referrer, so a full link never lands in the table", async () => {
    await beacon({ event: "page_view", path: "/", referrer: "instagram.com" });
    await beacon({ event: "page_view", path: "/", referrer: `https://tsakanisessions.co.za/ticket/${CODE}?x=1` });
    await beacon({ event: "page_view", path: "/", referrer: "not a host at all" });
    expect(inserted.map((r) => r.referrer_host)).toEqual([
      "instagram.com",
      "tsakanisessions.co.za",
      null,
    ]);
  });

  it("keeps the random session id, which is not a code", async () => {
    await beacon({ event: "page_view", path: "/", session_id: CODE });
    expect(inserted[0].session_id).toBe(CODE);
  });
});
