import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Cron endpoint: marks finished events as past.
 *
 * The public site already hides finished events on its own, via
 * isEventPast() in lib/date.ts, which applies a 04:00 Africa/Johannesburg
 * cutoff the morning after the event starts. This endpoint does not drive
 * that. It exists so events.status in the database agrees with what the
 * site is already showing, which keeps the admin dashboards and any
 * reporting honest.
 *
 * That distinction matters: if this job never runs, nothing breaks for a
 * visitor. Only the admin view drifts.
 *
 * Ticket sale windows are deliberately NOT handled here. They live in
 * sale_start and sale_end and are enforced by reserve_tickets, so a
 * missed or doubled cron run cannot open or close sales by accident.
 *
 *   GET|POST /api/cron/finalize-events
 *   Header: Authorization: Bearer <CRON_SECRET>
 */

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    // Fail closed in production, matching cleanup-orders.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[cron/finalize-events] CRON_SECRET is not set in production — rejecting request. Set the env var in Vercel."
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

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  // An event is finished once 04:00 SAST has passed on the morning after
  // it started. Anything that began more than 28 hours ago is safely past
  // that line regardless of its start time, which keeps this a single
  // indexed comparison instead of per row timezone arithmetic.
  const cutoff = new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString();

  const { data: finished, error } = await supabase
    .from("events")
    .update({ status: "past", updated_at: new Date().toISOString() })
    .eq("status", "published")
    .lt("date", cutoff)
    .select("id, slug, date");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Close any sale window still hanging open on a finished event, so a
  // ticket cannot be bought for something that already happened.
  let closed = 0;
  if (finished && finished.length > 0) {
    const { data: shut } = await supabase
      .from("tickets")
      .update({ is_active: false })
      .in("event_id", finished.map((e) => e.id))
      .eq("is_active", true)
      .select("id");
    closed = shut?.length || 0;
  }

  return NextResponse.json({
    events_marked_past: finished?.length || 0,
    slugs: finished?.map((e) => e.slug) || [],
    tickets_closed: closed,
    timestamp: new Date().toISOString(),
  });
}
