-- Drop the video pipeline tables. Written 11 October 2026.
--
-- The admin Video and Social Uploads pages, their API routes and the local
-- Python worker were removed from the app, so nothing reads or writes these
-- two tables any more. schema.sql and critical_fixes.sql no longer create
-- them, so a fresh project never has them and this file is a no-op there.
--
-- What production held when this was written, read through the Management API
-- on 11 October 2026:
--   video_projects  0 rows. Primary key, status check, foreign key to events,
--                   one policy ("Admins manage video projects").
--   video_jobs      0 rows. Primary key, status check, foreign key to
--                   video_projects, index idx_video_jobs_status, one policy
--                   ("Admins manage video jobs").
--   No function, view, trigger, publication or storage object refers to
--   either table, and no storage bucket served only the pipeline.
-- Dropping a table drops its own indexes, constraints and policies, so the two
-- DROP statements are the whole cleanup.
--
-- Run it AFTER the deploy that removes the pipeline code. Idempotent, safe to
-- re-run. It refuses to drop a table that has gained rows since, so nothing is
-- lost silently, and it uses no CASCADE, so anything unexpected that depends
-- on these tables makes it fail rather than disappear with them.

begin;

do $$
declare
  n bigint;
begin
  if to_regclass('public.video_jobs') is not null then
    execute 'select count(*) from public.video_jobs' into n;
    if n > 0 then
      raise exception 'video_jobs has % rows. Export them before dropping.', n;
    end if;
  end if;
  if to_regclass('public.video_projects') is not null then
    execute 'select count(*) from public.video_projects' into n;
    if n > 0 then
      raise exception 'video_projects has % rows. Export them before dropping.', n;
    end if;
  end if;
end $$;

-- video_jobs first, it holds the foreign key to video_projects.
drop table if exists public.video_jobs;
drop table if exists public.video_projects;

commit;
