-- Gallery photos on Cloudflare R2. 2 November 2026.
--
-- gallery_photos.storage says where a photo's files are:
--   'supabase'  the Supabase bucket gallery-photos, the way every photo was
--   'r2'        the R2 bucket tsakani-photos, the photo plus its md/ and sm/
--               copies, served from photos.tsakanisessions.co.za
-- lib/photo-storage.ts builds the addresses from it. The admin uploader
-- writes 'r2' rows. scripts/move-photos-to-r2.mjs copies a 'supabase' photo
-- to R2 and only then flips its row, leaving the Supabase copy as a backup.
--
-- Additive only. Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.
-- Safe to re-run. The existing RLS covers the column: admins manage photos,
-- visitors read them.

alter table public.gallery_photos
  add column if not exists storage text not null default 'supabase';

alter table public.gallery_photos
  drop constraint if exists gallery_photos_storage_check;

alter table public.gallery_photos
  add constraint gallery_photos_storage_check check (storage in ('supabase', 'r2'));
