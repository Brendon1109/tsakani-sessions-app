"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Download,
} from "lucide-react";

interface VideoJob {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  output_path: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  project?: { title: string; event?: { title: string } | null } | null;
}

const statusConfig: Record<
  VideoJob["status"],
  { label: string; color: string; icon: typeof Clock }
> = {
  queued: { label: "Queued", color: "text-gray-400", icon: Clock },
  running: { label: "Rendering", color: "text-gold-500", icon: Loader2 },
  done: { label: "Done", color: "text-green-400", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-400", icon: AlertCircle },
};

export default function VideoJobsPanel() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
    // Poll every 5 seconds for live updates
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadJobs() {
    try {
      const res = await fetch("/api/admin/video-jobs");
      if (res.ok) {
        setJobs(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function uploadToYouTube(jobId: string, outputPath: string) {
    setUploadingId(jobId);
    const title = prompt("YouTube video title:", "Tsakani Sessions Aftermovie");
    if (!title) {
      setUploadingId(null);
      return;
    }

    try {
      const res = await fetch("/api/admin/youtube-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, video_path: outputPath, title }),
      });
      if (res.ok) {
        alert("YouTube upload queued. Run scripts/youtube_upload.py on your worker machine.");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to queue upload");
      }
    } finally {
      setUploadingId(null);
      loadJobs();
    }
  }

  if (loading) {
    return (
      <div className="text-center py-10 text-gray-500">
        Loading job queue...
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-dark-500 border border-white/10 rounded-xl p-8 text-center">
        <Clock size={28} className="text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">
          No jobs queued. Build a clip sequence above and click &quot;Queue for Worker&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const config = statusConfig[job.status];
        const Icon = config.icon;
        const title =
          job.project?.event?.title ||
          job.project?.title ||
          "Untitled";

        return (
          <div
            key={job.id}
            className="bg-dark-500 border border-white/10 rounded-xl p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Icon
                  size={20}
                  className={`${config.color} ${job.status === "running" ? "animate-spin" : ""} shrink-0`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className={config.color}>{config.label}</span>
                    {job.status === "running" && job.progress > 0 && (
                      <span> · {job.progress}%</span>
                    )}
                    {job.status === "done" && job.completed_at && (
                      <span>
                        {" "}
                        · Completed{" "}
                        {new Date(job.completed_at).toLocaleTimeString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {job.status === "done" && job.output_path && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => uploadToYouTube(job.id, job.output_path!)}
                    disabled={uploadingId === job.id}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
                    YouTube
                  </button>
                  <span
                    className="text-gray-500 text-xs flex items-center gap-1"
                    title={job.output_path}
                  >
                    <Download size={12} />
                    {job.output_path.split(/[\\/]/).pop()}
                  </span>
                </div>
              )}
            </div>

            {job.status === "running" && (
              <div className="mt-3 h-1 bg-dark-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold-gradient transition-all"
                  style={{ width: `${Math.max(5, job.progress)}%` }}
                />
              </div>
            )}

            {job.status === "failed" && job.error_message && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
                {job.error_message.length > 200
                  ? job.error_message.slice(0, 200) + "..."
                  : job.error_message}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
