-- Sharing with partners is its own opt in. 8 November 2026.
--
-- The footer form used to say "By signing up you agree to our Privacy Policy.
-- We may share your email with event partners or collaborating brands", so
-- signing up for events or merch news also read as agreeing to be shared.
-- POPIA wants consent to be specific, so sharing now has its own unticked box,
-- "Share my email with Tsakani's event partners and collaborating brands", and
-- this records the answer.
--
-- newsletter_subscribers.share_partners is false unless that box was ticked.
-- Every existing row starts false: nobody who signed up before this ticked a
-- box that said so, so nobody on the list today may be shared.
--
-- subscribe_newsletter takes p_share_partners, default false, and treats it
-- the way it treats the two topic consents: additive, a repeat signup can turn
-- it on but never off, so posting someone else's address cannot change their
-- answer. It does not count as a reason to subscribe, events or merch is still
-- required. Everything else is the version in ticket_confirmation.sql, token
-- rules included. unsubscribe_newsletter clears it with the other two.
--
-- RUN THIS BEFORE THE DEPLOY THAT SENDS p_share_partners. The old 5 argument
-- function is dropped and the new one has a default for the sixth, so the
-- build that is live now keeps working once this has run. The other way round,
-- every footer signup fails until it does.
--
-- If supabase/newsletter_no_ip.sql (privacy pull request 15) runs after this,
-- it recreates the 5 argument function beside this one and PostgREST can no
-- longer tell the two apart. Rebase that file onto this signature first.
--
-- Run in the Supabase SQL Editor against gryssobrndqukwnjyosf. Safe to re-run.
-- Must run after ticket_confirmation.sql.

-- ── 1. The column ───────────────────────────────────────────
alter table public.newsletter_subscribers
  add column if not exists share_partners boolean not null default false;


-- ── 2. subscribe_newsletter records it ──────────────────────
-- A new argument is a new signature, so the old one goes first. On a re-run
-- this drops nothing and the create below replaces the 6 argument version.
drop function if exists public.subscribe_newsletter(text, boolean, boolean, text, text);

create or replace function public.subscribe_newsletter(
  p_email          text,
  p_consent_events boolean,
  p_consent_merch  boolean,
  p_source         text default 'website',
  p_consent_ip     text default null,
  p_share_partners boolean default false
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
    (email, source, is_active, consent_events, consent_merch, share_partners, consent_at, consent_ip)
  values
    (v_email,
     coalesce(p_source, 'website'),
     true,
     coalesce(p_consent_events, false),
     coalesce(p_consent_merch, false),
     coalesce(p_share_partners, false),
     now(),
     p_consent_ip)
  on conflict (email) do update set
    -- Additive only: an existing true is never turned back off here.
    consent_events = public.newsletter_subscribers.consent_events or excluded.consent_events,
    consent_merch  = public.newsletter_subscribers.consent_merch  or excluded.consent_merch,
    share_partners = public.newsletter_subscribers.share_partners or excluded.share_partners,
    consent_at     = now(),
    consent_ip     = coalesce(excluded.consent_ip, public.newsletter_subscribers.consent_ip),
    unsubscribe_token = case
      when public.newsletter_subscribers.is_active is not true then gen_random_uuid()
      else public.newsletter_subscribers.unsubscribe_token
    end,
    is_active      = true
  returning public.newsletter_subscribers.unsubscribe_token into v_token;

  return query select case when v_is_new then v_token else null::uuid end;
end;
$$;

revoke all on function public.subscribe_newsletter(text, boolean, boolean, text, text, boolean) from public;
grant execute on function public.subscribe_newsletter(text, boolean, boolean, text, text, boolean) to anon, authenticated;


-- ── 3. Unsubscribing withdraws it too ───────────────────────
-- Same signature and body as ticket_confirmation.sql, plus share_partners.
create or replace function public.unsubscribe_newsletter(p_token uuid)
returns table (email text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.newsletter_subscribers
     set is_active      = false,
         consent_events = false,
         consent_merch  = false,
         share_partners = false
   where unsubscribe_token = p_token
  returning public.newsletter_subscribers.email;
end;
$$;

revoke all on function public.unsubscribe_newsletter(uuid) from public;
grant execute on function public.unsubscribe_newsletter(uuid) to anon, authenticated;
