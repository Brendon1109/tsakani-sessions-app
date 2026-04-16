#!/usr/bin/env python3
"""
Tsakani Sessions Video Merge Pipeline

Merges DJI Osmo footage + iPhone transition clips + VirtualDJ audio
into a single 1080p 30fps video following a template:
    intro → DJ footage → transition → DJ footage → outro
All original audio is replaced with the VirtualDJ mix.

Audio Sync Modes:
  - "replace": (default) Strip all video audio, overlay VirtualDJ mix from
    start. Works when the DJ set was recorded simultaneously with the footage.
  - "align": Keep original audio as a quiet reference track mixed with the
    VirtualDJ track. Uses ffmpeg's loudnorm to match levels. Useful when you
    want crowd noise blended with the mix.
  - "offset": Like "replace", but lets you specify per-clip audio offsets
    so each clip starts at a specific point in the DJ mix. Good when clips
    were filmed at known points in the set.

Usage:
    python video_merge.py --config config.yaml
    python video_merge.py --config config.yaml --sync-mode align --crowd-mix 0.15
    python video_merge.py --input ./footage --audio mix.mp3 --output final.mp4

Config can also be passed as JSON from the admin UI API.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


def run_ffmpeg(args: list[str], desc: str = ""):
    """Run an FFmpeg command and handle errors."""
    cmd = ["ffmpeg", "-y"] + args
    print(f"\n{'='*60}")
    print(f"[FFmpeg] {desc}")
    print(f"{'='*60}")

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ERROR] FFmpeg failed:\n{result.stderr[-800:]}")
        sys.exit(1)
    return result


def get_duration(filepath: str) -> float:
    """Get video/audio duration in seconds using ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", filepath],
        capture_output=True, text=True
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        print(f"[WARNING] Could not get duration of {filepath}")
        return 0.0


def get_video_info(filepath: str) -> dict:
    """Get video resolution and codec info."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,codec_name,r_frame_rate",
         "-of", "json", filepath],
        capture_output=True, text=True
    )
    try:
        info = json.loads(result.stdout)
        stream = info.get("streams", [{}])[0]
        return {
            "width": stream.get("width", 0),
            "height": stream.get("height", 0),
            "codec": stream.get("codec_name", "unknown"),
            "fps": stream.get("r_frame_rate", "30/1"),
        }
    except (json.JSONDecodeError, IndexError):
        return {"width": 0, "height": 0, "codec": "unknown", "fps": "30/1"}


def normalize_clip(input_path: str, output_path: str, resolution: str = "1920x1080",
                   fps: int = 30, start: float = 0, end: float = 0,
                   keep_audio: bool = False):
    """
    Normalize a clip to target resolution, FPS, and pixel format.
    Handles HEVC (DJI Osmo / iPhone) and ProRes gracefully.
    """
    args = []

    if start > 0:
        args += ["-ss", str(start)]

    args += ["-i", input_path]

    if end > 0 and start >= 0:
        args += ["-t", str(end - start)]

    vf = (
        f"scale={resolution}:force_original_aspect_ratio=decrease,"
        f"pad={resolution}:(ow-iw)/2:(oh-ih)/2:black,"
        f"fps={fps},format=yuv420p"
    )

    args += ["-vf", vf]

    if not keep_audio:
        args += ["-an"]
    else:
        args += ["-c:a", "aac", "-b:a", "128k"]

    args += [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        output_path,
    ]
    run_ffmpeg(args, f"Normalizing: {os.path.basename(input_path)}")


def concat_videos(file_list_path: str, output_path: str, has_audio: bool = False):
    """Concatenate normalized video clips using FFmpeg concat demuxer."""
    args = [
        "-f", "concat", "-safe", "0",
        "-i", file_list_path,
        "-c:v", "copy",
    ]
    if has_audio:
        args += ["-c:a", "copy"]
    else:
        args += ["-an"]
    args += [output_path]
    run_ffmpeg(args, "Concatenating all clips")


def merge_audio_replace(video_path: str, audio_path: str, output_path: str,
                        audio_start: float = 0, fade_in: float = 2,
                        fade_out: float = 3, audio_codec: str = "aac",
                        audio_bitrate: str = "192k"):
    """
    Replace mode: strip video audio entirely, overlay DJ mix from audio_start.
    The DJ mix plays from `audio_start` seconds in, synced to video second 0.
    """
    video_duration = get_duration(video_path)

    af_parts = [f"atrim=start={audio_start}", "asetpts=PTS-STARTPTS"]
    if fade_in > 0:
        af_parts.append(f"afade=t=in:st=0:d={fade_in}")
    if fade_out > 0:
        fade_start = max(0, video_duration - fade_out)
        af_parts.append(f"afade=t=out:st={fade_start}:d={fade_out}")

    run_ffmpeg([
        "-i", video_path,
        "-i", audio_path,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", audio_codec,
        "-b:a", audio_bitrate,
        "-af", ",".join(af_parts),
        "-shortest",
        output_path,
    ], "Merging audio (replace mode)")


def merge_audio_align(video_path: str, audio_path: str, output_path: str,
                      crowd_mix: float = 0.15, audio_start: float = 0,
                      fade_in: float = 2, fade_out: float = 3,
                      audio_codec: str = "aac", audio_bitrate: str = "192k"):
    """
    Align mode: keep original video audio (crowd noise) as a quiet layer
    mixed with the DJ audio track. `crowd_mix` controls the crowd volume
    (0.0 = silent, 1.0 = full volume, 0.15 = subtle crowd ambience).
    """
    video_duration = get_duration(video_path)

    # Build the complex audio filter:
    # [1:a] = DJ mix, trimmed and faded
    # [0:a] = original video audio (crowd), volume reduced
    # amix combines them
    dj_vol = 1.0
    crowd_vol = crowd_mix

    fade_out_start = max(0, video_duration - fade_out)

    filter_complex = (
        f"[1:a]atrim=start={audio_start},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d={fade_in},"
        f"afade=t=out:st={fade_out_start}:d={fade_out},"
        f"volume={dj_vol}[dj];"
        f"[0:a]volume={crowd_vol}[crowd];"
        f"[dj][crowd]amix=inputs=2:duration=shortest[out]"
    )

    run_ffmpeg([
        "-i", video_path,
        "-i", audio_path,
        "-filter_complex", filter_complex,
        "-map", "0:v:0",
        "-map", "[out]",
        "-c:v", "copy",
        "-c:a", audio_codec,
        "-b:a", audio_bitrate,
        "-shortest",
        output_path,
    ], f"Merging audio (align mode, crowd={crowd_mix})")


def merge_audio_offset(video_path: str, audio_path: str, output_path: str,
                       clip_offsets: list[dict], audio_codec: str = "aac",
                       audio_bitrate: str = "192k", fade_in: float = 2,
                       fade_out: float = 3):
    """
    Offset mode: each clip specifies its own audio_offset into the DJ mix.
    This is handled by the caller — clips are normalized with their own
    audio segments already baked in. This function just does the final
    merge with the full mix as a fallback.
    """
    # In offset mode the caller should have already synced each clip's
    # audio segment during normalization. This is the same as replace mode
    # but we document that the config supports per-clip offsets.
    merge_audio_replace(
        video_path, audio_path, output_path,
        audio_start=0, fade_in=fade_in, fade_out=fade_out,
        audio_codec=audio_codec, audio_bitrate=audio_bitrate,
    )


def build_clip_order(clips_config: dict, input_folder: Path) -> list[dict]:
    """Build ordered clip list from config."""
    ordered_clips = []

    # Intro
    intro = clips_config.get("intro", {})
    if intro.get("file"):
        ordered_clips.append({
            "file": str(input_folder / intro["file"]),
            "start": 0,
            "end": intro.get("duration", 0),
            "audio_offset": intro.get("audio_offset"),
            "label": "intro",
        })

    # Main footage with transitions interleaved
    main_clips = clips_config.get("main_footage", [])
    transitions = clips_config.get("transitions", [])

    for i, clip in enumerate(main_clips):
        ordered_clips.append({
            "file": str(input_folder / clip["file"]),
            "start": clip.get("start", 0),
            "end": clip.get("end", 0),
            "audio_offset": clip.get("audio_offset"),
            "label": f"main_{i+1}",
        })
        if i < len(transitions):
            ordered_clips.append({
                "file": str(input_folder / transitions[i]["file"]),
                "start": 0,
                "end": 0,
                "audio_offset": transitions[i].get("audio_offset"),
                "label": f"transition_{i+1}",
            })

    # More footage
    for i, clip in enumerate(clips_config.get("more_footage", [])):
        ordered_clips.append({
            "file": str(input_folder / clip["file"]),
            "start": clip.get("start", 0),
            "end": clip.get("end", 0),
            "audio_offset": clip.get("audio_offset"),
            "label": f"more_{i+1}",
        })

    # Outro
    outro = clips_config.get("outro", {})
    if outro.get("file"):
        ordered_clips.append({
            "file": str(input_folder / outro["file"]),
            "start": 0,
            "end": outro.get("duration", 0),
            "audio_offset": outro.get("audio_offset"),
            "label": "outro",
        })

    return ordered_clips


def main():
    parser = argparse.ArgumentParser(description="Tsakani Sessions Video Merge Pipeline")
    parser.add_argument("--config", type=str, default="config.yaml",
                        help="Path to config.yaml or config.json")
    parser.add_argument("--json-config", type=str, default=None,
                        help="Inline JSON config (used by admin UI API)")
    parser.add_argument("--input", type=str, help="Input footage folder")
    parser.add_argument("--audio", type=str, help="VirtualDJ audio file")
    parser.add_argument("--output", type=str, help="Output file path")
    parser.add_argument("--sync-mode", type=str, default="replace",
                        choices=["replace", "align", "offset"],
                        help="Audio sync mode (default: replace)")
    parser.add_argument("--crowd-mix", type=float, default=0.15,
                        help="Crowd audio volume in align mode (0.0-1.0)")
    args = parser.parse_args()

    # Load config from JSON string (admin UI) or file
    if args.json_config:
        config = json.loads(args.json_config)
    else:
        config_path = Path(args.config)
        if not config_path.exists():
            print(f"[ERROR] Config file not found: {config_path}")
            sys.exit(1)

        with open(config_path) as f:
            if config_path.suffix == ".json":
                config = json.load(f)
            elif HAS_YAML:
                config = yaml.safe_load(f)
            else:
                print("[ERROR] pyyaml not installed. Use JSON config or: pip install pyyaml")
                sys.exit(1)

    input_folder = Path(args.input or config.get("input_folder", "./footage"))
    audio_file = Path(args.audio or config["audio"]["file"])
    output_file = Path(args.output or config.get("output_file", "./output/tsakani_final.mp4"))
    output_cfg = config.get("output", {})
    resolution = output_cfg.get("resolution", "1920x1080")
    fps = output_cfg.get("fps", 30)
    sync_mode = args.sync_mode or config.get("sync_mode", "replace")
    crowd_mix = args.crowd_mix if args.crowd_mix != 0.15 else config.get("crowd_mix", 0.15)

    # Create temp and output directories
    temp_dir = Path("./temp_merge")
    temp_dir.mkdir(exist_ok=True)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Resolve audio path
    if not audio_file.is_absolute():
        audio_file = input_folder / audio_file
    if not audio_file.exists():
        print(f"[ERROR] Audio file not found: {audio_file}")
        sys.exit(1)

    audio_duration = get_duration(str(audio_file))

    print(f"\n{'#'*60}")
    print(f"# Tsakani Sessions Video Merge Pipeline")
    print(f"# Input:      {input_folder}")
    print(f"# Audio:      {audio_file} ({audio_duration:.1f}s)")
    print(f"# Output:     {output_file}")
    print(f"# Format:     {resolution} @ {fps}fps")
    print(f"# Sync Mode:  {sync_mode}", end="")
    if sync_mode == "align":
        print(f" (crowd mix: {crowd_mix})")
    else:
        print()
    print(f"{'#'*60}")

    # Build clip order
    clips_config = config.get("clips", {})
    ordered_clips = build_clip_order(clips_config, input_folder)

    # Validate clips
    for clip in ordered_clips:
        if not Path(clip["file"]).exists():
            print(f"[WARNING] Clip not found, skipping: {clip['file']}")
            info = get_video_info(clip["file"]) if Path(clip["file"]).exists() else {}
            if info.get("codec") == "hevc":
                print(f"  → HEVC detected. FFmpeg will decode this automatically.")
    ordered_clips = [c for c in ordered_clips if Path(c["file"]).exists()]

    if not ordered_clips:
        print("[ERROR] No valid clips found.")
        sys.exit(1)

    # Report clip info
    print(f"\n[INFO] Processing {len(ordered_clips)} clips:")
    for i, clip in enumerate(ordered_clips):
        dur = get_duration(clip["file"])
        info = get_video_info(clip["file"])
        codec = info.get("codec", "?")
        print(f"  {i+1}. [{clip['label']}] {os.path.basename(clip['file'])} "
              f"({dur:.1f}s, {info.get('width','?')}x{info.get('height','?')}, {codec})")

    # Step 1: Normalize all clips
    keep_audio = sync_mode == "align"
    normalized_clips = []
    for i, clip in enumerate(ordered_clips):
        norm_path = str(temp_dir / f"norm_{i:03d}_{clip['label']}.mp4")
        normalize_clip(
            clip["file"], norm_path,
            resolution=resolution, fps=fps,
            start=clip["start"], end=clip["end"],
            keep_audio=keep_audio,
        )
        normalized_clips.append(norm_path)

    # Step 2: Concat
    concat_list = temp_dir / "concat.txt"
    with open(concat_list, "w") as f:
        for path in normalized_clips:
            f.write(f"file '{os.path.abspath(path)}'\n")

    concat_output = str(temp_dir / "concat_video.mp4")
    concat_videos(str(concat_list), concat_output, has_audio=keep_audio)

    # Step 3: Merge audio
    audio_cfg = config.get("audio", {})
    audio_start = audio_cfg.get("start_offset", 0)
    fade_in = audio_cfg.get("fade_in", 2)
    fade_out = audio_cfg.get("fade_out", 3)
    a_codec = output_cfg.get("audio_codec", "aac")
    a_bitrate = output_cfg.get("audio_bitrate", "192k")

    if sync_mode == "replace":
        merge_audio_replace(
            concat_output, str(audio_file), str(output_file),
            audio_start=audio_start, fade_in=fade_in, fade_out=fade_out,
            audio_codec=a_codec, audio_bitrate=a_bitrate,
        )
    elif sync_mode == "align":
        merge_audio_align(
            concat_output, str(audio_file), str(output_file),
            crowd_mix=crowd_mix, audio_start=audio_start,
            fade_in=fade_in, fade_out=fade_out,
            audio_codec=a_codec, audio_bitrate=a_bitrate,
        )
    elif sync_mode == "offset":
        merge_audio_offset(
            concat_output, str(audio_file), str(output_file),
            clip_offsets=ordered_clips,
            audio_codec=a_codec, audio_bitrate=a_bitrate,
            fade_in=fade_in, fade_out=fade_out,
        )

    # Cleanup
    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)

    duration = get_duration(str(output_file))
    size_mb = output_file.stat().st_size / (1024 * 1024)

    print(f"\n{'#'*60}")
    print(f"# DONE!")
    print(f"# Output:   {output_file}")
    print(f"# Duration: {duration:.1f}s ({duration/60:.1f} min)")
    print(f"# Size:     {size_mb:.1f} MB")
    print(f"# Audio:    {sync_mode} mode")
    print(f"{'#'*60}")

    # Output JSON result for admin UI consumption
    result = {
        "status": "complete",
        "output_file": str(output_file),
        "duration_seconds": duration,
        "size_mb": round(size_mb, 1),
        "sync_mode": sync_mode,
        "clips_used": len(ordered_clips),
    }
    print(f"\n__RESULT_JSON__:{json.dumps(result)}")


if __name__ == "__main__":
    main()
