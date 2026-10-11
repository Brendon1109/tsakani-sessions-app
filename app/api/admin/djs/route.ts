import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { buildDjPayload, uniqueDjSlug, DJ_PHOTO_BUCKET } from "@/lib/djs";

/**
 * Admin CRUD for the DJ roster.
 *
 * Every DJ is public, so adding one is publishing them and removing one takes
 * them off the site. The slug is never sent by the form: it is derived from
 * the name here and kept unique, and it follows the name when the name
 * changes. Removing a DJ also deletes their picture from storage; enquiries
 * that asked for them keep the name snapshot and lose only the link.
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

async function takenSlugs(supabase: Supabase, exceptId?: string): Promise<string[] | { error: string }> {
  const { data, error } = await supabase.from("djs").select("id, slug");
  if (error) return { error: error.message };
  return (data || []).filter((row) => row.id !== exceptId).map((row) => row.slug);
}

/** Best effort. A leftover file costs nothing, a failed save would. */
async function removePhoto(supabase: Supabase, path: string | null | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(DJ_PHOTO_BUCKET).remove([path]);
  if (error) console.error("[admin/djs] photo cleanup failed:", error.message);
}

function revalidateRoster() {
  revalidatePath("/djs", "layout");
}

export async function GET() {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("djs")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }
  const payload = buildDjPayload(body);
  if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: 400 });

  const taken = await takenSlugs(supabase);
  if (!Array.isArray(taken)) return NextResponse.json({ error: taken.error }, { status: 500 });
  const slug = uniqueDjSlug(payload.name, taken);

  const { data, error } = await supabase
    .from("djs")
    .insert({ ...payload, slug })
    .select()
    .single();

  if (error) {
    // 23505: another DJ took the same slug a moment ago. Saving again picks the next one.
    const message = error.code === "23505" ? "Could not save, try again" : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "dj.create",
    resource_type: "dj",
    resource_id: data.id,
    details: { name: payload.name, slug },
  });

  revalidateRoster();
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const payload = buildDjPayload(body);
  if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: 400 });

  const { data: current, error: readError } = await supabase
    .from("djs")
    .select("id, name, slug, photo_path")
    .eq("id", id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "That DJ is gone" }, { status: 404 });

  let slug = current.slug;
  if (payload.name !== current.name) {
    const taken = await takenSlugs(supabase, id);
    if (!Array.isArray(taken)) return NextResponse.json({ error: taken.error }, { status: 500 });
    slug = uniqueDjSlug(payload.name, taken);
  }

  const { data, error } = await supabase
    .from("djs")
    .update({ ...payload, slug, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const message = error.code === "23505" ? "Could not save, try again" : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (current.photo_path && current.photo_path !== payload.photo_path) {
    await removePhoto(supabase, current.photo_path);
  }

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "dj.update",
    resource_type: "dj",
    resource_id: id,
    details: { name: payload.name, slug },
  });

  revalidateRoster();
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const id = body && typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("djs")
    .delete()
    .eq("id", id)
    .select("id, name, photo_path");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const removed = data?.[0];
  if (!removed) return NextResponse.json({ error: "That DJ is gone" }, { status: 404 });

  await removePhoto(supabase, removed.photo_path);

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "dj.delete",
    resource_type: "dj",
    resource_id: id,
    details: { name: removed.name },
  });

  revalidateRoster();
  return NextResponse.json({ success: true });
}
