import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * Cron endpoint: deletes what the privacy page says we stop keeping.
 *
 * analytics_events older than 12 months, booking_enquiries two years after
 * they were last updated (or created, if never updated), audit_log rows older
 * than two years, and rate limit keys whose window has ended. One call to
 * apply_retention on the service role key, which does every delete in one
 * transaction and is executable by nobody else. See supabase/retention.sql.
 * Running it twice deletes nothing the second time.
 *
 *   GET|POST /api/cron/retention
 *   Header: Authorization: Bearer <CRON_SECRET>
 */

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    // Fail closed in production, matching the other cron routes.
    if (process.env.NODE_ENV === "production") {
      console.error("[cron/retention] CRON_SECRET is not set in production, rejecting request.");
      return false;
    }
    return true;
  }

  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  if (!service) {
    console.error("[cron/retention] SUPABASE_SERVICE_ROLE_KEY is not set, so nothing was deleted.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { data, error } = await service.rpc("apply_retention");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as {
    analytics_events_deleted?: number;
    booking_enquiries_deleted?: number;
    audit_log_deleted?: number;
    rate_limits_deleted?: number;
  };

  return NextResponse.json({
    analytics_events_deleted: result.analytics_events_deleted ?? 0,
    booking_enquiries_deleted: result.booking_enquiries_deleted ?? 0,
    audit_log_deleted: result.audit_log_deleted ?? 0,
    rate_limits_deleted: result.rate_limits_deleted ?? 0,
    timestamp: new Date().toISOString(),
  });
}
