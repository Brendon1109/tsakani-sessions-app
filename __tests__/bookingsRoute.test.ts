import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * /api/bookings with "Book this DJ". The browser sends a slug and the route
 * must look the DJ up itself: an unknown DJ is refused before anything is
 * written, and a real one is stored with the roster's own id and name, never
 * a name the request made up.
 */

const roster: Record<string, { id: string; name: string }> = {
  kendour: { id: "11111111-1111-4111-8111-111111111111", name: "KENDOUR" },
};
const inserted: Record<string, unknown>[] = [];
const alerts: Record<string, unknown>[] = [];
const lookedUp: string[] = [];

function fakeSupabase() {
  return {
    from(table: string) {
      if (table === "djs") {
        let slug = "";
        const query = {
          select: () => query,
          eq: (_col: string, value: string) => {
            slug = value;
            return query;
          },
          maybeSingle: async () => {
            lookedUp.push(slug);
            return { data: roster[slug] ?? null, error: null };
          },
        };
        return query;
      }
      if (table === "booking_enquiries") {
        return {
          insert: async (row: Record<string, unknown>) => {
            inserted.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeSupabase() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));
vi.mock("@/lib/email", () => ({
  sendAdminOrderAlert: async (payload: Record<string, unknown>) => {
    alerts.push(payload);
  },
}));

import { POST } from "@/app/api/bookings/route";

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const base = { name: "Thabo", email: "thabo@example.com", event_type: "DJ & Live Performance" };

beforeEach(() => {
  inserted.length = 0;
  alerts.length = 0;
  lookedUp.length = 0;
  delete process.env.TURNSTILE_SECRET_KEY;
});

describe("POST /api/bookings with a requested DJ", () => {
  it("rejects a DJ who is not on the roster and writes nothing", async () => {
    const res = await POST(request({ ...base, dj: "black-coffee" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not on the roster/);
    expect(inserted).toHaveLength(0);
  });

  it("rejects a malformed slug without a lookup", async () => {
    const res = await POST(request({ ...base, dj: "../KENDOUR" }));
    expect(res.status).toBe(400);
    expect(lookedUp).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it("stores the roster's id and name for a real DJ, whatever name the browser sends", async () => {
    const res = await POST(
      request({ ...base, dj: "kendour", requested_dj_name: "Somebody Else", requested_dj_id: "x" })
    );
    expect(res.status).toBe(200);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      requested_dj_id: roster.kendour.id,
      requested_dj_name: "KENDOUR",
    });
    expect(String(alerts[0]?.summary)).toContain("DJ: KENDOUR");
  });

  it("stores no DJ when none was asked for", async () => {
    const res = await POST(request(base));
    expect(res.status).toBe(200);
    expect(inserted[0]).toMatchObject({ requested_dj_id: null, requested_dj_name: null });
    expect(lookedUp).toHaveLength(0);
  });
});
