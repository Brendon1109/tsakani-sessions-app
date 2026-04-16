#!/usr/bin/env python3
"""
Tsakani Sessions Instagram Upload Script

Posts photos and Reels to Instagram using the Instagram Graph API.

Setup:
  1. Create a Facebook Page linked to your Instagram Business account
  2. Go to Meta for Developers → Create App → Business type
  3. Add Instagram Graph API product
  4. Generate a long-lived access token (60 days)
  5. Set environment variables:
     - INSTAGRAM_ACCESS_TOKEN=your_token
     - INSTAGRAM_ACCOUNT_ID=your_ig_account_id

Usage:
    # Post a photo
    python instagram_upload.py --type photo --image https://your-cdn.com/photo.jpg --caption "Tsakani vibes"

    # Post a Reel (video must be hosted at a public URL)
    python instagram_upload.py --type reel --video https://your-cdn.com/reel.mp4 --caption "Highlights"

Notes:
    - Images/videos must be accessible via public URL (upload to Supabase Storage first)
    - Photos: JPEG, max 8MB, aspect ratio 4:5 to 1.91:1
    - Reels: MP4, H.264, AAC audio, 3-90 seconds, 9:16 aspect ratio
"""

import argparse
import os
import sys
import time
import requests
from dotenv import load_dotenv

load_dotenv()

GRAPH_API_URL = "https://graph.facebook.com/v19.0"
ACCESS_TOKEN = os.getenv("INSTAGRAM_ACCESS_TOKEN")
ACCOUNT_ID = os.getenv("INSTAGRAM_ACCOUNT_ID")


def check_credentials():
    if not ACCESS_TOKEN or not ACCOUNT_ID:
        print("[ERROR] Missing credentials.")
        print("Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID in .env")
        print("\nTo get these:")
        print("1. Create a Meta Developer App at developers.facebook.com")
        print("2. Add Instagram Graph API product")
        print("3. Generate a User Token with instagram_basic, instagram_content_publish")
        print("4. Exchange for a long-lived token (60 day expiry)")
        print("5. Get your IG Account ID via: GET /me/accounts → page_id → GET /page_id?fields=instagram_business_account")
        sys.exit(1)


def post_photo(image_url: str, caption: str):
    """Post a single photo to Instagram."""
    print(f"[INFO] Posting photo to Instagram...")
    print(f"[INFO] Image: {image_url}")

    # Step 1: Create media container
    response = requests.post(
        f"{GRAPH_API_URL}/{ACCOUNT_ID}/media",
        params={
            "image_url": image_url,
            "caption": caption,
            "access_token": ACCESS_TOKEN,
        },
    )
    data = response.json()

    if "id" not in data:
        print(f"[ERROR] Failed to create container: {data}")
        sys.exit(1)

    container_id = data["id"]
    print(f"[INFO] Container created: {container_id}")

    # Step 2: Publish
    response = requests.post(
        f"{GRAPH_API_URL}/{ACCOUNT_ID}/media_publish",
        params={
            "creation_id": container_id,
            "access_token": ACCESS_TOKEN,
        },
    )
    result = response.json()

    if "id" in result:
        print(f"[SUCCESS] Photo posted! Media ID: {result['id']}")
    else:
        print(f"[ERROR] Publish failed: {result}")

    return result.get("id")


def post_reel(video_url: str, caption: str, cover_url: str = None):
    """Post a Reel to Instagram."""
    print(f"[INFO] Posting Reel to Instagram...")
    print(f"[INFO] Video: {video_url}")

    # Step 1: Create video container
    params = {
        "media_type": "REELS",
        "video_url": video_url,
        "caption": caption,
        "access_token": ACCESS_TOKEN,
    }
    if cover_url:
        params["cover_url"] = cover_url

    response = requests.post(
        f"{GRAPH_API_URL}/{ACCOUNT_ID}/media",
        params=params,
    )
    data = response.json()

    if "id" not in data:
        print(f"[ERROR] Failed to create container: {data}")
        sys.exit(1)

    container_id = data["id"]
    print(f"[INFO] Container created: {container_id}")

    # Step 2: Wait for processing
    print("[INFO] Waiting for video processing...")
    for attempt in range(30):
        time.sleep(10)
        status_resp = requests.get(
            f"{GRAPH_API_URL}/{container_id}",
            params={"fields": "status_code", "access_token": ACCESS_TOKEN},
        )
        status = status_resp.json().get("status_code")
        print(f"[INFO] Status: {status} (attempt {attempt + 1}/30)")

        if status == "FINISHED":
            break
        elif status == "ERROR":
            print(f"[ERROR] Video processing failed: {status_resp.json()}")
            sys.exit(1)
    else:
        print("[ERROR] Video processing timed out after 5 minutes")
        sys.exit(1)

    # Step 3: Publish
    response = requests.post(
        f"{GRAPH_API_URL}/{ACCOUNT_ID}/media_publish",
        params={
            "creation_id": container_id,
            "access_token": ACCESS_TOKEN,
        },
    )
    result = response.json()

    if "id" in result:
        print(f"[SUCCESS] Reel posted! Media ID: {result['id']}")
    else:
        print(f"[ERROR] Publish failed: {result}")

    return result.get("id")


def main():
    parser = argparse.ArgumentParser(description="Post to Instagram")
    parser.add_argument("--type", required=True, choices=["photo", "reel"],
                        help="Content type: photo or reel")
    parser.add_argument("--image", help="Public URL of image (for photo posts)")
    parser.add_argument("--video", help="Public URL of video (for reel posts)")
    parser.add_argument("--caption", default="",
                        help="Post caption")
    parser.add_argument("--cover", help="Cover image URL (for reels)")
    args = parser.parse_args()

    check_credentials()

    # Add default hashtags if not present
    caption = args.caption
    if "#TsakaniSessions" not in caption:
        caption += "\n\n#TsakaniSessions #CapeTownDJ #SouthAfricanMusic"

    if args.type == "photo":
        if not args.image:
            print("[ERROR] --image required for photo posts")
            sys.exit(1)
        post_photo(args.image, caption)

    elif args.type == "reel":
        if not args.video:
            print("[ERROR] --video required for reel posts")
            sys.exit(1)
        post_reel(args.video, caption, args.cover)


if __name__ == "__main__":
    main()
