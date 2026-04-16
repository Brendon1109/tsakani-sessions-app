#!/usr/bin/env python3
"""
Tsakani Sessions Photo Upload Script

Watches a local folder for Lightroom exports and uploads them to
Supabase Storage, creating gallery_photos entries in the database.

Usage:
    # Upload all photos from a folder to a gallery
    python upload_photos.py --folder ./lightroom_exports --gallery-id <uuid>

    # Watch folder for new files and auto-upload
    python upload_photos.py --folder ./lightroom_exports --gallery-id <uuid> --watch

Setup:
    Set in .env:
      SUPABASE_URL=https://xxxxx.supabase.co
      SUPABASE_SERVICE_KEY=eyJ...  (service role key for server-side uploads)
"""

import argparse
import os
import sys
import time
import requests
import mimetypes
from pathlib import Path
from dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
BUCKET = "gallery-photos"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def check_credentials():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] Missing Supabase credentials.")
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
        sys.exit(1)


def upload_file(filepath: Path, gallery_id: str) -> dict | None:
    """Upload a single file to Supabase Storage and create a DB entry."""
    ext = filepath.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        return None

    mime_type = mimetypes.guess_type(str(filepath))[0] or "image/jpeg"
    storage_path = f"galleries/{gallery_id}/{filepath.name}"

    # Upload to Storage
    with open(filepath, "rb") as f:
        response = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}",
            headers={
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": mime_type,
                "x-upsert": "true",
            },
            data=f,
        )

    if response.status_code not in (200, 201):
        print(f"[ERROR] Upload failed for {filepath.name}: {response.text}")
        return None

    # Create gallery_photos record
    record = {
        "gallery_id": gallery_id,
        "storage_path": storage_path,
        "caption": filepath.stem.replace("_", " ").replace("-", " "),
    }

    db_response = requests.post(
        f"{SUPABASE_URL}/rest/v1/gallery_photos",
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "apikey": SUPABASE_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json=record,
    )

    if db_response.status_code in (200, 201):
        return db_response.json()
    else:
        print(f"[ERROR] DB insert failed for {filepath.name}: {db_response.text}")
        return None


def upload_folder(folder: Path, gallery_id: str):
    """Upload all supported images from a folder."""
    files = sorted([
        f for f in folder.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ])

    if not files:
        print(f"[INFO] No supported images found in {folder}")
        return

    print(f"[INFO] Found {len(files)} images to upload")
    uploaded = 0

    for filepath in tqdm(files, desc="Uploading"):
        result = upload_file(filepath, gallery_id)
        if result:
            uploaded += 1

    print(f"\n[DONE] Uploaded {uploaded}/{len(files)} photos to gallery {gallery_id}")


def watch_folder(folder: Path, gallery_id: str, interval: int = 5):
    """Watch a folder for new files and auto-upload."""
    print(f"[INFO] Watching {folder} for new images (Ctrl+C to stop)...")
    uploaded_files = set()

    # Track existing files
    for f in folder.iterdir():
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS:
            uploaded_files.add(f.name)

    try:
        while True:
            for f in folder.iterdir():
                if (
                    f.is_file()
                    and f.suffix.lower() in SUPPORTED_EXTENSIONS
                    and f.name not in uploaded_files
                ):
                    print(f"\n[NEW] {f.name}")
                    result = upload_file(f, gallery_id)
                    if result:
                        uploaded_files.add(f.name)
                        print(f"[UPLOADED] {f.name}")
            time.sleep(interval)
    except KeyboardInterrupt:
        print(f"\n[INFO] Stopped watching. {len(uploaded_files)} files tracked.")


def main():
    parser = argparse.ArgumentParser(description="Upload photos to Supabase gallery")
    parser.add_argument("--folder", required=True, help="Folder with Lightroom exports")
    parser.add_argument("--gallery-id", required=True, help="Supabase gallery UUID")
    parser.add_argument("--watch", action="store_true",
                        help="Watch folder for new files")
    args = parser.parse_args()

    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"[ERROR] Folder not found: {folder}")
        sys.exit(1)

    check_credentials()

    if args.watch:
        watch_folder(folder, args.gallery_id)
    else:
        upload_folder(folder, args.gallery_id)


if __name__ == "__main__":
    main()
