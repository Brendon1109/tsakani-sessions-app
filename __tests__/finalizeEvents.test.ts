import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The nightly finalize-events cron. It used to update events on the anon key,
 * which RLS lets match nothing, so it answered 200 and changed nothing. It
 * must go through finalize_past_events on the service role key, never write
 * on the anon client, stay behind CRON_SECRET, and fail loudly when the
 * service key is missing. Once an event is past, /events and the sitemap must
 * still list it.
 */

const rpcCalls: Array<{ fn: string; args: unknown }> = [];
let rpcResult: { data: unknown; error: { message: string } | null };
let serviceAvailable = true;
const anonCalls: string[] = [];
let statusFilter: unknown = null;

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () =>
    serviceAvailable
      ? {
          rpc: async (fn: string, args: unknown) => {
            rpcCalls.push({ fn, args });
            return rpcResult;
          },
        }
      : null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      anonCalls.push(table);
      const query = {
        select: () => query,
        in: (_col: string, values: unknown) => {
          statusFilter = values;
          return query;
        },
        eq: (_col: string, value: unknown) => {
          statusFilter = value;
          return query;
        },
        order: async () => ({ data: [], error: null }),
        update: () => {
          throw new Error("the cron must never write on the anon client");
        },
      };
      return query;
    },
  }),
}));

import { GET, POST } from "@/app/api/cron/finalize-events/route";
import { getPublishedEvents } from "@/lib/queries";

function request(auth?: string) {
  return new NextRequest("http://localhost/api/cron/finalize-events", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  rpcCalls.length = 0;
  anonCalls.length = 0;
  statusFilter = null;
  serviceAvailable = true;
  rpcResult = {
    data: { events_marked_past: 2, slugs: ["a", "b"], tickets_closed: 3 },
    error: null,
  };
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/cron/finalize-events", () => {
  it("refuses a request without the cron secret and touches nothing", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
  });

  it("fails closed in production when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect((await GET(request("Bearer "))).status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
  });

  it("marks past events through the service role function, never on the anon key", async () => {
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(rpcCalls).toEqual([{ fn: "finalize_past_events", args: { p_hours: 28 } }]);
    expect(anonCalls).toHaveLength(0);
    const body = await res.json();
    expect(body).toMatchObject({ events_marked_past: 2, slugs: ["a", "b"], tickets_closed: 3 });
  });

  it("answers POST the same way, for a manual run", async () => {
    expect((await POST(request("Bearer test-secret"))).status).toBe(200);
    expect(rpcCalls).toHaveLength(1);
  });

  it("reports zeroes when there is nothing left to finish, so a second run is harmless", async () => {
    rpcResult = { data: { events_marked_past: 0, slugs: [], tickets_closed: 0 }, error: null };
    const body = await (await GET(request("Bearer test-secret"))).json();
    expect(body).toMatchObject({ events_marked_past: 0, slugs: [], tickets_closed: 0 });
  });

  it("answers 503 rather than a quiet 200 when the service role key is missing", async () => {
    serviceAvailable = false;
    expect((await GET(request("Bearer test-secret"))).status).toBe(503);
  });

  it("answers 500 with the database error so the Worker cron alert fires", async () => {
    rpcResult = { data: null, error: { message: "function does not exist" } };
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("function does not exist");
  });
});

describe("getPublishedEvents", () => {
  it("still lists an event once the cron has marked it past", async () => {
    await getPublishedEvents();
    expect(statusFilter).toEqual(["published", "past"]);
  });
});
