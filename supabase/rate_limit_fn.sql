-- The rate limiter works. 11 October 2026.
--
-- lib/rate-limit.ts read and wrote rate_limits on the anon key. RLS is on for
-- that table and there has never been a policy, so every insert was refused,
-- every lookup found nothing, and no request was ever limited. The privacy
-- page says we slow down anyone sending too many requests and keep a scrambled
-- version of the IP for up to 10 minutes, so it has to actually happen.
--
-- rate_limit_hit(p_key, p_limit, p_window_seconds), service role only. One
-- call per request: it deletes every key whose window has ended, then counts
-- this hit against p_key in one upsert and says whether it is allowed and how
-- many seconds are left in the window. p_key is never an IP address:
-- lib/rate-limit.ts passes the bucket plus an HMAC of the IP under BZ_SALT.
-- Windows are at most an hour (the app uses 10 minutes at most), and an
-- expired key is gone at the next limited request from anyone, and in any case
-- at the nightly retention run (apply_retention in retention.sql).
--
-- Additive only. Run after critical_fixes.sql, and before the deploy that
-- moves lib/rate-limit.ts onto it. Until that deploy nothing calls it. Safe to
-- re-run.
--
-- Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.

create or replace function public.rate_limit_hit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count   integer;
  v_expires timestamptz;
begin
  if p_key is null or p_key = '' or length(p_key) > 128
     or p_limit is null or p_limit < 1
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'Invalid rate limit call' using errcode = '22023';
  end if;

  -- Ended windows go first, so the upsert below only ever meets a live one.
  delete from public.rate_limits where expires_at <= now();

  insert into public.rate_limits as r (key, count, window_start, expires_at)
  values (p_key, 1, now(), now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
     set count = r.count + 1
  returning r.count, r.expires_at into v_count, v_expires;

  return query
    select v_count <= p_limit,
           greatest(1, ceil(extract(epoch from (v_expires - now())))::integer);
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
