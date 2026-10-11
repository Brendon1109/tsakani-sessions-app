-- Retention: old analytics and old booking enquiries are deleted. 11 October 2026.
--
-- The privacy page says our own event tracking is kept for 12 months and a
-- booking enquiry for two years after we last spoke. Nothing deleted either,
-- so this file adds the delete and the nightly cron at /api/cron/retention
-- calls it.
--
-- 1. booking_enquiries.updated_at, set by a trigger on every update, so "two
--    years after we last spoke" has something to count from. Existing rows
--    keep it null and count from created_at. No row is changed by adding it.
--
-- 2. apply_retention(), service role only. In one transaction it deletes
--    analytics_events older than 12 months and booking_enquiries whose last
--    update, or creation if never updated, is more than two years old, and
--    returns how many of each went. Running it twice deletes nothing the
--    second time.
--
-- Additive only. Run after schema.sql, analytics_events.sql and
-- booking_enquiries.sql, and before the deploy that adds the cron, so its
-- first run finds the function. Safe to re-run.
--
-- Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.


-- ── 1. booking_enquiries.updated_at ─────────────────────────

alter table public.booking_enquiries add column if not exists updated_at timestamptz;

create or replace function public.touch_booking_enquiry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger booking_enquiries_touch
  before update on public.booking_enquiries
  for each row execute function public.touch_booking_enquiry();


-- ── 2. apply_retention: service role only ───────────────────

create or replace function public.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_events   integer;
  v_bookings integer;
begin
  with gone as (
    delete from public.analytics_events
     where created_at < now() - interval '12 months'
    returning 1
  )
  select count(*) into v_events from gone;

  with gone as (
    delete from public.booking_enquiries
     where coalesce(updated_at, created_at) < now() - interval '2 years'
    returning 1
  )
  select count(*) into v_bookings from gone;

  return jsonb_build_object(
    'analytics_events_deleted', v_events,
    'booking_enquiries_deleted', v_bookings
  );
end;
$$;

revoke all on function public.apply_retention() from public, anon, authenticated;
grant execute on function public.apply_retention() to service_role;
