-- Retention: old analytics, old booking enquiries, the admin log and spent
-- rate limit keys are deleted. 11 October 2026.
--
-- The privacy page says our own event tracking is kept for 12 months, a
-- booking enquiry for two years after the last update, the admin log for two
-- years, and the scrambled IP behind the rate limiter only for its window.
-- Nothing deleted any of it, so this file adds the deletes and the nightly
-- cron at /api/cron/retention calls them. Orders and tickets are deleted by
-- hand after five years, as the page says, not here.
--
-- 1. booking_enquiries.updated_at, stamped by a trigger when the enquiry
--    itself changes (its status, contact details, event or message), so the
--    two years count from the last real change. Not when a DJ is removed:
--    that sets requested_dj_id to null through the foreign key, which is not
--    contact with the person. Existing rows keep it null and count from
--    created_at.
--
-- 2. created_at is set by the database on insert, on analytics_events and
--    booking_enquiries. Both tables take inserts from the anon key, and a
--    row sent with a created_at years ahead would otherwise never reach its
--    deletion date.
--
-- 3. apply_retention(), service role only. In one transaction it deletes
--    analytics_events older than 12 months, booking_enquiries whose last
--    update (or creation) is more than two years old, audit_log rows older
--    than two years, and rate_limits keys whose window has ended, and returns
--    how many of each went. Running it twice deletes nothing the second time.
--
-- Additive only. Run after schema.sql, critical_fixes.sql,
-- analytics_events.sql and booking_enquiries.sql, and before the deploy that
-- adds the cron, so its first run finds the function. Safe to re-run: every
-- statement replaces its own earlier version.
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
  before update of status, name, email, phone, event_type, event_date, venue, message
  on public.booking_enquiries
  for each row
  when (old is distinct from new)
  execute function public.touch_booking_enquiry();


-- ── 2. created_at is the database's, not the caller's ───────

create or replace function public.pin_created_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.created_at := now();
  if tg_table_name = 'booking_enquiries' then
    new.updated_at := null;
  end if;
  return new;
end;
$$;

create or replace trigger analytics_events_pin_created_at
  before insert on public.analytics_events
  for each row execute function public.pin_created_at();

create or replace trigger booking_enquiries_pin_created_at
  before insert on public.booking_enquiries
  for each row execute function public.pin_created_at();


-- ── 3. apply_retention: service role only ───────────────────

create or replace function public.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_events      integer;
  v_bookings    integer;
  v_audit       integer;
  v_rate_limits integer;
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

  with gone as (
    delete from public.audit_log
     where created_at < now() - interval '2 years'
    returning 1
  )
  select count(*) into v_audit from gone;

  with gone as (
    delete from public.rate_limits
     where expires_at <= now()
    returning 1
  )
  select count(*) into v_rate_limits from gone;

  return jsonb_build_object(
    'analytics_events_deleted', v_events,
    'booking_enquiries_deleted', v_bookings,
    'audit_log_deleted', v_audit,
    'rate_limits_deleted', v_rate_limits
  );
end;
$$;

revoke all on function public.apply_retention() from public, anon, authenticated;
grant execute on function public.apply_retention() to service_role;
