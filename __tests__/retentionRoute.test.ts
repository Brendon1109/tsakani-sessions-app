import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The nightly retention cron. It must delete only through apply_retention on
 * the service role key, stay behind CRON_SECRET, fail loudly when the service
 * key is missing or the database refuses, and be harmless to run twice.
 */

const rpcCalls: string[] = [];
let rpcResult: { data: unknown; error: { message: string } | null };
let serviceAvailable = true;

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () =>
    serviceAvailable
      ? {
          rpc: async (fn: string) => {
            rpcCalls.push(fn);
            return rpcResult;
          },
        }
      : null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    throw new Error("the retention cron must never use the anon client");
  },
}));

import { GET, POST } from "@/app/api/cron/retention/route";

function request(auth?: string) {
  return new NextRequest("http://localhost/api/cron/retention", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  rpcCalls.length = 0;
  serviceAvailable = true;
  rpcResult = { data: { analytics_events_deleted: 12, booking_enquiries_deleted: 1 }, error: null };
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/cron/retention", () => {
  it("refuses a request without the cron secret and deletes nothing", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request("Bearer wrong"))).status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
  });

  it("fails closed in production when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect((await GET(request("Bearer "))).status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
  });

  it("deletes through apply_retention on the service role and reports the counts", async () => {
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(rpcCalls).toEqual(["apply_retention"]);
    expect(await res.json()).toMatchObject({ analytics_events_deleted: 12, booking_enquiries_deleted: 1 });
  });

  it("reports zeroes on a second run", async () => {
    rpcResult = { data: { analytics_events_deleted: 0, booking_enquiries_deleted: 0 }, error: null };
    expect(await (await POST(request("Bearer test-secret"))).json()).toMatchObject({
      analytics_events_deleted: 0,
      booking_enquiries_deleted: 0,
    });
  });

  it("answers 503 when the service role key is missing, so the cron alert fires", async () => {
    serviceAvailable = false;
    expect((await GET(request("Bearer test-secret"))).status).toBe(503);
  });

  it("answers 500 with the database error", async () => {
    rpcResult = { data: null, error: { message: "permission denied" } };
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("permission denied");
  });
});
