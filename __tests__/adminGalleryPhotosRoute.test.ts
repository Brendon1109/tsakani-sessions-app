import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Deleting gallery photos: admins only, real ids only, and both the row and
 * its file in storage go.
 */

type Who = "nobody" | "visitor" | "admin";
let who: Who = "admin";
let rows: { id: string; storage_path: string; thumbnail_path: string | null; gallery_id: string }[] = [];
const deletedRows: string[][] = [];
const removedFiles: string[][] = [];

function query() {
  let op = "select";
  let ids: string[] | null = null;
  const run = () => {
    const match = ids ? rows.filter((r) => ids!.includes(r.id)) : rows;
    if (op === "delete") {
      deletedRows.push(ids || []);
      return { data: null, error: null };
    }
    return { data: match, error: null };
  };
  const q = {
    select: () => q,
    delete: () => ((op = "delete"), q),
    eq: () => q,
    in: (_k: string, v: string[]) => ((ids = v), q),
    order: () => q,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  };
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: who === "nobody" ? null : { id: who } } }) },
    from: (table: string) =>
      table === "profiles"
        ? {
            select: () => ({
              eq: () => ({ single: async () => ({ data: { role: who === "admin" ? "admin" : "user" } }) }),
            }),
          }
        : query(),
    storage: {
      from: () => ({
        remove: async (paths: string[]) => (removedFiles.push(paths), { error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/${path}` } }),
      }),
    },
  }),
}));

import { GET, DELETE } from "@/app/api/admin/gallery-photos/route";

const G = "11111111-1111-4111-8111-111111111111";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function del(body: unknown) {
  return new NextRequest("http://localhost/api/admin/gallery-photos", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  who = "admin";
  deletedRows.length = 0;
  removedFiles.length = 0;
  rows = [
    { id: A, storage_path: `galleries/${G}/a.jpg`, thumbnail_path: null, gallery_id: G },
    { id: B, storage_path: `galleries/${G}/b.jpg`, thumbnail_path: `galleries/${G}/b_t.jpg`, gallery_id: G },
  ];
});

describe("admin gallery photos route", () => {
  it("refuses anyone who is not an admin", async () => {
    for (const w of ["nobody", "visitor"] as Who[]) {
      who = w;
      expect((await DELETE(del({ ids: [A] }))).status).toBe(403);
      expect((await GET(new NextRequest(`http://localhost/x?gallery_id=${G}`))).status).toBe(403);
    }
    expect(deletedRows).toHaveLength(0);
    expect(removedFiles).toHaveLength(0);
  });

  it("refuses ids that are not ids", async () => {
    expect((await DELETE(del({ ids: [] }))).status).toBe(400);
    expect((await DELETE(del({ ids: ["x"] }))).status).toBe(400);
    expect((await DELETE(del({}))).status).toBe(400);
    expect(deletedRows).toHaveLength(0);
  });

  it("deletes the rows and their files", async () => {
    const body = await (await DELETE(del({ ids: [A, B] }))).json();
    expect(body.deleted).toBe(2);
    expect(deletedRows[0].sort()).toEqual([A, B].sort());
    expect(removedFiles[0].sort()).toEqual(
      [`galleries/${G}/a.jpg`, `galleries/${G}/b.jpg`, `galleries/${G}/b_t.jpg`].sort()
    );
  });

  it("lists photos with public urls", async () => {
    const body = await (await GET(new NextRequest(`http://localhost/x?gallery_id=${G}`))).json();
    expect(body).toEqual([
      { id: A, url: `https://x.supabase.co/galleries/${G}/a.jpg` },
      { id: B, url: `https://x.supabase.co/galleries/${G}/b.jpg` },
    ]);
  });
});
