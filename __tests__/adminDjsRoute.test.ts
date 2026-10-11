import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The auth boundary on /api/admin/djs and its upload route, both ways round:
 * nobody signed in and a signed in visitor who is not an admin get nothing
 * and change nothing, and an admin gets through. Plus the two things the
 * route owns beyond the database: the slug it derives, and refusing a save
 * from a form that went stale in another tab.
 */

type Who = "nobody" | "visitor" | "admin";
let who: Who = "admin";
let rows: Record<string, unknown>[] = [];
const writes: { op: string; payload?: unknown }[] = [];
const removed: string[][] = [];

/** Just enough of the Supabase query builder for this route. */
function query(table: string) {
  let op = "select";
  let payload: unknown;
  const filters: [string, unknown][] = [];
  const run = () => {
    const match = rows.filter((r) => filters.every(([k, v]) => r[k] === v));
    if (op === "insert") {
      writes.push({ op, payload });
      return { data: { id: "new-id", ...(payload as object) }, error: null };
    }
    if (op === "update") {
      writes.push({ op, payload });
      return { data: match[0] ? { ...match[0], ...(payload as object) } : null, error: null };
    }
    if (op === "delete") {
      writes.push({ op });
      return { data: match, error: null };
    }
    return { data: table === "djs" ? match : null, error: null };
  };
  const q = {
    select: () => q,
    insert: (p: unknown) => ((op = "insert"), (payload = p), q),
    update: (p: unknown) => ((op = "update"), (payload = p), q),
    delete: () => ((op = "delete"), q),
    eq: (k: string, v: unknown) => (filters.push([k, v]), q),
    order: () => q,
    single: async () => run(),
    maybeSingle: async () => {
      const r = run();
      return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
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
    storage: {
      from: () => ({
        remove: async (paths: string[]) => (removed.push(paths), { error: null }),
        upload: async () => (writes.push({ op: "upload" }), { error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/${path}` } }),
      }),
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeSupabase() }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { GET, POST, PATCH, DELETE } from "@/app/api/admin/djs/route";
import { POST as UPLOAD } from "@/app/api/admin/djs/upload/route";

function json(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/djs", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function upload() {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" }));
  return new NextRequest("http://localhost/api/admin/djs/upload", { method: "POST", body: fd });
}

const T1 = "2026-10-11T07:01:24.984773+00:00";

beforeEach(() => {
  who = "admin";
  writes.length = 0;
  removed.length = 0;
  rows = [
    { id: "id-mandz", name: "MANDZ", slug: "mandz", photo_path: "djs/1-a.jpg", updated_at: T1 },
    { id: "id-onka", name: "ONKA", slug: "onka", photo_path: null, updated_at: T1 },
  ];
});

describe("admin DJ routes refuse anyone who is not an admin", () => {
  for (const visitor of ["nobody", "visitor"] as const) {
    it(`${visitor}: every method is refused and nothing is written`, async () => {
      who = visitor;
      expect((await GET()).status).toBe(403);
      expect((await POST(json("POST", { name: "ZZ" }))).status).toBe(403);
      expect((await PATCH(json("PATCH", { id: "id-onka", name: "ZZ" }))).status).toBe(403);
      expect((await DELETE(json("DELETE", { id: "id-mandz" }))).status).toBe(403);
      expect(writes).toHaveLength(0);
      expect(removed).toHaveLength(0);
    });
  }

  it("upload: 401 for nobody, 403 for a visitor, nothing stored", async () => {
    who = "nobody";
    expect((await UPLOAD(upload())).status).toBe(401);
    who = "visitor";
    expect((await UPLOAD(upload())).status).toBe(403);
    expect(writes).toHaveLength(0);
  });
});

describe("admin DJ routes for an admin", () => {
  it("lists the roster", async () => {
    expect((await GET()).status).toBe(200);
  });

  it("derives a unique slug from the name and ignores one sent in", async () => {
    const res = await POST(json("POST", { name: "Mandz", slug: "admin" }));
    expect(res.status).toBe(200);
    expect(writes[0]).toMatchObject({ op: "insert", payload: { name: "Mandz", slug: "mandz-2" } });
  });

  it("uploads a picture under djs/ only", async () => {
    const res = await UPLOAD(upload());
    expect(res.status).toBe(200);
    expect((await res.json()).path).toMatch(/^djs\/\d+-[a-z0-9]+\.jpg$/);
  });

  it("refuses a save from a form opened before the row last changed", async () => {
    const res = await PATCH(
      json("PATCH", { id: "id-mandz", name: "MANDZ", updated_at: "2026-10-10T00:00:00+00:00" })
    );
    expect(res.status).toBe(409);
    expect(writes).toHaveLength(0);
    expect(removed).toHaveLength(0);
  });

  it("saves a current form, and deletes the photo it replaced", async () => {
    const res = await PATCH(
      json("PATCH", { id: "id-mandz", name: "MANDZ", photo_path: "djs/2-b.jpg", updated_at: T1 })
    );
    expect(res.status).toBe(200);
    expect(removed).toEqual([["djs/1-a.jpg"]]);
  });

  it("removes a DJ and their picture", async () => {
    const res = await DELETE(json("DELETE", { id: "id-mandz" }));
    expect(res.status).toBe(200);
    expect(removed).toEqual([["djs/1-a.jpg"]]);
  });
});
