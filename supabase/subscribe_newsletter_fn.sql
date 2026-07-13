-- Safe newsletter subscribe, resolving the insert-vs-upsert trap.
--
-- Background: the signup route cannot upsert directly. Visitors are `anon` and
-- hold only the "Anyone can subscribe" INSERT policy. An upsert compiles to
-- INSERT ... ON CONFLICT DO UPDATE, and Postgres demands an UPDATE policy for
-- that path even when nothing actually conflicts, so every signup was rejected
-- with "new row violates row-level security policy".
--
-- Granting anon a blanket UPDATE policy would be the wrong fix: it would let
-- anyone rewrite anyone else's row. Instead this SECURITY DEFINER function owns
-- the one narrow write we actually want, and exposes nothing else.
--
-- Consent is ADDITIVE. A repeat signup can only ever turn a consent ON, never
-- off. That means someone who subscribed for events and later also ticks merch
-- gets the merch tick saved (the tradeoff this fixes), while a bad actor cannot
-- submit someone else's address to strip their consent. Genuine opt-out must go
-- through a separate unsubscribe flow that proves ownership of the address, not
-- through this public form.

create or replace function public.subscribe_newsletter(
  p_email          text,
  p_consent_events boolean,
  p_consent_merch  boolean,
  p_source         text default 'website',
  p_consent_ip     text default null
)
returns void
language plpgsql
security definer
-- Pin the search_path. Without this, a SECURITY DEFINER function can be tricked
-- into resolving `newsletter_subscribers` to an attacker-controlled table.
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if v_email is null or v_email = '' or position('@' in v_email) = 0 or length(v_email) > 254 then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;

  if not (coalesce(p_consent_events, false) or coalesce(p_consent_merch, false)) then
    raise exception 'At least one consent is required' using errcode = '22023';
  end if;

  insert into public.newsletter_subscribers
    (email, source, is_active, consent_events, consent_merch, consent_at, consent_ip)
  values
    (v_email,
     coalesce(p_source, 'website'),
     true,
     coalesce(p_consent_events, false),
     coalesce(p_consent_merch, false),
     now(),
     p_consent_ip)
  on conflict (email) do update set
    -- Additive only: an existing true is never turned back off here.
    consent_events = public.newsletter_subscribers.consent_events or excluded.consent_events,
    consent_merch  = public.newsletter_subscribers.consent_merch  or excluded.consent_merch,
    consent_at     = now(),
    consent_ip     = coalesce(excluded.consent_ip, public.newsletter_subscribers.consent_ip),
    is_active      = true;
end;
$$;

-- Lock the door, then hand out exactly one key.
revoke all on function public.subscribe_newsletter(text, boolean, boolean, text, text) from public;
grant execute on function public.subscribe_newsletter(text, boolean, boolean, text, text) to anon, authenticated;
