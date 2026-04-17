#!/usr/bin/env python3
"""
Tsakani Sessions Video Worker

Polls the admin API for queued video jobs, processes them with video_merge.py,
and reports progress back. Run this on a machine with FFmpeg and access to
your source footage.

Setup:
  Set env vars in .env:
    SITE_URL=https://tsakani-sessions-app.vercel.app
    WORKER_SECRET=<same as WORKER_SECRET set on Vercel>
    FOOTAGE_DIR=/path/to/your/footage

Usage:
    python video_worker.py
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv()

SITE_URL = os.getenv("SITE_URL", "https://tsakani-sessions-app.vercel.app")
WORKER_SECRET = os.getenv("WORKER_SECRET")
FOOTAGE_DIR = Path(os.getenv("FOOTAGE_DIR", "./footage"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "30"))


def auth_headers():
    return {
        "x-worker-secret": WORKER_SECRET,
        "Content-Type": "application/json",
    }


def fetch_queued_jobs():
    try:
        r = requests.get(
            f"{SITE_URL}/api/admin/video-jobs?status=queued",
            headers=auth_headers(),
            timeout=30,
        )
        if r.status_code != 200:
            print(f"[WARN] Fetch jobs returned {r.status_code}: {r.text[:200]}")
            return []
        return r.json() or []
    except Exception as e:
        print(f"[ERROR] fetch_queued_jobs: {e}")
        return []


def update_job(job_id: str, updates: dict):
    try:
        requests.patch(
            f"{SITE_URL}/api/admin/video-jobs",
            headers=auth_headers(),
            json={"id": job_id, **updates},
            timeout=30,
        )
    except Exception as e:
        print(f"[ERROR] update_job {job_id}: {e}")


def run_youtube_upload(video_path, title, description, privacy):
    """Upload the rendered video to YouTube via youtube_upload.py."""
    script_path = Path(__file__).parent / "youtube_upload.py"
    if not script_path.exists():
        return False, "youtube_upload.py not found"
    args = [
        sys.executable, str(script_path),
        "--file", str(video_path),
        "--title", title,
        "--privacy", privacy or "private",
    ]
    if description:
        args += ["--description", description]
    try:
        result = subprocess.run(args, capture_output=True, text=True)
        if result.returncode != 0:
            return False, result.stderr[-500:]
        return True, None
    except Exception as e:
        return False, str(e)


def process_job(job):
    job_id = job["id"]
    config = job.get("config") or {}

    # Upload-only job: YouTube upload of a previously rendered video
    if config.get("upload_target") == "youtube" and config.get("upload_video_path"):
        print(f"\n[UPLOAD] YouTube: {config.get('upload_title')}")
        update_job(job_id, {"status": "running", "progress": 50})
        ok, err = run_youtube_upload(
            config["upload_video_path"],
            config["upload_title"],
            config.get("upload_description"),
            config.get("upload_privacy", "private"),
        )
        if ok:
            update_job(job_id, {"status": "done", "progress": 100})
            print(f"[DONE] YouTube upload for job {job_id}")
        else:
            update_job(job_id, {"status": "failed", "error_message": err or "Upload failed"})
            print(f"[FAIL] {err}")
        return

    print(f"\n[JOB] Processing {job_id}")

    update_job(job_id, {"status": "running", "progress": 0})

    try:
        # Write config to temp file
        temp_config = FOOTAGE_DIR / f"config_{job_id}.json"
        temp_config.parent.mkdir(exist_ok=True, parents=True)
        with open(temp_config, "w") as f:
            json.dump(config, f)

        # Call the video_merge.py script
        script_path = Path(__file__).parent / "video_merge.py"
        result = subprocess.run(
            [
                sys.executable,
                str(script_path),
                "--config",
                str(temp_config),
                "--input",
                str(FOOTAGE_DIR),
            ],
            capture_output=True,
            text=True,
            cwd=str(FOOTAGE_DIR.parent),
        )

        if result.returncode != 0:
            print(f"[FAIL] {result.stderr[-500:]}")
            update_job(
                job_id,
                {
                    "status": "failed",
                    "error_message": result.stderr[-2000:],
                },
            )
            return

        # Parse result from script stdout
        output_path = None
        for line in result.stdout.split("\n"):
            if line.startswith("__RESULT_JSON__:"):
                data = json.loads(line.replace("__RESULT_JSON__:", ""))
                output_path = data.get("output_file")
                break

        update_job(
            job_id,
            {
                "status": "done",
                "progress": 100,
                "output_path": output_path,
            },
        )
        print(f"[DONE] Job {job_id} -> {output_path}")

        # Cleanup
        try:
            temp_config.unlink()
        except Exception:
            pass

    except Exception as e:
        print(f"[FAIL] {e}")
        update_job(job_id, {"status": "failed", "error_message": str(e)})


def main():
    if not WORKER_SECRET:
        print("[ERROR] WORKER_SECRET not set in .env")
        sys.exit(1)

    print(f"[INFO] Video worker starting — polling {SITE_URL} every {POLL_INTERVAL}s")
    print(f"[INFO] Footage dir: {FOOTAGE_DIR}")

    while True:
        try:
            jobs = fetch_queued_jobs()
            if jobs:
                print(f"[INFO] Found {len(jobs)} queued job(s)")
                for job in jobs:
                    process_job(job)
            time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            print("\n[INFO] Worker stopped.")
            break
        except Exception as e:
            print(f"[ERROR] {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
