-- Find me, the on device face match on event galleries. 2 November 2026.
--
-- Legal basis and every rule behind these two columns:
-- legal/tsakani-find-my-photos-popia-2026-11-02.md in Brendon's Breazy repo.
--
-- 1. galleries.find_me_enabled, off by default. An admin switches it on per
--    gallery, for events where guests were told about Find me on the night.
-- 2. gallery_photos.find_me_excluded. An admin marks a photo to leave out of
--    Find me (someone asked not to be found this way). The photo still shows
--    in the gallery, Find me just never scans it.
--
-- No face data is ever stored anywhere. The match runs in the guest's own
-- browser and nothing about a face reaches the server.
--
-- Additive only. Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.
-- Safe to re-run. The existing RLS covers both: admins manage galleries and
-- photos, visitors read them.

alter table public.galleries
  add column if not exists find_me_enabled boolean not null default false;

alter table public.gallery_photos
  add column if not exists find_me_excluded boolean not null default false;
