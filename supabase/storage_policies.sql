-- Storage RLS policies for the gallery-photos bucket.
-- Allows public read (matches the bucket's "public" toggle) and lets
-- authenticated admins upload, replace, and delete objects.
-- Run once in the Supabase SQL Editor; safe to re-run (drops + recreates).

-- READ: anyone can fetch public URLs
drop policy if exists "Public read gallery-photos" on storage.objects;
create policy "Public read gallery-photos"
on storage.objects for select
using (bucket_id = 'gallery-photos');

-- INSERT: only admins can upload
drop policy if exists "Admins upload to gallery-photos" on storage.objects;
create policy "Admins upload to gallery-photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'gallery-photos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- UPDATE: only admins can replace existing objects
drop policy if exists "Admins update gallery-photos" on storage.objects;
create policy "Admins update gallery-photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'gallery-photos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- DELETE: only admins can remove objects
drop policy if exists "Admins delete gallery-photos" on storage.objects;
create policy "Admins delete gallery-photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'gallery-photos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);
