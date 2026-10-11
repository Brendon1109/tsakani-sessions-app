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

  it("catches a code in a mangled link: punctuation, spaces, escapes, braces or no dashes", async () => {
    const bare = CODE.replace(/-/g, "");
    const shapes = [
      `/ticket/${CODE})`,
      `/ticket/${CODE},`,
      `/ticket/${CODE};x`,
      `/ticket/${CODE}%20`,
      `/ticket/${CODE}%3E`,
      `/ticket/%E2%80%8B${CODE}`,
      `/ticket/%7B${CODE}%7D`,
      `/ticket/%33${CODE.slice(1)}`,
      `/ticket/${CODE.slice(0, 8)}%2D${CODE.slice(9)}`,
      `/ticket/${bare}`,
      `/ticket/${CODE}%zz`,
    ];
    for (const path of shapes) await beacon({ event: "page_view", path });
    for (const row of inserted) {
      expect(String(row.path)).not.toMatch(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i);
      expect(String(row.path)).toContain("[id]");
    }
  });

  it("catches a mangled code in props too", async () => {
    await beacon({ event: "x", path: "/", props: { note: `see ${CODE})`, [`k${CODE}`]: 1 } });
    expect(JSON.stringify(inserted[0].props)).not.toContain(CODE);
  });

  it("keeps empty strings as they are", async () => {
    await beacon({ event: "x", path: "/", props: { note: "" } });
    expect(inserted[0].props).toEqual({ note: "" });
  });

  it("drops props that are over the size cap, before or after redaction", async () => {
    await beacon({ event: "x", path: "/", props: { big: "a".repeat(2100) } });
    // Under 2000 as sent, over it once every short capability segment is [id].
    await beacon({ event: "x", path: "/", props: { grows: Array(300).fill("vo-") } });
    await beacon({ event: "x", path: "/", props: { fine: "a".repeat(100) } });
    expect(inserted.map((r) => Object.keys(r.props as object))).toEqual([[], [], ["fine"]]);
  });

  it("keeps the referrer's port with its host", async () => {
    await beacon({ event: "page_view", path: "/", referrer: "https://example.com:8443/a/b" });
    expect(inserted[0].referrer_host).toBe("example.com:8443");
  });

  it("keeps the random session id, which is not a code", async () => {
    await beacon({ event: "page_view", path: "/", session_id: CODE });
    expect(inserted[0].session_id).toBe(CODE);
  });
});
