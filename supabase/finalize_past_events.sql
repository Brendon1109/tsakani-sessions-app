-- Finished events become 'past'. 11 October 2026.
--
-- The nightly cron at app/api/cron/finalize-events updated events and tickets
-- on the anon key. The only UPDATE policies on both tables are the admin ones,
-- so it matched zero rows every night and answered 200, and every finished
-- event stayed 'published'. Same RLS trap as the merch cleanup in
-- merch_store.sql and lock_down_inventory_functions.sql.
--
-- Two things in this file.
--
-- 1. finalize_past_events(p_hours), service role only. In one transaction it
--    marks every published event that started more than p_hours ago as past,
--    and closes every ticket still on sale for an event that is past and
--    older than the same line. p_hours never goes below 28, which is past the
--    04:00 Africa/Johannesburg cutoff the morning after any start time (the
--    same line isEventPast() in lib/date.ts draws), so no caller can end an
--    event that is still on. Running it twice changes nothing the second time.
--
-- 2. A public read policy for past events. "Public read published events"
--    lets visitors see status = 'published' only, so without this a finished
--    event would vanish from /events, its page would 404 and it would drop
--    out of the sitemap the night the cron flips it. Policies are permissive
--    and OR together, so this adds past events alongside published ones and
--    changes nothing else. Drafts stay hidden, and so does an event an admin
--    set to Past by hand while its date is still ahead, which is how Past hid
--    an event before this file. Only a past event whose date has gone by is
--    public.
--
-- Additive only. Run after schema.sql, and BEFORE the deploy that moves the
-- cron onto this function, so the first run finds both the function and the
-- policy. Safe to re-run.
--
-- Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.


-- ── 1. finalize_past_events: service role only ──────────────

create or replace function public.finalize_past_events(p_hours integer default 28)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff  timestamptz;
  v_slugs   text[];
  v_closed  integer;
begin
  if p_hours is null or p_hours < 28 then
    p_hours := 28;
  end if;
  v_cutoff := now() - make_interval(hours => p_hours);

  with finished as (
    update public.events
       set status = 'past', updated_at = now()
     where status = 'published'
       and date < v_cutoff
    returning slug
  )
  select coalesce(array_agg(slug order by slug), '{}') into v_slugs from finished;

  with shut as (
    update public.tickets t
       set is_active = false
      from public.events e
     where e.id = t.event_id
       and e.status = 'past'
       and e.date < v_cutoff
       and t.is_active = true
    returning t.id
  )
  select count(*) into v_closed from shut;

  return jsonb_build_object(
    'events_marked_past', coalesce(array_length(v_slugs, 1), 0),
    'slugs', to_jsonb(v_slugs),
    'tickets_closed', v_closed
  );
end;
$$;

revoke all on function public.finalize_past_events(integer) from public, anon, authenticated;
grant execute on function public.finalize_past_events(integer) to service_role;


-- ── 2. Visitors can read past events ────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'events'
       and policyname = 'Public read past events'
  ) then
    create policy "Public read past events" on public.events
      for select using (status = 'past' and date < now());
  end if;
end;
$$;

-- The first version of this policy, live for a few hours on 11 October 2026,
-- had no date condition. This brings any copy of it to the current rule.
alter policy "Public read past events" on public.events
  using (status = 'past' and date < now());
