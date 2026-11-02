import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * /api/admin/galleries: only an admin creates or relinks a gallery, a new
 * gallery always starts hidden, its slug never collides, and the event link
 * takes a real id or nothing.
 */

type Who = "nobody" | "visitor" | "admin";
let who: Who = "admin";
let slugs: string[] = [];
const writes: { op: string; payload?: Record<string, unknown> }[] = [];

function query() {
  let op = "select";
  let payload: Record<string, unknown> | undefined;
  const run = () => {
    if (op === "insert" || op === "update") {
      writes.push({ op, payload });
      return { data: { id: "new-id" }, error: null };
    }
    return { data: slugs.map((slug) => ({ slug })), error: null };
  };
  const q = {
    select: () => q,
    insert: (p: Record<string, unknown>) => ((op = "insert"), (payload = p), q),
    update: (p: Record<string, unknown>) => ((op = "update"), (payload = p), q),
    eq: () => q,
    like: () => q,
    order: () => q,
    single: async () => run(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  };
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: who === "nobody" ? null : { id: who } },
      }),
    },
    from: (table: string) =>
      table === "profiles"
        ? {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { role: who === "admin" ? "admin" : "user" } }),
              }),
            }),
          }
        : query(),
  }),
}));

import { POST, PATCH } from "@/app/api/admin/galleries/route";

function json(method: string, body: unknown) {
  return new NextRequest("http://localhost/api/admin/galleries", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const EVENT = "3f2b8c1e-1d2a-4b5c-9e8f-0a1b2c3d4e5f";

beforeEach(() => {
  who = "admin";
  slugs = [];
  writes.length = 0;
});

describe("admin galleries route", () => {
  it("refuses anyone who is not an admin", async () => {
    for (const w of ["nobody", "visitor"] as Who[]) {
      who = w;
      expect((await POST(json("POST", { title: "X" }))).status).toBe(403);
      expect((await PATCH(json("PATCH", { id: "g", event_id: EVENT }))).status).toBe(403);
    }
    expect(writes).toHaveLength(0);
  });

  it("creates a hidden gallery linked to the event", async () => {
    const res = await POST(json("POST", { title: " Tsakani Halloween ", event_id: EVENT, is_public: true }));
    expect(res.status).toBe(200);
    expect(writes[0].payload).toEqual({
      title: "Tsakani Halloween",
      slug: "tsakani-halloween",
      event_id: EVENT,
      is_public: false,
    });
  });

  it("picks the next free slug", async () => {
    slugs = ["memories", "memories-2"];
    const body = await (await POST(json("POST", { title: "Memories" }))).json();
    expect(body.slug).toBe("memories-3");
  });

  it("needs a title and a real event id", async () => {
    expect((await POST(json("POST", { title: "  " }))).status).toBe(400);
    expect((await POST(json("POST", { title: "X", event_id: "nope" }))).status).toBe(400);
    expect((await PATCH(json("PATCH", { id: "g", event_id: "nope" }))).status).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it("links and unlinks an event", async () => {
    await PATCH(json("PATCH", { id: "g", event_id: EVENT }));
    await PATCH(json("PATCH", { id: "g", event_id: null }));
    expect(writes.map((w) => w.payload)).toEqual([{ event_id: EVENT }, { event_id: null }]);
  });
});
