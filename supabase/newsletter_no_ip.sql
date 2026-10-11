-- The newsletter stops storing IP addresses. 11 October 2026.
--
-- /api/newsletter passed the visitor's IP as p_consent_ip and
-- subscribe_newsletter wrote it to newsletter_subscribers.consent_ip, so every
-- signup kept a raw IP address. The signup time, the boxes ticked and the
-- welcome email with its unsubscribe link already show the signup happened,
-- and the privacy page says the database never stores an IP address.
--
-- Same signature, same return type and same grants as the version in
-- ticket_confirmation.sql, so CREATE OR REPLACE swaps it in place. A build
-- that still sends p_consent_ip keeps working, the value is just ignored, and
-- the new build stops sending it. Nothing else changes: consent stays
-- additive, the token rules are the same.
--
-- Safe to run before or after the deploy that stops the route sending the IP.
-- Safe to re-run. Must run after ticket_confirmation.sql.
--
-- Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.


-- ── 1. subscribe_newsletter ignores p_consent_ip ────────────

create or replace function public.subscribe_newsletter(
  p_email          text,
  p_consent_events boolean,
  p_consent_merch  boolean,
  p_source         text default 'website',
  p_consent_ip     text default null  -- ignored, kept so older callers still match
)
returns table (unsubscribe_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email    text := lower(btrim(p_email));
  v_existing public.newsletter_subscribers;
  v_token    uuid;
  v_is_new   boolean;
begin
  if v_email is null or v_email = '' or position('@' in v_email) = 0 or length(v_email) > 254 then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;

  if not (coalesce(p_consent_events, false) or coalesce(p_consent_merch, false)) then
    raise exception 'At least one consent is required' using errcode = '22023';
  end if;

  select * into v_existing
    from public.newsletter_subscribers
   where email = v_email;

  v_is_new := v_existing.id is null or v_existing.is_active is not true;

  insert into public.newsletter_subscribers
    (email, source, is_active, consent_events, consent_merch, consent_at)
  values
    (v_email,
     coalesce(p_source, 'website'),
     true,
     coalesce(p_consent_events, false),
     coalesce(p_consent_merch, false),
     now())
  on conflict (email) do update set
    consent_events = public.newsletter_subscribers.consent_events or excluded.consent_events,
    consent_merch  = public.newsletter_subscribers.consent_merch  or excluded.consent_merch,
    consent_at     = now(),
    unsubscribe_token = case
      when public.newsletter_subscribers.is_active is not true then gen_random_uuid()
      else public.newsletter_subscribers.unsubscribe_token
    end,
    is_active      = true
  returning public.newsletter_subscribers.unsubscribe_token into v_token;

  return query select case when v_is_new then v_token else null::uuid end;
end;
$$;

revoke all on function public.subscribe_newsletter(text, boolean, boolean, text, text) from public;
grant execute on function public.subscribe_newsletter(text, boolean, boolean, text, text) to anon, authenticated;


-- ── 2. POST DEPLOY, run by hand, once ───────────────────────
-- Only after the deploy that stops /api/newsletter sending the IP is live AND
-- part 1 above has run, so nothing can write an IP again afterwards. Left
-- commented out so running this file never runs it by accident. Run the three
-- statements together, in this order.
--
-- a. Clears the addresses already stored. On 11 October 2026 that was all 53
--    rows.
-- b. Makes it structural: no row can hold an IP address again, whatever
--    writes it.
-- c. Removes the anon insert policy. Nothing in the app inserts into
--    newsletter_subscribers directly (checked 11 October 2026: every signup
--    goes through subscribe_newsletter, which runs as its owner and does not
--    need the policy), so this only closes the door a direct REST call could
--    use to add an address without Turnstile or the rate limiter. schema.sql
--    no longer creates it. Proven in a rolled back transaction on production
--    the same day: a signup through the function still works and stores no IP,
--    a direct anon insert is refused.
--
-- update public.newsletter_subscribers
--    set consent_ip = null
--  where consent_ip is not null;
--
-- alter table public.newsletter_subscribers
--   add constraint newsletter_subscribers_no_ip check (consent_ip is null);
--
-- drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
