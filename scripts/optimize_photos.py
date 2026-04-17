#!/usr/bin/env python3
"""
Tsakani Sessions - Photo Optimizer

Converts Lightroom exports (large JPEGs, often 3-8MB each) into
web-optimized JPEGs (target ~1MB, max 2048px on longest edge).

This keeps gallery uploads lean so you stay within Supabase free tier
for as long as possible.

Usage:
    python optimize_photos.py --input ./raw-photos --output ./web-photos
    python optimize_photos.py --input ./raw-photos --output ./web-photos --max-mb 0.8

Then upload the contents of `--output` via the admin gallery uploader.
"""

import argparse
import os
import sys
from pathlib import Path
from PIL import Image, ExifTags


def get_orientation(img):
    """Read EXIF orientation so we don't rotate portraits wrongly."""
    try:
        exif = img._getexif()
        if not exif:
            return 1
        for tag, value in exif.items():
            if ExifTags.TAGS.get(tag) == "Orientation":
                return value
    except Exception:
        pass
    return 1


def apply_orientation(img):
    """Apply EXIF orientation so the image is upright without relying on EXIF."""
    orientation = get_orientation(img)
    rotations = {3: 180, 6: 270, 8: 90}
    if orientation in rotations:
        img = img.rotate(rotations[orientation], expand=True)
    return img


def optimize_image(src_path: Path, dst_path: Path, max_dim: int, target_mb: float):
    img = Image.open(src_path)
    img = apply_orientation(img)

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # Resize if needed
    w, h = img.size
    if max(w, h) > max_dim:
        if w >= h:
            new_w = max_dim
            new_h = int(h * (max_dim / w))
        else:
            new_h = max_dim
            new_w = int(w * (max_dim / h))
        img = img.resize((new_w, new_h), Image.LANCZOS)

    # Save with binary-search on quality to hit target size
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    target_bytes = int(target_mb * 1024 * 1024)
    lo, hi = 40, 95
    best_quality = 85
    while lo <= hi:
        mid = (lo + hi) // 2
        img.save(dst_path, "JPEG", quality=mid, optimize=True, progressive=True)
        size = dst_path.stat().st_size
        if size <= target_bytes:
            best_quality = mid
            lo = mid + 1
        else:
            hi = mid - 1

    # Final save at best quality found
    img.save(dst_path, "JPEG", quality=best_quality, optimize=True, progressive=True)
    return dst_path.stat().st_size


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Folder of source JPEGs/PNGs")
    parser.add_argument("--output", required=True, help="Folder to write optimized photos")
    parser.add_argument("--max-dim", type=int, default=2048,
                        help="Max longest-edge pixels (default 2048)")
    parser.add_argument("--max-mb", type=float, default=1.0,
                        help="Target max file size in MB (default 1.0)")
    args = parser.parse_args()

    src_dir = Path(args.input)
    dst_dir = Path(args.output)

    if not src_dir.is_dir():
        print(f"[ERROR] Input folder not found: {src_dir}")
        sys.exit(1)

    extensions = {".jpg", ".jpeg", ".png", ".heic", ".tiff", ".webp"}
    files = sorted([f for f in src_dir.iterdir() if f.suffix.lower() in extensions])

    if not files:
        print(f"[INFO] No supported images in {src_dir}")
        return

    total_before = sum(f.stat().st_size for f in files)
    total_after = 0
    print(f"[INFO] Processing {len(files)} files -> {dst_dir}")

    for i, f in enumerate(files, 1):
        dst = dst_dir / (f.stem + ".jpg")
        try:
            new_size = optimize_image(f, dst, args.max_dim, args.max_mb)
            total_after += new_size
            ratio = new_size / f.stat().st_size
            print(f"  [{i}/{len(files)}] {f.name:40s}  "
                  f"{f.stat().st_size / 1024 / 1024:5.1f} MB -> {new_size / 1024 / 1024:4.2f} MB "
                  f"({ratio * 100:.0f}%)")
        except Exception as e:
            print(f"  [!] Failed {f.name}: {e}")

    savings = 1 - (total_after / total_before) if total_before else 0
    print(f"\n[DONE] Total: {total_before / 1024 / 1024:.1f} MB -> "
          f"{total_after / 1024 / 1024:.1f} MB ({savings * 100:.0f}% smaller)")
    print(f"[DONE] Upload contents of {dst_dir} to the admin gallery.")


if __name__ == "__main__":
    main()
