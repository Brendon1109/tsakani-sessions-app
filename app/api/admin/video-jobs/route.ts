import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const supabase = createClient();
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

/**
 * List queued video jobs (admin).
 * Worker script polls this endpoint to pick up jobs.
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  // Allow worker access via WORKER_SECRET header
  const workerSecret = request.headers.get("x-worker-secret");
  const isWorker = workerSecret && workerSecret === process.env.WORKER_SECRET;

  if (!user && !isWorker) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status");
  let query = supabase
    .from("video_jobs")
    .select("*, project:video_projects(title, event:events(title))")
    .order("created_at", { ascending: true });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * Queue a new video job (admin submits config).
 */
export async function POST(request: NextRequest) {
  const { supabase, user, email } = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { project_id, config } = await request.json();
  if (!config) return NextResponse.json({ error: "config required" }, { status: 400 });

  let finalProjectId = project_id;
  if (!finalProjectId) {
    // Auto-create a project
    const { data: project } = await supabase
      .from("video_projects")
      .insert({
        title: `Merge ${new Date().toLocaleDateString()}`,
        status: "pending",
        source_files: config,
      })
      .select()
      .single();
    finalProjectId = project?.id;
  }

  const { data, error } = await supabase
    .from("video_jobs")
    .insert({ project_id: finalProjectId, config, status: "queued" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, {
    user_id: user.id,
    user_email: email,
    action: "video_job.create",
    resource_type: "video_job",
    resource_id: data.id,
  });

  return NextResponse.json(data);
}

/**
 * Worker updates job status/progress.
 */
export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const workerSecret = request.headers.get("x-worker-secret");
  const isWorker = workerSecret && workerSecret === process.env.WORKER_SECRET;

  if (!isWorker) {
    // Fall back to admin check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { id, status, progress, output_path, error_message } = await request.json();
  const updates: Record<string, unknown> = {};
  if (status) {
    updates.status = status;
    if (status === "running") updates.started_at = new Date().toISOString();
    if (status === "done" || status === "failed")
      updates.completed_at = new Date().toISOString();
  }
  if (progress !== undefined) updates.progress = progress;
  if (output_path) updates.output_path = output_path;
  if (error_message) updates.error_message = error_message;

  const { data, error } = await supabase
    .from("video_jobs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mirror status to video_projects
  if (data.project_id && status) {
    const projectStatus =
      status === "running" ? "processing" : status === "done" ? "complete" : status;
    await supabase
      .from("video_projects")
      .update({
        status: projectStatus,
        output_path: output_path || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.project_id);
  }

  return NextResponse.json(data);
}
