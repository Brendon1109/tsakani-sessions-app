-- ============================================================
-- TICKET CONFIRMATION + NEWSLETTER UNSUBSCRIBE
-- ============================================================
-- Buyers used to be thrown straight into a WhatsApp chat with a number they
-- had never seen, with nothing in writing. Nothing was emailed, so the only
-- proof a ticket existed was a message thread. People found that uncomfortable
-- and some walked away.
--
-- This gives an order something a buyer can hold:
--   * a stable, human-sized reference (TS-1A2B3C4D)
--   * a lookup by the unguessable qr_code, so the buyer can reopen the ticket
--     later without an account
--   * per-event payment instructions the team can edit, so a paid ticket can
--     carry a real "go pay here" link and a free ticket says nothing about money
--
-- It also gives the newsletter a real unsubscribe: a per-subscriber token, and
-- a function that turns consent off when someone presents it.
--
-- Safe to re-run.

-- ── 1. Per-event payment instructions ───────────────────────
-- Deliberately event level, matching external_ticket_url. One event has one
-- place you pay, even when it sells several ticket types.
alter table events add column if not exists payment_url text;
alter table events add column if not exists payment_note text;

comment on column events.payment_url is
  'Where buyers go to pay (FestFlow, Yoco link, etc). Shown only when the order total is above zero.';
comment on column events.payment_note is
  'Free text payment instructions shown on the confirmation screen and in the confirmation email. Shown only when the order total is above zero.';


-- ── 2. A reference a human can read out ─────────────────────
-- Derived from the id, so it needs no sequence, cannot drift, and survives a
-- restore. The first uuid group is 8 hex characters, which is what the app
-- already showed buyers in WhatsApp messages, so historic references still
-- match.
alter table ticket_orders
  add column if not exists order_ref text
  generated always as ('TS-' || upper(substr(id::text, 1, 8))) stored;

create index if not exists ticket_orders_order_ref_idx on ticket_orders(order_ref);
create index if not exists ticket_orders_qr_code_idx on ticket_orders(qr_code);


-- ── 3. create_ticket_order returns enough to confirm ────────
-- The old version handed back four columns, which was enough to open WhatsApp
-- and nothing else. To email a real confirmation the route needs the event and
-- the payment instructions too.
--
-- It also picks up the sale window check. reserve_tickets learned about
-- sale_start/sale_end in ticket_sale_windows.sql, but this function carries its
-- own copy of that UPDATE and was never taught the same rule, so a direct POST
-- could buy a ticket that was off sale. Fixed here.
--
-- The return type changes, so the old signature has to go first.
drop function if exists public.create_ticket_order(uuid, text, text, text, integer);

create function public.create_ticket_order(
  p_ticket_id   uuid,
  p_buyer_name  text,
  p_buyer_email text,
  p_buyer_phone text,
  p_quantity    integer
)
returns table (
  order_id         uuid,
  order_ref        text,
  qr_code          text,
  total_zar        integer,
  ticket_name      text,
  event_title      text,
  event_slug       text,
  event_date       timestamptz,
  venue_name       text,
  venue_address    text,
  payment_url      text,
  payment_note     text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket   public.tickets;
  v_event    public.events;
  v_qr       text := gen_random_uuid()::text;
  v_total    integer;
  v_order_id uuid;
  v_ref      text;
begin
  if p_buyer_name is null or btrim(p_buyer_name) = '' then
    raise exception 'Please enter your name' using errcode = '22023';
  end if;

  if p_buyer_email is null or position('@' in p_buyer_email) = 0 or length(p_buyer_email) > 254 then
    raise exception 'Please enter a valid email address' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'Quantity must be between 1 and 20' using errcode = '22023';
  end if;

  -- Atomic reservation, in the same transaction as the insert below.
  -- The window is half open, [sale_start, sale_end), matching reserve_tickets.
  update public.tickets
     set quantity_sold = coalesce(quantity_sold, 0) + p_quantity
   where id = p_ticket_id
     and is_active = true
     and (sale_start is null or sale_start <= now())
     and (sale_end   is null or sale_end   >  now())
     and coalesce(quantity_sold, 0) + p_quantity <= quantity_total
  returning * into v_ticket;

  if not found then
    raise exception 'Not enough tickets available, or this ticket is not on sale right now'
      using errcode = '22023';
  end if;

  select * into v_event from public.events where id = v_ticket.event_id;

  -- Price is taken from the database, never trusted from the client.
  v_total := v_ticket.price_zar * p_quantity;

  insert into public.ticket_orders
    (ticket_id, buyer_name, buyer_email, buyer_phone, quantity,
     total_zar, qr_code, status, payment_method)
  values
    (p_ticket_id,
     btrim(p_buyer_name),
     lower(btrim(p_buyer_email)),
     nullif(btrim(coalesce(p_buyer_phone, '')), ''),
     p_quantity,
     v_total,
     v_qr,
     -- A free ticket is confirmed the moment it is booked. There is nothing to
     -- wait for, and leaving it 'pending' was actively destructive: the 48-hour
     -- cleanup cron cancels every pending order, so a free ticket claimed more
     -- than two days before the event would be silently killed and its link
     -- would 404 — after we had told the buyer to bring it to the door.
     case when v_total > 0 then 'pending' else 'confirmed' end,
     'whatsapp')
  returning id, public.ticket_orders.order_ref into v_order_id, v_ref;

  return query select
    v_order_id,
    v_ref,
    v_qr,
    v_total,
    v_ticket.name,
    v_event.title,
    v_event.slug,
    v_event.date,
    v_event.venue_name,
    v_event.venue_address,
    -- A free ticket never carries payment instructions, however the event is
    -- configured. Nothing to pay, so nothing to say about paying.
    case when v_total > 0 then v_event.payment_url  else null end,
    case when v_total > 0 then v_event.payment_note else null end;
end;
$$;

revoke all on function public.create_ticket_order(uuid, text, text, text, integer) from public;
grant execute on function public.create_ticket_order(uuid, text, text, text, integer) to anon, authenticated;


-- ── 4. Reopening a ticket without an account ────────────────
-- The buyer holds the qr_code, a random uuid that is not derivable from
-- anything public. Presenting it returns that one order and no other. It
-- deliberately does NOT return buyer_email or buyer_phone: the link may sit in
-- a forwarded email or a shared screenshot, and a ticket does not need to leak
-- contact details to be useful at the door.
create or replace function public.get_ticket_order(p_qr_code text)
returns table (
  order_ref     text,
  buyer_name    text,
  quantity      integer,
  total_zar     integer,
  status        text,
  created_at    timestamptz,
  ticket_name   text,
  event_title   text,
  event_slug    text,
  event_date    timestamptz,
  venue_name    text,
  venue_address text,
  payment_url   text,
  payment_note  text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    o.order_ref,
    o.buyer_name,
    o.quantity,
    o.total_zar,
    o.status,
    o.created_at,
    t.name,
    e.title,
    e.slug,
    e.date,
    e.venue_name,
    e.venue_address,
    case when o.total_zar > 0 then e.payment_url  else null end,
    case when o.total_zar > 0 then e.payment_note else null end
  from public.ticket_orders o
  join public.tickets t on t.id = o.ticket_id
  join public.events  e on e.id = t.event_id
  where o.qr_code = p_qr_code
    -- A cancelled order is not a ticket. Returning nothing is the honest
    -- answer, and the page renders its "we can't find that" state.
    and o.status <> 'cancelled';
$$;

revoke all on function public.get_ticket_order(text) from public;
grant execute on function public.get_ticket_order(text) to anon, authenticated;


-- ── 5. A real unsubscribe ───────────────────────────────────
-- subscribe_newsletter is deliberately additive: it can turn a consent on but
-- never off, so nobody can post someone else's address to silence them. That
-- left no way to genuinely leave. This token is the proof of ownership that
-- makes opting out safe — it only reaches the address itself, in the email.
alter table newsletter_subscribers
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists newsletter_subscribers_unsubscribe_token_idx
  on newsletter_subscribers(unsubscribe_token);


-- The signup function now hands back a token so the route can put a working
-- unsubscribe link in the welcome email.
--
-- It hands one back ONLY for an address that was not already an active
-- subscriber. That restriction is the whole security of the design, not a
-- detail. This function is granted to `anon`, and the anon key ships in the
-- browser bundle, so anyone can call it directly against PostgREST — past the
-- CAPTCHA and rate limit, which live in the Next.js route and guard nothing
-- here. If it returned the stored token for an existing subscriber, then
-- posting a stranger's address would hand you their token, and the token is
-- the only thing unsubscribe_newsletter checks. Someone else's consent could
-- be switched off by anyone who could guess their email, which is precisely
-- the attack the additive-consent design exists to prevent.
--
-- So: brand new address, the token is freshly generated and safe to return.
-- Returning subscriber who had opted out, the token is ROTATED first, which
-- invalidates the link in their old mail and means nothing pre-existing is
-- disclosed. Already-active subscriber, null — and the route reads that null
-- as "nothing to welcome", which is also the behaviour we want.
--
-- Residual, accepted: a direct caller learns whether an address was already an
-- active subscriber, from whether a token comes back. Closing that would mean
-- giving up the ability to welcome new subscribers only. It is a poor oracle —
-- using it subscribes the address and rewrites consent_at/consent_ip, leaving
-- the probe in the record.
--
-- Return type changes, so drop first.
drop function if exists public.subscribe_newsletter(text, boolean, boolean, text, text);

create function public.subscribe_newsletter(
  p_email          text,
  p_consent_events boolean,
  p_consent_merch  boolean,
  p_source         text default 'website',
  p_consent_ip     text default null
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

  -- Read before write so we can tell a genuinely new subscriber from someone
  -- resubmitting the form, and from someone who had left and is coming back.
  select * into v_existing
    from public.newsletter_subscribers
   where email = v_email;

  v_is_new := v_existing.id is null or v_existing.is_active is not true;

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
    -- Someone rejoining after opting out gets a new token, so the unsubscribe
    -- link in their old mail stops working and the token we are about to hand
    -- out is not one that existed a moment ago. Every SET expression sees the
    -- pre-update row, so this reads their real previous state.
    unsubscribe_token = case
      when public.newsletter_subscribers.is_active is not true then gen_random_uuid()
      else public.newsletter_subscribers.unsubscribe_token
    end,
    is_active      = true
  returning public.newsletter_subscribers.unsubscribe_token into v_token;

  -- The guard. v_is_new is exactly "was absent or inactive", which is exactly
  -- the case where v_token is freshly minted rather than pre-existing.
  return query select case when v_is_new then v_token else null::uuid end;
end;
$$;

revoke all on function public.subscribe_newsletter(text, boolean, boolean, text, text) from public;
grant execute on function public.subscribe_newsletter(text, boolean, boolean, text, text) to anon, authenticated;


-- Turning consent off. Holding the token is the proof of ownership, so this is
-- the one path allowed to write a false. It is idempotent: clicking the link in
-- an old email twice is not an error, it is still unsubscribed.
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
         consent_merch  = false
   where unsubscribe_token = p_token
  returning public.newsletter_subscribers.email;
end;
$$;

revoke all on function public.unsubscribe_newsletter(uuid) from public;
grant execute on function public.unsubscribe_newsletter(uuid) to anon, authenticated;
