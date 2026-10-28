import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * Cron endpoint: marks finished events as past and closes their ticket sales.
 *
 * The public site already hides finished events from the upcoming lists on
 * its own, via isEventPast() in lib/date.ts, which applies a 04:00
 * Africa/Johannesburg cutoff the morning after the event starts. This
 * endpoint does not drive that. It exists so events.status in the database
 * agrees with what the site is already showing, which keeps the admin
 * dashboards and any reporting honest, and so no ticket stays on sale for
 * something that already happened.
 *
 * It runs on the service role key through finalize_past_events, which does
 * both writes in one transaction. It used to update on the anon key, and the
 * only UPDATE policies on events and tickets are the admin ones, so it
 * matched zero rows every night and answered 200. See
 * supabase/finalize_past_events.sql, which also lets visitors keep reading an
 * event once it is past. Running it twice changes nothing the second time.
 *
 *   GET|POST /api/cron/finalize-events
 *   Header: Authorization: Bearer <CRON_SECRET>
 */

// Past the 04:00 SAST cutoff the morning after any start time. The function
// refuses anything shorter.
const FINISHED_AFTER_HOURS = 28;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    // Fail closed in production, matching cleanup-orders.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[cron/finalize-events] CRON_SECRET is not set in production, rejecting request. Set it as a Worker secret."
      );
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
    console.error(
      "[cron/finalize-events] SUPABASE_SERVICE_ROLE_KEY is not set, so past events cannot be marked."
    );
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { data, error } = await service.rpc("finalize_past_events", {
    p_hours: FINISHED_AFTER_HOURS,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as {
    events_marked_past?: number;
    slugs?: string[];
    tickets_closed?: number;
  };

  return NextResponse.json({
    events_marked_past: result.events_marked_past ?? 0,
    slugs: result.slugs ?? [],
    tickets_closed: result.tickets_closed ?? 0,
    timestamp: new Date().toISOString(),
  });
}
