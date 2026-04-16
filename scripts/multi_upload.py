#!/usr/bin/env python3
"""
Tsakani Sessions Multi-Platform Upload Script

Takes a CapCut-exported short video and uploads it to:
  - YouTube Shorts
  - Instagram Reels
  - TikTok

The video must be in 9:16 portrait format, under 60 seconds for Shorts,
under 90 seconds for Reels, under 10 minutes for TikTok.

Usage:
    python multi_upload.py --file short_clip.mp4 --caption "Tsakani Sessions vibes"
    python multi_upload.py --file short_clip.mp4 --platforms youtube instagram
    python multi_upload.py --file short_clip.mp4 --event "Sunset Boat Cruise"
"""

import argparse
import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PLATFORMS = ["youtube", "instagram", "tiktok"]


def get_video_duration(filepath: str) -> float:
    """Get video duration in seconds."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", filepath],
        capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def upload_youtube_short(filepath: str, title: str, description: str):
    """Upload as YouTube Short."""
    print("\n" + "=" * 50)
    print("[YouTube Shorts]")
    print("=" * 50)

    cmd = [
        sys.executable, "youtube_upload.py",
        "--file", filepath,
        "--title", f"{title} #Shorts",
        "--description", description,
        "--privacy", "private",  # Review before making public
    ]

    result = subprocess.run(cmd, cwd=os.path.dirname(__file__))
    return result.returncode == 0


def upload_instagram_reel(video_url: str, caption: str):
    """Upload as Instagram Reel (requires public URL)."""
    print("\n" + "=" * 50)
    print("[Instagram Reels]")
    print("=" * 50)

    if not video_url.startswith("http"):
        print("[WARNING] Instagram requires a public URL.")
        print("Upload the video to Supabase Storage or Cloudflare R2 first,")
        print("then run: python instagram_upload.py --type reel --video <url>")
        return False

    cmd = [
        sys.executable, "instagram_upload.py",
        "--type", "reel",
        "--video", video_url,
        "--caption", caption,
    ]

    result = subprocess.run(cmd, cwd=os.path.dirname(__file__))
    return result.returncode == 0


def upload_tiktok(filepath: str, title: str):
    """Upload to TikTok."""
    print("\n" + "=" * 50)
    print("[TikTok]")
    print("=" * 50)

    cmd = [
        sys.executable, "tiktok_upload.py",
        "--file", filepath,
        "--title", title,
    ]

    result = subprocess.run(cmd, cwd=os.path.dirname(__file__))
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(
        description="Upload short-form video to multiple platforms"
    )
    parser.add_argument("--file", required=True, help="Video file (9:16, MP4)")
    parser.add_argument("--caption", default="", help="Caption/description")
    parser.add_argument("--event", default=None, help="Event name")
    parser.add_argument("--platforms", nargs="*", default=PLATFORMS,
                        choices=PLATFORMS, help="Platforms to upload to")
    parser.add_argument("--video-url", default=None,
                        help="Public URL of video (required for Instagram)")
    args = parser.parse_args()

    filepath = Path(args.file)
    if not filepath.exists():
        print(f"[ERROR] File not found: {filepath}")
        sys.exit(1)

    duration = get_video_duration(str(filepath))
    size_mb = filepath.stat().st_size / (1024 * 1024)

    print(f"\n{'#' * 60}")
    print(f"# Tsakani Sessions Multi-Platform Upload")
    print(f"# File:      {filepath.name}")
    print(f"# Duration:  {duration:.1f}s")
    print(f"# Size:      {size_mb:.1f}MB")
    print(f"# Platforms: {', '.join(args.platforms)}")
    print(f"{'#' * 60}")

    # Validation
    if duration > 60 and "youtube" in args.platforms:
        print("[WARNING] Video > 60s — YouTube may not classify as Short")
    if duration > 90 and "instagram" in args.platforms:
        print("[WARNING] Video > 90s — exceeds Instagram Reel limit")

    # Build caption
    event_name = args.event or "Tsakani Sessions"
    caption = args.caption or f"{event_name} highlights"
    description = f"{caption}\n\n" + (
        "🎵 Tsakani Sessions — Two Tales of Happiness, Friendship & Brotherhood\n"
        "Cape Town's premium DJ entertainment experience.\n\n"
        "📱 @tsakani_sessions\n"
        "#TsakaniSessions #CapeTownDJ #SouthAfricanMusic"
    )

    results = {}

    # Upload to each platform
    if "youtube" in args.platforms:
        results["youtube"] = upload_youtube_short(str(filepath), event_name, description)

    if "instagram" in args.platforms:
        video_url = args.video_url
        if video_url:
            results["instagram"] = upload_instagram_reel(video_url, caption)
        else:
            print("\n[Instagram] Skipped — provide --video-url with a public URL")
            print("Upload to Supabase Storage first, then pass the URL.")
            results["instagram"] = False

    if "tiktok" in args.platforms:
        results["tiktok"] = upload_tiktok(str(filepath), caption[:150])

    # Summary
    print(f"\n{'#' * 60}")
    print(f"# Upload Summary")
    print(f"{'#' * 60}")
    for platform, success in results.items():
        status = "SUCCESS" if success else "FAILED/SKIPPED"
        icon = "✅" if success else "❌"
        print(f"  {icon} {platform.capitalize()}: {status}")
    print()


if __name__ == "__main__":
    main()
