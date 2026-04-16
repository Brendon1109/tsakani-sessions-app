#!/usr/bin/env python3
"""
Tsakani Sessions YouTube Upload Script

Uploads a video to YouTube using the YouTube Data API v3 with
resumable uploads. Supports title, description templates, tags,
and thumbnail.

Setup:
  1. Go to Google Cloud Console → APIs & Services → Credentials
  2. Create OAuth 2.0 Client ID (Desktop app)
  3. Download as client_secret.json and place in scripts/
  4. Enable YouTube Data API v3
  5. First run will open browser for OAuth consent

Usage:
    python youtube_upload.py --file output.mp4
    python youtube_upload.py --file output.mp4 --title "Tsakani Vol. 5" --thumbnail thumb.jpg
"""

import argparse
import os
import sys
import http.client
import httplib2
from pathlib import Path

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
CLIENT_SECRETS_FILE = "client_secret.json"
TOKEN_FILE = "youtube_token.json"

# Default video metadata template
DEFAULT_DESCRIPTION = """🎵 Tsakani Sessions — Two Tales of Happiness, Friendship & Brotherhood

Cape Town's premium DJ entertainment and content creation experience.

📱 Follow us:
Instagram: https://instagram.com/tsakani_sessions
TikTok: https://www.tiktok.com/@tsakani_sessions
YouTube: https://youtube.com/@tsakanisessions

📧 Bookings: tsakanisessions@gmail.com
📱 WhatsApp: +27 76 996 1477

#TsakaniSessions #CapeTownDJ #DJMix #SouthAfricanMusic #Amapiano #DeepHouse
"""

DEFAULT_TAGS = [
    "Tsakani Sessions", "Cape Town DJ", "DJ mix", "South African music",
    "amapiano", "deep house", "afro house", "DJ set", "live performance",
    "event highlights", "Cape Town events", "music video",
]


def get_authenticated_service():
    """Get an authenticated YouTube API service."""
    creds = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CLIENT_SECRETS_FILE):
                print(f"[ERROR] {CLIENT_SECRETS_FILE} not found.")
                print("Download it from Google Cloud Console → APIs → Credentials")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    return build("youtube", "v3", credentials=creds)


def upload_video(youtube, filepath: str, title: str, description: str,
                 tags: list[str], category: str = "10",
                 privacy: str = "private", thumbnail: str = None):
    """Upload a video to YouTube with resumable upload."""
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": category,  # 10 = Music
        },
        "status": {
            "privacyStatus": privacy,  # "private", "unlisted", or "public"
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(
        filepath,
        mimetype="video/mp4",
        resumable=True,
        chunksize=10 * 1024 * 1024,  # 10MB chunks
    )

    request = youtube.videos().insert(
        part=",".join(body.keys()),
        body=body,
        media_body=media,
    )

    print(f"\n[INFO] Uploading: {filepath}")
    print(f"[INFO] Title: {title}")
    print(f"[INFO] Privacy: {privacy}")

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"[PROGRESS] {int(status.progress() * 100)}%")

    video_id = response["id"]
    print(f"\n[SUCCESS] Upload complete!")
    print(f"[INFO] Video ID: {video_id}")
    print(f"[INFO] URL: https://www.youtube.com/watch?v={video_id}")

    # Upload thumbnail if provided
    if thumbnail and os.path.exists(thumbnail):
        print(f"[INFO] Setting thumbnail: {thumbnail}")
        youtube.thumbnails().set(
            videoId=video_id,
            media_body=MediaFileUpload(thumbnail, mimetype="image/jpeg"),
        ).execute()
        print("[SUCCESS] Thumbnail set!")

    return video_id


def main():
    parser = argparse.ArgumentParser(description="Upload video to YouTube")
    parser.add_argument("--file", required=True, help="Video file to upload")
    parser.add_argument("--title", default=None, help="Video title")
    parser.add_argument("--description", default=None, help="Video description")
    parser.add_argument("--tags", nargs="*", default=None, help="Video tags")
    parser.add_argument("--thumbnail", default=None, help="Thumbnail image (JPG)")
    parser.add_argument("--privacy", default="private",
                        choices=["private", "unlisted", "public"],
                        help="Privacy status (default: private)")
    parser.add_argument("--event", default=None,
                        help="Event name (auto-generates title/description)")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"[ERROR] File not found: {args.file}")
        sys.exit(1)

    # Generate title from event name or filename
    if args.title:
        title = args.title
    elif args.event:
        title = f"Tsakani Sessions — {args.event} | Full Aftermovie"
    else:
        title = f"Tsakani Sessions — {Path(args.file).stem}"

    description = args.description or DEFAULT_DESCRIPTION
    if args.event:
        description = f"🎬 {args.event}\n\n{description}"

    tags = args.tags or DEFAULT_TAGS

    youtube = get_authenticated_service()
    upload_video(
        youtube, args.file, title, description,
        tags, privacy=args.privacy, thumbnail=args.thumbnail,
    )


if __name__ == "__main__":
    main()
