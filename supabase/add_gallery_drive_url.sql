-- Adds drive_url so each gallery can link to its full Google Drive album.
-- Site shows curated photos; Drive holds the full set for download.
-- Safe to re-run.

alter table public.galleries
  add column if not exists drive_url text;
