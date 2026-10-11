-- DJS: the public roster at /djs, and "Book this DJ" on booking enquiries.
--
-- Two things happen in this file.
--
-- 1. A djs table. One row per DJ: a name, a short description, a photo, a
--    few genre tags and four links. Nothing personal lives here, no real
--    names, phone numbers or emails, which is why this is a new table rather
--    than more columns on team_members (that one holds phone and email and
--    stays admin only).
--    Every row is public, so adding a DJ is publishing them. Visitors read,
--    admins write, matching the "Admins manage products" policy. The roster
--    shows DJs in the order they were added.
--
--    slug is derived from the name by the admin API and is unique. photo_path
--    is a path inside the public gallery-photos bucket, under djs/, never a
--    full URL, so a row cannot point the site at an image host the CSP has
--    never heard of. genres and soundcloud_url come last only because they
--    were added to the live table after the rest; the order means nothing.
--
-- 2. booking_enquiries gains requested_dj_id and requested_dj_name.
--    /api/bookings resolves the slug the browser sends to a DJ itself and
--    stores the id with a snapshot of the name from that row, never a name
--    typed by the visitor. The id is set to null if the DJ is removed, and the
--    snapshot stays, so the enquiry still says who was asked for. The
--    restrictive insert policy below holds the same line for anyone who skips
--    the API and writes to the table with the anon key directly. Enquiries
--    without a DJ are untouched by it.
--
-- Additive only. Run after schema.sql and booking_enquiries.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- DJS
-- ---------------------------------------------------------------------------

create table if not exists public.djs (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(btrim(name)) between 1 and 80),
  slug text not null unique
    check (char_length(slug) <= 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  photo_path text
    check (photo_path is null or photo_path ~ '^djs/[A-Za-z0-9._-]{1,120}$'),
  description text
    check (description is null or char_length(description) <= 500),
  instagram_url text check (instagram_url is null or instagram_url ~ '^https://'),
  tiktok_url text check (tiktok_url is null or tiktok_url ~ '^https://'),
  -- A channel or a single video. A video is also embedded and lends its
  -- thumbnail when there is no photo.
  youtube_url text check (youtube_url is null or youtube_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Short tags, "Deep House", "Amapiano". Empty is normal.
  genres text[] not null default '{}'
    check (cardinality(genres) <= 8),
  soundcloud_url text check (soundcloud_url is null or soundcloud_url ~ '^https://')
);

comment on table public.djs is
  'Public DJ roster, in the order added. Nothing personal. Visitors read every row, admins write.';

alter table public.djs enable row level security;

-- Visitors only ever read. The grants make sure no write path exists for anon.
revoke all on table public.djs from anon;
grant select on table public.djs to anon;
revoke truncate, references, trigger on table public.djs from authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'djs'
      and policyname = 'Public read djs'
  ) then
    create policy "Public read djs" on public.djs
      for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'djs'
      and policyname = 'Admins manage djs'
  ) then
    create policy "Admins manage djs" on public.djs
      for all
      using (
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      )
      with check (
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- BOOKING ENQUIRIES: the requested DJ
-- ---------------------------------------------------------------------------

alter table public.booking_enquiries
  add column if not exists requested_dj_id uuid
  references public.djs (id) on delete set null;

alter table public.booking_enquiries
  add column if not exists requested_dj_name text;

create index if not exists booking_enquiries_requested_dj_idx
  on public.booking_enquiries (requested_dj_id);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'booking_enquiries'
      and policyname = 'Requested DJ must match the roster'
  ) then
    -- RESTRICTIVE, so it narrows "Anyone can submit a booking" rather than
    -- widening anything: either no DJ at all, or a real DJ with that DJ's own
    -- name as the snapshot.
    create policy "Requested DJ must match the roster" on public.booking_enquiries
      as restrictive
      for insert to anon, authenticated
      with check (
        (requested_dj_id is null and requested_dj_name is null)
        or exists (
          select 1 from public.djs d
          where d.id = requested_dj_id and d.name = requested_dj_name
        )
      );
  end if;
end
$$;
