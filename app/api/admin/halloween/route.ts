import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { BAT_RUSH_EVENT_SLUG } from "@/lib/bat-rush/config";
import { followingRound, validateRoundEdit, type BatRushRound } from "@/lib/bat-rush/rounds";

/**
 * Admin for Bat Rush, /admin/halloween and its play-off page.
 *
 * Every method checks for an admin itself, as every /api/admin route does,
 * and then works on the admin's own session, so the RLS policies in
 * supabase/bat_rush.sql are the second lock. Players' Google names and
 * emails only ever leave the database through here.
 */

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null, email: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, email: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();
  return {
    supabase,
    user: profile?.role === "admin" ? user : null,
    email: profile?.email || null,
  };
}

type Supabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;

async function eventRounds(supabase: Supabase, eventId: string) {
  return supabase
    .from("bat_rush_rounds")
    .select("id, name, opens_at, closes_at, prize, winner_user_id")
    .eq("event_id", eventId)
    .order("opens_at", { ascending: true });
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const slug = request.nextUrl.searchParams.get("event") || BAT_RUSH_EVENT_SLUG;
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, slug, title, date")
    .eq("slug", slug)
    .maybeSingle();
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "No such event" }, { status: 404 });

  const { data: rounds, error: roundsError } = await eventRounds(supabase, event.id);
  if (roundsError) return NextResponse.json({ error: roundsError.message }, { status: 500 });

  const { data: players, error: playersError } = await supabase
    .from("bat_rush_players")
    .select("user_id, display_name, instagram_handle, show_handle, created_at, profiles(email, full_name)")
    .eq("event_id", event.id);
  if (playersError) return NextResponse.json({ error: playersError.message }, { status: 500 });

  // Supabase hands back at most 1000 rows per request whatever .limit() says,
  // so read in pages. 10 000 saves is far beyond one party.
  const roundIds = (rounds || []).map((r) => r.id);
  const scores: unknown[] = [];
  const PAGE = 1000;
  for (let from = 0; roundIds.length && from < 10_000; from += PAGE) {
    const { data, error } = await supabase
      .from("bat_rush_scores")
      .select("id, round_id, user_id, aura, created_at")
      .in("round_id", roundIds)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    scores.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  return NextResponse.json({ event, rounds: rounds || [], players: players || [], scores });
}

/** Edit a round's times and prize. */
export async function PATCH(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const id = body && typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const edit = validateRoundEdit(body);
  if (!edit.ok) return NextResponse.json({ error: edit.error }, { status: 400 });

  const { data, error } = await supabase
    .from("bat_rush_rounds")
    .update({ ...edit.value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, opens_at, closes_at, prize, winner_user_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "That round is gone" }, { status: 404 });

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "bat_rush.round_update",
    resource_type: "bat_rush_round",
    resource_id: id,
    details: { name: data.name, ...edit.value },
  });
  return NextResponse.json(data);
}

/**
 * Three actions. close: the round ends now and the one after it opens now,
 * so the board never sits closed between rounds. winner: marks or clears the
 * play-off winner of a round. clear_handle: takes a handle off the board.
 */
export async function POST(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const action = body && typeof body.action === "string" ? body.action : "";

  if (action === "close") {
    const id = typeof body.id === "string" ? body.id : "";
    const { data: round, error } = await supabase
      .from("bat_rush_rounds")
      .select("id, event_id, name, opens_at, closes_at, prize, winner_user_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!round) return NextResponse.json({ error: "That round is gone" }, { status: 404 });

    const now = new Date();
    if (Date.parse(round.opens_at) >= now.getTime()) {
      return NextResponse.json({ error: "That round has not opened yet" }, { status: 400 });
    }
    if (Date.parse(round.closes_at) <= now.getTime()) {
      return NextResponse.json({ error: "That round is already closed" }, { status: 400 });
    }

    const { data: all, error: allError } = await eventRounds(supabase, round.event_id);
    if (allError) return NextResponse.json({ error: allError.message }, { status: 500 });
    const next = followingRound((all || []) as BatRushRound[], round as BatRushRound);

    const { error: closeError } = await supabase
      .from("bat_rush_rounds")
      .update({ closes_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", id);
    if (closeError) return NextResponse.json({ error: closeError.message }, { status: 500 });

    let opened: string | null = null;
    if (next && Date.parse(next.opens_at) > now.getTime() && Date.parse(next.closes_at) > now.getTime()) {
      const { error: openError } = await supabase
        .from("bat_rush_rounds")
        .update({ opens_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("id", next.id);
      if (openError) {
        return NextResponse.json(
          { error: `${round.name} closed, but ${next.name} did not open. Set its open time to now and save.` },
          { status: 500 },
        );
      }
      opened = next.name;
    }

    await logAudit(supabase, {
      user_id: user.id,
      user_email: email,
      action: "bat_rush.round_close",
      resource_type: "bat_rush_round",
      resource_id: id,
      details: { name: round.name, opened_next: opened },
    });
    return NextResponse.json({ closed: round.name, opened });
  }

  if (action === "winner") {
    const roundId = typeof body.round_id === "string" ? body.round_id : "";
    const winner = typeof body.user_id === "string" && body.user_id ? body.user_id : null;
    if (!roundId) return NextResponse.json({ error: "round_id required" }, { status: 400 });

    const { data, error } = await supabase
      .from("bat_rush_rounds")
      .update({ winner_user_id: winner, updated_at: new Date().toISOString() })
      .eq("id", roundId)
      .select("id, name, winner_user_id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "That round is gone" }, { status: 404 });

    await logAudit(supabase, {
      user_id: user.id,
      user_email: email,
      action: "bat_rush.winner",
      resource_type: "bat_rush_round",
      resource_id: roundId,
      details: { name: data.name, winner_user_id: winner },
    });
    return NextResponse.json(data);
  }

  if (action === "clear_handle") {
    // For a handle that is not the player's own, or anything that should not
    // be on the board. Clears it and stops it showing; the score stays.
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    const eventId = typeof body.event_id === "string" ? body.event_id : "";
    if (!userId || !eventId) return NextResponse.json({ error: "user_id and event_id required" }, { status: 400 });

    const { data, error } = await supabase
      .from("bat_rush_players")
      .update({ instagram_handle: null, show_handle: false, updated_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .select("user_id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "That player is gone" }, { status: 404 });

    await logAudit(supabase, {
      user_id: user.id,
      user_email: email,
      action: "bat_rush.handle_clear",
      resource_type: "bat_rush_player",
      resource_id: userId,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/** Delete one saved score. */
export async function DELETE(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const scoreId = body && Number.isInteger(body.score_id) ? body.score_id : null;
  if (scoreId === null) return NextResponse.json({ error: "score_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("bat_rush_scores")
    .delete()
    .eq("id", scoreId)
    .select("id, round_id, user_id, aura");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const removed = data?.[0];
  if (!removed) return NextResponse.json({ error: "That score is gone" }, { status: 404 });

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "bat_rush.score_delete",
    resource_type: "bat_rush_score",
    resource_id: String(scoreId),
    details: { round_id: removed.round_id, user_id: removed.user_id, aura: removed.aura },
  });
  return NextResponse.json({ success: true });
}
