import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { slugify } from "@/lib/djs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** null clears the link, a uuid sets it, anything else is refused. */
function parseEventId(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value === "string" && UUID_RE.test(value)) return { ok: true, value };
  return { ok: false };
}

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null as Awaited<ReturnType<typeof createClient>>, user: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, user: profile?.role === "admin" ? user : null };
}

const SELECT_WITH_DRIVE =
  "id, slug, title, event_id, is_public, drive_url, event:events(title)";
const SELECT_WITHOUT_DRIVE =
  "id, slug, title, event_id, is_public, event:events(title)";

export async function GET() {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const primary = await supabase
    .from("galleries")
    .select(SELECT_WITH_DRIVE)
    .order("created_at", { ascending: false });

  const data = primary.error
    ? (
        await supabase
          .from("galleries")
          .select(SELECT_WITHOUT_DRIVE)
          .order("created_at", { ascending: false })
      ).data
    : primary.data;

  type Row = {
    id: string;
    slug: string;
    title: string;
    event_id: string | null;
    is_public: boolean;
    drive_url?: string | null;
    event: { title: string } | null;
  };
  const normalized = ((data as unknown as Row[]) || []).map((g) => ({
    id: g.id,
    slug: g.slug,
    event_id: g.event_id,
    is_public: !!g.is_public,
    drive_url: g.drive_url || "",
    title: g.title,
    event_title: g.event?.title?.trim() || null,
  }));

  return NextResponse.json(normalized);
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { id, is_public, drive_url } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof is_public === "boolean") updates.is_public = is_public;
  if (typeof drive_url === "string") updates.drive_url = drive_url.trim() || null;
  if ("event_id" in body) {
    const parsed = parseEventId(body.event_id);
    if (!parsed.ok) return NextResponse.json({ error: "Pick an event from the list" }, { status: 400 });
    updates.event_id = parsed.value;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no updates" }, { status: 400 });
  }

  const primary = await supabase.from("galleries").update(updates).eq("id", id);
  if (primary.error && updates.drive_url !== undefined) {
    delete updates.drive_url;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "drive_url column missing — run the supabase/add_gallery_drive_url.sql migration" },
        { status: 500 },
      );
    }
    const fallback = await supabase.from("galleries").update(updates).eq("id", id);
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      warning: "drive_url not saved — run the supabase/add_gallery_drive_url.sql migration",
    });
  }
  if (primary.error) return NextResponse.json({ error: primary.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) return NextResponse.json({ error: "Give the gallery a title" }, { status: 400 });

  const parsed = parseEventId(body.event_id ?? null);
  if (!parsed.ok) return NextResponse.json({ error: "Pick an event from the list" }, { status: 400 });

  const base = slugify(title) || "gallery";
  const { data: taken } = await supabase
    .from("galleries")
    .select("slug")
    .like("slug", `${base}%`);
  const used = new Set(((taken as { slug: string }[] | null) || []).map((r) => r.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const { data, error } = await supabase
    .from("galleries")
    .insert({ title, slug, event_id: parsed.value, is_public: false })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: (data as { id: string }).id, slug });
}
