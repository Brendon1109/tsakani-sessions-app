-- ============================================================
-- ADDING A GUEST WHO DID NOT BOOK ON THE WEBSITE
-- ============================================================
-- Every ticket_order in the database came from someone filling in the form on
-- the site. There has never been another way in: /api/admin/tickets exposes GET
-- and PATCH only, so the team cannot create an order at all.
--
-- That is why the WhatsApp bookings live in a chat thread and a PDF. Those
-- guests have no order, so they have no reference, no QR, and no row for the
-- door to find — searching their name at the door returns nothing, because they
-- genuinely are not there.
--
-- This gives the team the missing verb. An admin can put a guest into the same
-- table everyone else is in, and from that moment the guest is ordinary: they
-- have a TS- reference, a QR code, a ticket page, and they appear in the door
-- roster and the headcount like anybody who booked online.
--
-- Safe to re-run.

-- ── 1. A guest who reached us another way ───────────────────
-- buyer_email was NOT NULL, which is a website assumption leaking into the
-- table. Someone who books over WhatsApp very often has no email to give, and
-- demanding one means either turning them away or inventing an address.
-- Inventing one is the worse option, because it will eventually be mailed.
alter table ticket_orders alter column buyer_email drop not null;

-- Where the booking came from, so "58 online, 12 on WhatsApp" is answerable
-- and a guest added by hand is never mistaken for a website order.
alter table ticket_orders
  add column if not exists source text not null default 'website';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ticket_orders_source_check'
  ) then
    alter table ticket_orders
      add constraint ticket_orders_source_check
      check (source in ('website', 'whatsapp', 'door', 'admin'));
  end if;
end
$$;

comment on column ticket_orders.source is
  'How the booking reached us. Existing rows are all website — that was the only path that existed.';


-- ── 2. The team creating an order ───────────────────────────
-- Deliberately NOT create_ticket_order with an admin flag. That function is the
-- public path and enforces public rules: a valid email, the sale window, and
-- capacity. This one has to break all three, and folding "unless an admin asks"
-- into the function that guards the anon endpoint is how a bypass eventually
-- ends up reachable from the outside.
--
-- The rules it drops, and why:
--   * sale window — the team adds WhatsApp guests precisely when online sales
--     have closed. Refusing then would make the function useless.
--   * capacity — the person doing this is standing in the room. If the door
--     says one more is fine, the database is not better placed to argue. It
--     reports the overflow instead of blocking, so the decision is informed
--     rather than silently overridden.
--   * email — see above.
create or replace function public.admin_create_ticket_order(
  p_ticket_id   uuid,
  p_buyer_name  text,
  p_buyer_phone text    default null,
  p_buyer_email text    default null,
  p_quantity    integer default 1,
  p_source      text    default 'whatsapp',
  p_confirmed   boolean default true
)
returns table (
  order_id      uuid,
  order_ref     text,
  qr_code       text,
  quantity      integer,
  total_zar     integer,
  status        text,
  ticket_name   text,
  event_title   text,
  event_date    timestamptz,
  over_capacity boolean,
  sold          integer,
  capacity      integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_ticket   public.tickets;
  v_event    public.events;
  v_qr       text := gen_random_uuid()::text;
  v_qty      integer;
  v_total    integer;
  v_order_id uuid;
  v_ref      text;
  v_status   text;
begin
  if v_uid is null then
    raise exception 'Sign in to add a guest' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  if p_buyer_name is null or btrim(p_buyer_name) = '' then
    raise exception 'A name is required' using errcode = '22023';
  end if;

  v_qty := greatest(1, least(coalesce(p_quantity, 1), 20));

  select t.* into v_ticket from public.tickets t where t.id = p_ticket_id;
  if not found then
    raise exception 'That ticket type no longer exists' using errcode = '22023';
  end if;

  select e.* into v_event from public.events e where e.id = v_ticket.event_id;

  -- Price still comes from the database. An admin chooses WHO gets in, not what
  -- a ticket costs, and letting the client name a price is how a typo becomes a
  -- refund conversation.
  v_total  := coalesce(v_ticket.price_zar, 0) * v_qty;
  v_status := case
                -- Nothing to pay is nothing to wait for, matching the rule in
                -- create_ticket_order that stops the 48-hour cleanup cron from
                -- cancelling free tickets out from under people.
                when v_total = 0 then 'confirmed'
                when p_confirmed  then 'confirmed'
                else 'pending'
              end;

  update public.tickets t
     set quantity_sold = coalesce(t.quantity_sold, 0) + v_qty
   where t.id = p_ticket_id
  returning t.* into v_ticket;

  insert into public.ticket_orders
    (ticket_id, buyer_name, buyer_email, buyer_phone, quantity,
     total_zar, qr_code, status, payment_method, source)
  values
    (p_ticket_id,
     btrim(p_buyer_name),
     nullif(lower(btrim(coalesce(p_buyer_email, ''))), ''),
     nullif(btrim(coalesce(p_buyer_phone, '')), ''),
     v_qty,
     v_total,
     v_qr,
     v_status,
     'whatsapp',
     coalesce(p_source, 'whatsapp'))
  returning id, public.ticket_orders.order_ref into v_order_id, v_ref;

  return query select
    v_order_id,
    v_ref,
    v_qr,
    v_qty,
    v_total,
    v_status,
    v_ticket.name,
    v_event.title,
    v_event.date,
    coalesce(v_ticket.quantity_sold, 0) > coalesce(v_ticket.quantity_total, 0),
    coalesce(v_ticket.quantity_sold, 0),
    coalesce(v_ticket.quantity_total, 0);
end;
$$;

revoke all on function public.admin_create_ticket_order(uuid, text, text, text, integer, text, boolean) from public;
grant execute on function public.admin_create_ticket_order(uuid, text, text, text, integer, text, boolean) to authenticated;
