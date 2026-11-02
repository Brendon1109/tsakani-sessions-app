-- When each gallery photo was taken. 2 November 2026.
--
-- Galleries showed photos in the order they finished uploading, and every
-- photo had sort_order 0, so two photos uploading at once could swap and a
-- person's burst of shots ended up scattered. The admin uploader now reads
-- the camera's capture time (EXIF DateTimeOriginal) before compressing,
-- because compression strips EXIF, and sends it as taken_at. Galleries order
-- by sort_order, then taken_at, then created_at, so shots taken together sit
-- together.
--
-- Photos uploaded before this have no capture time left in their files, so
-- they keep upload order, after any timed photos.
--
-- Additive only. Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.
-- The code falls back to upload order while the column is missing, so the
-- order of SQL and deploy does not matter. Safe to re-run.

alter table public.gallery_photos
  add column if not exists taken_at timestamptz;

create index if not exists gallery_photos_gallery_taken_idx
  on public.gallery_photos (gallery_id, sort_order, taken_at, created_at);
