-- Every past event gets a gallery. 2 November 2026.
--
-- Galleries had an event_id from the start, but nothing in the app ever
-- created one, so every gallery was inserted by hand and none of the past
-- events had a place for its photos. Two things in this file.
--
-- 1. ensure_event_galleries(), service role only. For every event with
--    status 'past' and no gallery yet, it inserts one, hidden
--    (is_public = false), titled after the event and linked to it. The slug is
--    the event's slug, or the slug plus a short suffix when a gallery already
--    holds that slug. Running it twice changes nothing the second time.
--
-- 2. finalize_past_events(p_hours) calls it at the end, so the nightly cron
--    that marks events as past also gives each one its gallery in the same
--    transaction. The rest of the function is unchanged from
--    finalize_past_events.sql, and its result gains 'galleries_created'.
--
-- Hidden on purpose: the public /gallery page only lists public galleries, so
-- an empty album never shows. The admin turns it public after uploading.
--
-- Additive only. Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.
-- Safe to re-run.


-- ── 1. ensure_event_galleries ───────────────────────────────

create or replace function public.ensure_event_galleries()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created integer;
begin
  with missing as (
    select e.id,
           btrim(e.title) as title,
           e.slug
      from public.events e
     where e.status = 'past'
       and not exists (select 1 from public.galleries g where g.event_id = e.id)
  ), made as (
    insert into public.galleries (event_id, title, slug, is_public)
    select m.id,
           m.title,
           case
             when exists (select 1 from public.galleries g where g.slug = m.slug)
               then m.slug || '-' || left(replace(m.id::text, '-', ''), 6)
             else m.slug
           end,
           false
      from missing m
    on conflict (slug) do nothing
    returning id
  )
  select count(*) into v_created from made;

  return v_created;
end;
$$;

revoke all on function public.ensure_event_galleries() from public, anon, authenticated;
grant execute on function public.ensure_event_galleries() to service_role;


-- ── 2. finalize_past_events now ends with ensure_event_galleries ──

create or replace function public.finalize_past_events(p_hours integer default 28)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff    timestamptz;
  v_slugs     text[];
  v_closed    integer;
  v_galleries integer;
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

  v_galleries := public.ensure_event_galleries();

  return jsonb_build_object(
    'events_marked_past', coalesce(array_length(v_slugs, 1), 0),
    'slugs', to_jsonb(v_slugs),
    'tickets_closed', v_closed,
    'galleries_created', v_galleries
  );
end;
$$;

revoke all on function public.finalize_past_events(integer) from public, anon, authenticated;
grant execute on function public.finalize_past_events(integer) to service_role;
