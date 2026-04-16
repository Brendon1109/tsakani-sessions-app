#!/usr/bin/env python3
"""
Tsakani Sessions TikTok Upload Script

Uploads videos to TikTok using the Content Posting API.

Setup:
  1. Register at TikTok for Developers (developers.tiktok.com)
  2. Create an app and request Content Posting API access
  3. Complete app review (may take 1-2 weeks)
  4. Set environment variables:
     - TIKTOK_CLIENT_KEY=your_client_key
     - TIKTOK_CLIENT_SECRET=your_client_secret
     - TIKTOK_ACCESS_TOKEN=your_access_token

Usage:
    python tiktok_upload.py --file short_clip.mp4 --title "Tsakani Sessions highlights"

Notes:
    - Videos: MP4, H.264, max 287.6MB, max 10 minutes
    - Aspect ratio: 9:16 recommended for best reach
    - TikTok API requires app review before production use
"""

import argparse
import os
import sys
import time
import httpx
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

TIKTOK_API_URL = "https://open.tiktokapis.com/v2"
CLIENT_KEY = os.getenv("TIKTOK_CLIENT_KEY")
CLIENT_SECRET = os.getenv("TIKTOK_CLIENT_SECRET")
ACCESS_TOKEN = os.getenv("TIKTOK_ACCESS_TOKEN")


def check_credentials():
    if not CLIENT_KEY or not ACCESS_TOKEN:
        print("[ERROR] Missing TikTok credentials.")
        print("Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_ACCESS_TOKEN in .env")
        print("\nTo get these:")
        print("1. Register at developers.tiktok.com")
        print("2. Create an app → request Content Posting API")
        print("3. Complete app review")
        print("4. Generate access token via OAuth 2.0 flow")
        sys.exit(1)


def init_upload(file_size: int, title: str) -> dict:
    """Initialize a video upload with TikTok."""
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }

    body = {
        "post_info": {
            "title": title[:150],  # Max 150 chars
            "privacy_level": "SELF_ONLY",  # Start as private, change later
            "disable_duet": False,
            "disable_stitch": False,
            "disable_comment": False,
        },
        "source_info": {
            "source": "FILE_UPLOAD",
            "video_size": file_size,
            "chunk_size": min(file_size, 10 * 1024 * 1024),  # 10MB chunks
            "total_chunk_count": max(1, -(-file_size // (10 * 1024 * 1024))),
        },
    }

    response = httpx.post(
        f"{TIKTOK_API_URL}/post/publish/inbox/video/init/",
        headers=headers,
        json=body,
    )

    data = response.json()
    if data.get("error", {}).get("code") != "ok":
        print(f"[ERROR] Init failed: {data}")
        sys.exit(1)

    return data["data"]


def upload_chunks(upload_url: str, filepath: str, chunk_size: int):
    """Upload video in chunks to TikTok."""
    file_size = os.path.getsize(filepath)

    with open(filepath, "rb") as f:
        chunk_num = 0
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break

            offset = chunk_num * chunk_size
            end = min(offset + len(chunk), file_size)

            headers = {
                "Content-Range": f"bytes {offset}-{end - 1}/{file_size}",
                "Content-Type": "video/mp4",
            }

            response = httpx.put(upload_url, headers=headers, content=chunk)

            if response.status_code not in (200, 201, 206):
                print(f"[ERROR] Chunk {chunk_num} upload failed: {response.status_code}")
                sys.exit(1)

            progress = min(100, int((end / file_size) * 100))
            print(f"[PROGRESS] {progress}% ({end}/{file_size} bytes)")
            chunk_num += 1

    print("[INFO] All chunks uploaded")


def check_publish_status(publish_id: str) -> str:
    """Check the status of a published video."""
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}

    for attempt in range(30):
        time.sleep(10)
        response = httpx.post(
            f"{TIKTOK_API_URL}/post/publish/status/fetch/",
            headers=headers,
            json={"publish_id": publish_id},
        )

        data = response.json()
        status = data.get("data", {}).get("status")
        print(f"[INFO] Publish status: {status} (attempt {attempt + 1}/30)")

        if status == "PUBLISH_COMPLETE":
            return "success"
        elif status in ("FAILED", "PUBLISH_FAILED"):
            print(f"[ERROR] Publish failed: {data}")
            return "failed"

    print("[ERROR] Publish timed out after 5 minutes")
    return "timeout"


def main():
    parser = argparse.ArgumentParser(description="Upload video to TikTok")
    parser.add_argument("--file", required=True, help="Video file to upload")
    parser.add_argument("--title", default="Tsakani Sessions",
                        help="Video title/caption (max 150 chars)")
    args = parser.parse_args()

    filepath = Path(args.file)
    if not filepath.exists():
        print(f"[ERROR] File not found: {filepath}")
        sys.exit(1)

    file_size = filepath.stat().st_size
    if file_size > 287.6 * 1024 * 1024:
        print(f"[ERROR] File too large ({file_size / 1024 / 1024:.1f}MB). Max is 287.6MB.")
        sys.exit(1)

    check_credentials()

    title = args.title
    if "#TsakaniSessions" not in title:
        title += " #TsakaniSessions #CapeTownDJ"

    print(f"\n[INFO] Uploading to TikTok: {filepath.name}")
    print(f"[INFO] Size: {file_size / 1024 / 1024:.1f}MB")
    print(f"[INFO] Title: {title[:150]}")

    # Step 1: Initialize upload
    init_data = init_upload(file_size, title)
    upload_url = init_data["upload_url"]
    publish_id = init_data.get("publish_id", "")

    # Step 2: Upload chunks
    chunk_size = min(file_size, 10 * 1024 * 1024)
    upload_chunks(upload_url, str(filepath), chunk_size)

    # Step 3: Check publish status
    if publish_id:
        status = check_publish_status(publish_id)
        if status == "success":
            print("\n[SUCCESS] Video published on TikTok!")
        else:
            print(f"\n[WARNING] Publish status: {status}")
    else:
        print("\n[INFO] Upload complete. Check TikTok for publish status.")


if __name__ == "__main__":
    main()
