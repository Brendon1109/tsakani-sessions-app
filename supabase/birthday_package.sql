-- ============================================================
-- BIRTHDAY PACKAGE
-- ============================================================
-- Book in the month you were born and you come in free with four friends, you
-- get a table held for you, and the DJ says your name.
--
-- Three perks, three very different mechanisms, and only one of them is code:
--   * free entry  — has to be priced at booking, or the buyer sees a bill for
--                   something we told them was free and abandons it
--   * a table     — nobody can reserve a table from a database. This exists to
--                   put the group in front of the team BEFORE the night
--   * a shout-out — same: a list the DJ can actually read
--
-- So the feature is mostly about making a birthday visible early and loudly,
-- and the pricing change is the small part.
--
-- The claim is checked twice, deliberately. At booking we check the month
-- matches the event, which stops the obvious mistake. At the door we check ID,
-- which is the only check that means anything — a month is trivially lied about
-- and this one gives away five entries.
--
-- Safe to re-run.

-- ── 1. Per-event opt in ─────────────────────────────────────
-- Defaults to OFF since 2026-07-28: word got around and people were claiming
-- the package instead of buying tickets, so the offer is now something an
-- event turns on deliberately (update events set birthday_package = true
-- where id = ...) rather than the standing rule.
alter table events
  add column if not exists birthday_package boolean not null default false;
alter table events
  alter column birthday_package set default false;

comment on column events.birthday_package is
  'Whether the birthday package is offered for this event. Off by default; on only for nights that can absorb free groups.';


-- ── 2. The claim, on the order ──────────────────────────────
-- Month and day only, never the year. The year is what makes a date of birth
-- identifying, and the offer does not need it: eligibility is "is this the
-- month", and the door checks a real ID anyway. Collecting an age we have no
-- use for would be personal data held for no reason, which POPIA treats as the
-- team's problem, not the buyer's.
alter table ticket_orders
  add column if not exists birthday_month smallint,
  add column if not exists birthday_day   smallint,
  add column if not exists is_birthday_vip boolean not null default false,
  add column if not exists birthday_id_checked boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticket_orders_birthday_month_check') then
    alter table ticket_orders add constraint ticket_orders_birthday_month_check
      check (birthday_month is null or birthday_month between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticket_orders_birthday_day_check') then
    alter table ticket_orders add constraint ticket_orders_birthday_day_check
      check (birthday_day is null or birthday_day between 1 and 31);
  end if;
end
$$;

comment on column ticket_orders.is_birthday_vip is
  'The birthday package was granted on this order: free entry for the group, a table, and a shout-out.';
comment on column ticket_orders.birthday_id_checked is
  'Set when the door confirmed ID against the birthday claim. The claim gives away five entries, so it is checked by a person, once.';

create index if not exists ticket_orders_birthday_vip_idx
  on ticket_orders(is_birthday_vip) where is_birthday_vip;


-- ── 3. Claiming it at booking ───────────────────────────────
-- The party cap lives here rather than in the browser. It is the thing being
-- given away, so it is enforced where it cannot be edited.
create or replace function public.birthday_group_max()
returns integer language sql immutable as $$ select 5 $$;

comment on function public.birthday_group_max() is
  'Birthday person plus four friends. One definition, so the form, the price and the door cannot disagree.';

-- Return type and argument list both change, so the old signature has to go.
-- Leaving it in place would make every existing 5-argument call ambiguous
-- against the new one's defaults, which fails at call time rather than here.
drop function if exists public.create_ticket_order(uuid, text, text, text, integer);

create function public.create_ticket_order(
  p_ticket_id      uuid,
  p_buyer_name     text,
  p_buyer_email    text,
  p_buyer_phone    text,
  p_quantity       integer,
  p_birthday_month smallint default null,
  p_birthday_day   smallint default null
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
  payment_note     text,
  is_birthday_vip  boolean,
  birthday_group   integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket     public.tickets;
  v_event      public.events;
  v_qr         text := gen_random_uuid()::text;
  v_total      integer;
  v_order_id   uuid;
  v_ref        text;
  v_birthday   boolean := false;
  v_max        integer := public.birthday_group_max();
  v_event_mon  smallint;
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

  -- The birthday month is compared in South African local time. The events
  -- table stores timestamptz, and a 01:00 SAST event on the 1st is stored as
  -- the previous day in UTC — comparing the raw month would put that night in
  -- the wrong month and silently refuse a valid claim, or grant an invalid one.
  v_event_mon := extract(month from (v_event.date at time zone 'Africa/Johannesburg'))::smallint;

  if coalesce(v_event.birthday_package, true)
     and p_birthday_month is not null
     and p_birthday_month = v_event_mon
     and p_quantity <= v_max
  then
    v_birthday := true;
    -- Free for the whole group. The buyer was told "you and four friends come
    -- in free", so a total above zero here is us going back on that mid-form.
    v_total := 0;
  end if;

  insert into public.ticket_orders
    (ticket_id, buyer_name, buyer_email, buyer_phone, quantity,
     total_zar, qr_code, status, payment_method,
     birthday_month, birthday_day, is_birthday_vip)
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
     'whatsapp',
     p_birthday_month,
     p_birthday_day,
     v_birthday)
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
    case when v_total > 0 then v_event.payment_note else null end,
    v_birthday,
    v_max;
end;
$$;

revoke all on function public.create_ticket_order(uuid, text, text, text, integer, smallint, smallint) from public;
grant execute on function public.create_ticket_order(uuid, text, text, text, integer, smallint, smallint) to anon, authenticated;


-- ── 4. The door checks the ID ───────────────────────────────
-- A birthday claim is five free entries behind a self-declared month, so it is
-- the one thing on this screen that does not admit on scan. It stops and asks a
-- person, exactly like an unpaid order does — and for the same reason: the
-- decision belongs to whoever is looking at the guest.
create or replace function public.check_in_order(
  p_code           text,
  p_event_id       uuid    default null,
  p_count          integer default 1,
  p_allow_unpaid   boolean default false,
  p_id_checked     boolean default false
)
returns table (
  outcome          text,
  order_id         uuid,
  order_ref        text,
  buyer_name       text,
  quantity         integer,
  checked_in_count integer,
  status           text,
  total_zar        integer,
  ticket_name      text,
  event_title      text,
  event_id         uuid,
  checked_in_at    timestamptz,
  first_seen_at    timestamptz,
  is_birthday_vip  boolean,
  birthday_day     smallint,
  birthday_month   smallint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_id     uuid;
  v_order  public.ticket_orders;
  v_event  public.events;
  v_ticket public.tickets;
  v_qty    integer;
  v_take   integer;
  v_prev   timestamptz;
begin
  if v_uid is null then
    raise exception 'Sign in to check guests in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  v_id := public.resolve_ticket_code(p_code);

  if v_id is null then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::integer,
                        null::integer, null::text, null::integer, null::text, null::text,
                        null::uuid, null::timestamptz, null::timestamptz,
                        null::boolean, null::smallint, null::smallint;
    return;
  end if;

  select o.* into v_order from public.ticket_orders o where o.id = v_id for update;

  select t.* into v_ticket from public.tickets t where t.id = v_order.ticket_id;
  select e.* into v_event  from public.events  e where e.id = v_ticket.event_id;

  v_prev := v_order.checked_in_at;
  v_qty  := greatest(1, coalesce(v_order.quantity, 1));

  if p_event_id is not null and v_event.id is distinct from p_event_id then
    return query select 'wrong_event'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                        v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                        v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev,
                        v_order.is_birthday_vip, v_order.birthday_day, v_order.birthday_month;
    return;
  end if;

  if v_order.status = 'cancelled' then
    return query select 'cancelled'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                        v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                        v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev,
                        v_order.is_birthday_vip, v_order.birthday_day, v_order.birthday_month;
    return;
  end if;

  if v_order.status = 'pending' and not p_allow_unpaid then
    return query select 'unpaid'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                        v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                        v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev,
                        v_order.is_birthday_vip, v_order.birthday_day, v_order.birthday_month;
    return;
  end if;

  -- Asked once per booking, not once per guest: the ID is checked when the
  -- first of the group arrives, and stragglers from the same party are not
  -- made to prove someone else's birthday again.
  if v_order.is_birthday_vip
     and not v_order.birthday_id_checked
     and not p_id_checked
  then
    return query select 'birthday_id_check'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                        v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                        v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev,
                        v_order.is_birthday_vip, v_order.birthday_day, v_order.birthday_month;
    return;
  end if;

  if v_order.checked_in_count >= v_qty then
    return query select 'already_in'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                        v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                        v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev,
                        v_order.is_birthday_vip, v_order.birthday_day, v_order.birthday_month;
    return;
  end if;

  v_take := greatest(1, least(coalesce(p_count, 1), v_qty - v_order.checked_in_count));

  update public.ticket_orders o
     set checked_in_count = o.checked_in_count + v_take,
         checked_in_at    = coalesce(o.checked_in_at, now()),
         checked_in_by    = coalesce(o.checked_in_by, v_uid),
         birthday_id_checked = o.birthday_id_checked or p_id_checked,
         status           = case
                              when o.checked_in_count + v_take >= v_qty then 'used'
                              else 'confirmed'
                            end
   where o.id = v_order.id
  returning o.* into v_order;

  return query select 'checked_in'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                      v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                      v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev,
                      v_order.is_birthday_vip, v_order.birthday_day, v_order.birthday_month;
end;
$$;

revoke all on function public.check_in_order(text, uuid, integer, boolean, boolean) from public;
grant execute on function public.check_in_order(text, uuid, integer, boolean, boolean) to authenticated;

-- The four-argument version would otherwise sit alongside the new one and make
-- every existing call ambiguous.
drop function if exists public.check_in_order(text, uuid, integer, boolean);
