-- Drop gallery_views. 11 October 2026.
--
-- /gallery/<slug> wrote a row for every signed in visitor who opened a gallery,
-- and /admin/leads listed them as "Gallery view" leads. Recording who looked
-- at which photos is not something the privacy page lists, it had never held a
-- row in production, and the app stopped writing and reading it in the same
-- PR as this file. schema.sql no longer creates it, so a fresh project never
-- has it and this file is a no-op there.
--
-- What production held when this was written, read through the Management API
-- on 11 October 2026: gallery_views 0 rows, two policies ("Authenticated
-- insert gallery views", "Admins read gallery views"), no foreign key, view or
-- function pointing at it.
--
-- Run it AFTER the deploy that stops the app writing it. Idempotent, safe to
-- re-run. It refuses to drop the table if it has gained rows, and it uses no
-- CASCADE, so anything unexpected that depends on it makes it fail rather
-- than disappear with it.

begin;

do $$
declare
  n bigint;
begin
  if to_regclass('public.gallery_views') is not null then
    execute 'select count(*) from public.gallery_views' into n;
    if n > 0 then
      raise exception 'gallery_views has % rows. Export them before dropping.', n;
    end if;
  end if;
end $$;

drop table if exists public.gallery_views;

commit;
