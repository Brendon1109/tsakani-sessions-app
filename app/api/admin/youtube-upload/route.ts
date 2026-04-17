import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

/**
 * Queues a YouTube upload job. Creates a new video_jobs row so the
 * worker picks it up on the next poll (status=queued). The actual
 * upload happens on the worker machine (where the rendered MP4 lives).
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { job_id, video_path, title, description, privacy } = await request.json();

  if (!video_path || !title) {
    return NextResponse.json(
      { error: "video_path and title required" },
      { status: 400 }
    );
  }

  // Inherit the project_id from the source job if provided
  let projectId: string | null = null;
  if (job_id) {
    const { data: source } = await supabase
      .from("video_jobs")
      .select("project_id")
      .eq("id", job_id)
      .single();
    projectId = source?.project_id || null;
  }

  const { data, error } = await supabase
    .from("video_jobs")
    .insert({
      project_id: projectId,
      status: "queued",
      progress: 0,
      config: {
        upload_target: "youtube",
        upload_video_path: video_path,
        upload_title: title,
        upload_description: description || null,
        upload_privacy: privacy || "private",
        upload_requested_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, {
    user_id: user.id,
    user_email: profile.email,
    action: "youtube_upload.queue",
    resource_type: "video_job",
    resource_id: data.id,
    details: { title, privacy: privacy || "private", source_job: job_id || null },
  });

  return NextResponse.json({ success: true, job: data });
}
