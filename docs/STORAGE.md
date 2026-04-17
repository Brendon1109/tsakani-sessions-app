# Storage Strategy

## The principle

**Raw footage never goes to the cloud.** Cloud storage is for **distribution** (what your audience sees), not for **archival** (what you keep forever).

Why? Raw event footage is 30 GB+. Cloud storage at that volume costs real money
(Supabase Pro is 100 GB for ~R450/mo). External SSDs cost ~R1,500 one-off for 1 TB.

## What lives where

| Asset | Size (per event) | Location | Cost |
|---|---|---|---|
| DJI Osmo raw 4K | ~20 GB | External SSD / NAS | One-off SSD cost |
| iPhone raw clips | ~7 GB | External SSD / NAS | — |
| Lightroom RAW photos | ~2 GB | External SSD / NAS | — |
| VirtualDJ audio mix | ~100 MB | External SSD / NAS | — |
| **Aftermovie MP4 (1080p)** | ~500 MB | **YouTube** | FREE forever |
| **Web-optimized photos** (~1MB × 150) | ~150 MB | **Supabase Storage** | FREE up to 1 GB, then R450/mo for 100 GB |
| **Short clips** | ~200 MB | **TikTok / IG / Shorts** | FREE — social platforms store them |

**Total cloud footprint per event: ~850 MB**

## The workflow

### 1. Filming (raw → SSD)
Transfer all raw footage to your external SSD in a folder per event:

```
/Tsakani Footage/
  /2026-06-01 Sunset Cruise/
    /dji/          # DJI Osmo files
    /iphone/       # iPhone transitions
    /lightroom/    # Photo RAW files
    /virtualdj.mp3 # DJ set audio
```

### 2. Photo workflow
1. Edit RAWs in Lightroom as usual
2. Export at full quality to `./raw-photos/` (any folder)
3. Run:
   ```
   python scripts/optimize_photos.py --input ./raw-photos --output ./web-photos
   ```
4. The script:
   - Resizes to 2048px on longest edge
   - Compresses to ~1 MB each using binary-search quality
   - Fixes EXIF orientation so portraits stay upright
5. Upload contents of `./web-photos/` via the admin gallery uploader
6. Keep `./raw-photos/` on your SSD as the archive

**Result:** a 150-photo gallery that was 2 GB raw → ~150 MB on Supabase.

### 3. Video workflow
1. Assemble your clip order in the admin Video Pipeline UI → Queue for Worker
2. On your laptop (with your external SSD attached):
   ```
   python scripts/video_worker.py
   ```
3. Worker picks up the job, reads footage from the SSD, renders MP4 locally
4. You upload the final MP4 to YouTube (either manually or via
   `scripts/youtube_upload.py`)
5. Raw footage stays on the SSD. Only the ~500 MB finished MP4 goes to YouTube.

### 4. Short-form clips (TikTok / IG Reels / YouTube Shorts)
1. Edit clips in CapCut / Premiere / whatever
2. Upload directly to each platform via your phone
3. Pin the posts to the homepage via **Admin → Featured Posts**
4. Nothing stored in your cloud — the platforms host them

## Scale breakpoints

On the **Supabase free tier (1 GB)** with optimized photos:
- Photos only: ~6-7 events before full
- Then upgrade to Supabase Pro (100 GB / R450/mo): ~120 events

On **YouTube** (unlimited): forever free, no cap.

**When you outgrow Supabase Pro (100 GB):**
Archive old event galleries to your SSD and delete the oldest from Supabase. You can keep the gallery link working by re-uploading a few "highlights" per past event.

## Rule of thumb

- **If it's raw** → lives on your SSD/NAS, never cloud
- **If it's for the public** → YouTube (video), Supabase Storage (photos), TikTok/IG (shorts)
- **If you're not sure** → it probably doesn't need to be in the cloud

Storage discipline is how small brands stay on free tiers. Most of what feels "big" isn't — it's raw footage you never look at again after editing.
