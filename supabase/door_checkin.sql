-- ============================================================
-- DOOR CHECK-IN
-- ============================================================
-- Check-in used to be a side effect of the admin tickets table: find the buyer
-- among every order for every event, 25 rows to a page, and flip status to
-- 'used'. That is a filing cabinet, not a door. It loses three things a door
-- actually needs:
--
--   * WHEN someone arrived, and who scanned them in. 'used' is a flag; a door
--     needs a time, because "was this ticket already used?" is the question a
--     second person presenting the same screenshot forces you to answer.
--   * PARTIAL arrivals. An order for 5 is one row. Two friends arriving at 19:00
--     and three at 20:30 is the normal case, and all-or-nothing check-in makes
--     the headcount a lie either way.
--   * SAFETY UNDER CONCURRENCY. Two staff on two phones scanning the same
--     queue is the point of a door tool, and a read-then-write from the client
--     lets the same guest through twice and double-counts the room.
--
-- Every ticket already carries a QR (lib/qr.ts renders it into the confirmation
-- email; /ticket/[code] shows it on the buyer's phone). Nothing changes for the
-- buyer. This is the missing half: the thing that reads it.
--
-- Safe to re-run.

-- ── 1. What a check-in records ──────────────────────────────
alter table ticket_orders
  add column if not exists checked_in_at    timestamptz,
  add column if not exists checked_in_by    uuid references profiles(id),
  add column if not exists checked_in_count integer not null default 0;

comment on column ticket_orders.checked_in_at is
  'When the FIRST guest on this order came through the door. Never overwritten by later arrivals from the same party.';
comment on column ticket_orders.checked_in_by is
  'The admin who scanned the first guest in.';
comment on column ticket_orders.checked_in_count is
  'How many of the party are inside. Reaches quantity, and only then does status become used.';

-- Orders that were already flipped to 'used' by the old admin table are fully
-- arrived by definition. Without this the door counter would open the night
-- reporting them as still outside.
update ticket_orders
   set checked_in_count = quantity
 where status = 'used'
   and checked_in_count = 0;

-- The door searches by name and by reference constantly, over one event.
create index if not exists ticket_orders_checked_in_at_idx on ticket_orders(checked_in_at desc);


-- ── 2. Turning whatever was scanned into an order ───────────
-- A phone camera hands back the whole QR payload, which is a ticket URL:
--   https://tsakanisessions.co.za/ticket/3f1c...-uuid
-- while a human at the door types "TS-B6B3CBA7", or "b6b3cba7", or pastes the
-- raw uuid off the ticket page. All four are the same guest. Normalising here
-- rather than in the browser means the rule is one rule — the manual box, the
-- scanner, and anything we build later cannot drift apart.
create or replace function public.resolve_ticket_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with normalised as (
    select
      -- Last path segment of a URL, or the whole string if it isn't one, with
      -- any ?query or #fragment removed.
      split_part(split_part(regexp_replace(btrim(p_code), '^.*/', ''), '?', 1), '#', 1) as code
  )
  select o.id
    from public.ticket_orders o, normalised n
   where n.code <> ''
     and (
       o.qr_code   = n.code
       or o.order_ref = upper(n.code)
       -- "B6B3CBA7" without the prefix is what people read off a screen.
       or o.order_ref = 'TS-' || upper(n.code)
       -- The door's own roster identifies a guest by primary key. Accepting it
       -- means the search box and the scanner share one code path instead of
       -- the tap-a-name route quietly resolving to nothing.
       or o.id::text = n.code
     )
   limit 1;
$$;

revoke all on function public.resolve_ticket_code(text) from public;
grant execute on function public.resolve_ticket_code(text) to authenticated;


-- ── 3. The check-in itself ──────────────────────────────────
-- SECURITY DEFINER so it can write regardless of how RLS on ticket_orders is
-- shaped, which means it has to prove the caller is an admin itself — the
-- function's own privileges are not the caller's.
--
-- The row is locked with FOR UPDATE before it is read. That lock is the whole
-- reason this is a function instead of a select-then-patch from the browser:
-- two doors scanning the same ticket at the same instant serialise here, and
-- the second one is told "already inside" instead of counting the guest twice.
--
-- It never raises for an ordinary door situation. "Cancelled", "already in",
-- "wrong event" are answers, not errors — the screen has to render each of
-- them differently, and an exception carries no structured detail to render.
create or replace function public.check_in_order(
  p_code           text,
  p_event_id       uuid    default null,
  p_count          integer default 1,
  p_allow_unpaid   boolean default false
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
  first_seen_at    timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- Note on the aliasing below: every column of RETURNS TABLE is also a plpgsql
-- variable in here, so bare `quantity` or `status` inside a query is ambiguous
-- and Postgres refuses the whole function. Table references are aliased and
-- qualified throughout for that reason, not for style.
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
                        null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  -- Serialise every door against this one order.
  select o.* into v_order from public.ticket_orders o where o.id = v_id for update;

  select t.* into v_ticket from public.tickets t where t.id = v_order.ticket_id;
  select e.* into v_event  from public.events  e where e.id = v_ticket.event_id;

  v_prev := v_order.checked_in_at;
  v_qty  := greatest(1, coalesce(v_order.quantity, 1));

  -- Someone else's night. Worth its own answer: a guest holding a valid ticket
  -- for next month's event is a different conversation from a fake one.
  if p_event_id is not null and v_event.id is distinct from p_event_id then
    return query select 'wrong_event'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                        v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                        v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev;
    return;
  end if;

  if v_order.status = 'cancelled' then
    return query select 'cancelled'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                        v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                        v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev;
    return;
  end if;

  -- An unpaid order is a held seat, not a ticket. The door can still let them
  -- in — they pay at the table, which is how most of these actually resolve —
  -- but that is a decision a person makes, so it takes a second deliberate tap
  -- rather than happening silently on scan.
  if v_order.status = 'pending' and not p_allow_unpaid then
    return query select 'unpaid'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                        v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                        v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev;
    return;
  end if;

  if v_order.checked_in_count >= v_qty then
    return query select 'already_in'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                        v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                        v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev;
    return;
  end if;

  -- Never let a party of 3 admit 5 because someone leant on the +1.
  v_take := greatest(1, least(coalesce(p_count, 1), v_qty - v_order.checked_in_count));

  update public.ticket_orders o
     set checked_in_count = o.checked_in_count + v_take,
         -- coalesce, not now(): this is when the party STARTED arriving, and a
         -- straggler at 23:00 must not rewrite the 19:00 the first guest came.
         checked_in_at    = coalesce(o.checked_in_at, now()),
         checked_in_by    = coalesce(o.checked_in_by, v_uid),
         status           = case
                              when o.checked_in_count + v_take >= v_qty then 'used'
                              else 'confirmed'
                            end
   where o.id = v_order.id
  returning o.* into v_order;

  return query select 'checked_in'::text, v_order.id, v_order.order_ref, v_order.buyer_name,
                      v_qty, v_order.checked_in_count, v_order.status, v_order.total_zar,
                      v_ticket.name, v_event.title, v_event.id, v_order.checked_in_at, v_prev;
end;
$$;

revoke all on function public.check_in_order(text, uuid, integer, boolean) from public;
grant execute on function public.check_in_order(text, uuid, integer, boolean) to authenticated;


-- ── 4. Undo ─────────────────────────────────────────────────
-- A scanner pointed at a queue will occasionally catch the QR behind the one
-- being presented. Without an undo the only fix at 20:00 on a Friday is the
-- Supabase dashboard, so the honest outcome is that nobody fixes it and the
-- headcount is quietly wrong.
create or replace function public.undo_check_in(p_order_id uuid)
returns table (
  order_id         uuid,
  order_ref        text,
  buyer_name       text,
  quantity         integer,
  checked_in_count integer,
  status           text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to undo a check-in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return query
  update public.ticket_orders o
     set checked_in_count = 0,
         checked_in_at    = null,
         checked_in_by    = null,
         -- Back to a valid ticket, not back to 'pending'. Whether they paid is
         -- a separate fact from whether they walked through the door, and an
         -- undo must not silently un-pay someone.
         status           = case when o.status = 'used' then 'confirmed' else o.status end
   where o.id = p_order_id
     and o.status <> 'cancelled'
  returning o.id, o.order_ref, o.buyer_name, o.quantity, o.checked_in_count, o.status;
end;
$$;

revoke all on function public.undo_check_in(uuid) from public;
grant execute on function public.undo_check_in(uuid) to authenticated;
