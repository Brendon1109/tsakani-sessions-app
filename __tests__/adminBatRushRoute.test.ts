import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The auth boundary on /api/admin/halloween, both ways round. Nobody signed
 * in and a signed in visitor who is not an admin get a 403 on every method
 * and change nothing, because the GET returns players' Google names and
 * emails. An admin gets through, and the route's own rules hold: a round's
 * close is after its open, Close now opens the next round, and a handle can
 * be taken off the board.
 */

type Who = "nobody" | "visitor" | "admin";
let who: Who = "admin";
let tables: Record<string, Record<string, unknown>[]> = {};
const writes: { table: string; op: string; payload?: unknown; filters: [string, unknown][] }[] = [];

function query(table: string) {
  let op = "select";
  let payload: unknown;
  const filters: [string, unknown][] = [];
  const ins: [string, unknown[]][] = [];
  const run = () => {
    const rows = (tables[table] || []).filter(
      (r) => filters.every(([k, v]) => r[k] === v) && ins.every(([k, vs]) => vs.includes(r[k])),
    );
    if (op === "update") {
      writes.push({ table, op, payload, filters: [...filters] });
      return { data: rows.map((r) => ({ ...r, ...(payload as object) })), error: null };
    }
    if (op === "delete") {
      writes.push({ table, op, filters: [...filters] });
      return { data: rows, error: null };
    }
    return { data: rows, error: null };
  };
  const q = {
    select: () => q,
    update: (p: unknown) => ((op = "update"), (payload = p), q),
    delete: () => ((op = "delete"), q),
    eq: (k: string, v: unknown) => (filters.push([k, v]), q),
    in: (k: string, vs: unknown[]) => (ins.push([k, vs]), q),
    order: () => q,
    range: () => q,
    limit: () => q,
    single: async () => {
      const r = run();
      return { ...r, data: r.data[0] ?? null };
    },
    maybeSingle: async () => {
      const r = run();
      return { ...r, data: r.data[0] ?? null };
    },
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  };
  return q;
}

function fakeSupabase() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: who === "nobody" ? null : { id: who === "admin" ? "admin-id" : "visitor-id" } },
      }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { role: who === "admin" ? "admin" : "user", email: "x@example.com" },
              }),
            }),
          }),
        };
      }
      return query(table);
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeSupabase() }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));

import { GET, PATCH, POST, DELETE } from "@/app/api/admin/halloween/route";

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/halloween", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const iso = (offsetMin: number) => new Date(Date.now() + offsetMin * 60_000).toISOString();

beforeEach(() => {
  who = "admin";
  writes.length = 0;
  tables = {
    events: [{ id: "ev", slug: "hallowee-kani", title: "Tsakani Halloween", date: iso(60) }],
    bat_rush_rounds: [
      { id: "r1", event_id: "ev", name: "Round 1", opens_at: iso(-60), closes_at: iso(60), prize: null, winner_user_id: null },
      { id: "r2", event_id: "ev", name: "Round 2", opens_at: iso(60), closes_at: iso(180), prize: null, winner_user_id: null },
    ],
    bat_rush_players: [
      { event_id: "ev", user_id: "p1", display_name: "Amo K.", instagram_handle: "amo", show_handle: true, created_at: iso(-30), profiles: { email: "amo@example.com", full_name: "Amo K" } },
    ],
    bat_rush_scores: [{ id: 1, round_id: "r1", user_id: "p1", aura: 140, created_at: iso(-20) }],
  };
});

describe("Bat Rush admin route refuses anyone who is not an admin", () => {
  for (const visitor of ["nobody", "visitor"] as const) {
    it(`${visitor}: every method and action is refused and nothing is written`, async () => {
      who = visitor;
      const get = await GET(req("GET"));
      expect(get.status).toBe(403);
      expect(JSON.stringify(await get.json())).not.toContain("example.com");
      expect((await PATCH(req("PATCH", { id: "r1", opens_at: iso(-60), closes_at: iso(30) }))).status).toBe(403);
      expect((await POST(req("POST", { action: "close", id: "r1" }))).status).toBe(403);
      expect((await POST(req("POST", { action: "winner", round_id: "r1", user_id: "p1" }))).status).toBe(403);
      expect((await POST(req("POST", { action: "clear_handle", event_id: "ev", user_id: "p1" }))).status).toBe(403);
      expect((await DELETE(req("DELETE", { score_id: 1 }))).status).toBe(403);
      expect(writes).toHaveLength(0);
    });
  }
});

describe("Bat Rush admin route for an admin", () => {
  it("reads the event, its rounds, players with their Google details, and scores", async () => {
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.slug).toBe("hallowee-kani");
    expect(body.rounds).toHaveLength(2);
    expect(body.players[0].profiles.email).toBe("amo@example.com");
    expect(body.scores).toHaveLength(1);
  });

  it("refuses a round that closes before it opens, and saves a good one", async () => {
    const bad = await PATCH(req("PATCH", { id: "r1", opens_at: iso(10), closes_at: iso(5) }));
    expect(bad.status).toBe(400);
    expect(writes).toHaveLength(0);
    const good = await PATCH(req("PATCH", { id: "r1", opens_at: iso(-60), closes_at: iso(30), prize: "Free entry" }));
    expect(good.status).toBe(200);
    expect(writes[0]).toMatchObject({ table: "bat_rush_rounds", op: "update", payload: { prize: "Free entry" } });
  });

  it("Close now ends the open round and opens the next one", async () => {
    const res = await POST(req("POST", { action: "close", id: "r1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ closed: "Round 1", opened: "Round 2" });
    expect(writes.map((w) => [w.filters[0][1], Object.keys(w.payload as object).sort()])).toEqual([
      ["r1", ["closes_at", "updated_at"]],
      ["r2", ["opens_at", "updated_at"]],
    ]);
  });

  it("will not close a round that has not opened", async () => {
    expect((await POST(req("POST", { action: "close", id: "r2" }))).status).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it("marks a winner, clears a handle and deletes a score", async () => {
    expect((await POST(req("POST", { action: "winner", round_id: "r1", user_id: "p1" }))).status).toBe(200);
    expect((await POST(req("POST", { action: "clear_handle", event_id: "ev", user_id: "p1" }))).status).toBe(200);
    expect((await DELETE(req("DELETE", { score_id: 1 }))).status).toBe(200);
    expect(writes.map((w) => `${w.table}:${w.op}`)).toEqual([
      "bat_rush_rounds:update",
      "bat_rush_players:update",
      "bat_rush_scores:delete",
    ]);
    expect(writes[1].payload).toMatchObject({ instagram_handle: null, show_handle: false });
  });

  it("refuses an unknown action", async () => {
    expect((await POST(req("POST", { action: "drop_tables" }))).status).toBe(400);
    expect(writes).toHaveLength(0);
  });
});
