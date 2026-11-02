-- Logos stamped onto gallery photos at upload. 2 November 2026.
--
-- The admin gallery upload can brand each photo with a logo, bottom centre,
-- drawn in the browser while the photo is compressed. This table is the logo
-- library: one row per logo, and at most one marked as the default, which the
-- upload screen picks on its own.
--
-- src is what the browser draws. The built in Tsakani Sessions logo ships
-- with the site at /branding/tsakani-sessions-logo.png. Logos added from
-- admin are uploaded to the gallery-photos bucket under branding/, and their
-- src is the public storage URL, with storage_path kept so a delete can
-- remove the file too.
--
-- Admins only, by RLS, for reading and writing. Visitors never need the list,
-- the branding is already inside the photo.
--
-- Additive only. Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.
-- Safe to re-run.

create table if not exists public.gallery_logos (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  src text not null,
  storage_path text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists gallery_logos_one_default
  on public.gallery_logos (is_default) where is_default;

alter table public.gallery_logos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'gallery_logos'
       and policyname = 'Admins manage gallery logos'
  ) then
    create policy "Admins manage gallery logos" on public.gallery_logos
      for all
      using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
      with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
  end if;
end;
$$;

-- The built in logo, the default until another is chosen.
insert into public.gallery_logos (name, src, is_default)
select 'Tsakani Sessions, white', '/branding/tsakani-sessions-logo.png', true
 where not exists (
   select 1 from public.gallery_logos where src = '/branding/tsakani-sessions-logo.png'
 );

-- Swap the default in one transaction. Clear first, then set, because a
-- unique index is checked row by row and a single swapping update can trip it.
-- Runs as the caller, so RLS still limits it to admins.
create or replace function public.set_default_gallery_logo(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.gallery_logos where id = p_id) then
    raise exception 'logo not found';
  end if;
  update public.gallery_logos set is_default = false where is_default and id <> p_id;
  update public.gallery_logos set is_default = true where id = p_id;
end;
$$;

revoke all on function public.set_default_gallery_logo(uuid) from public, anon;
grant execute on function public.set_default_gallery_logo(uuid) to authenticated;
