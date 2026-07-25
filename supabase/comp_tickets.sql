-- ============================================================
-- COMPLIMENTARY TICKETS
-- ============================================================
-- The team hands out numbered comp slips — TSK-COMP-0001 upwards — and tracks
-- them in a separate printed register. Those numbers mean nothing to the app,
-- so a guest presenting one at the door cannot be looked up by it. The door
-- has to guess at their name instead, which is the slowest possible path and
-- fails outright when the slip was issued to "Koporal" and nothing else.
--
-- This makes the slip a real key. Type or scan TSK-COMP-0028, or just 28, and
-- it resolves to whichever booking that slip belongs to.
--
-- A slip maps to an ORDER, many-to-one on purpose. Two slips issued to the same
-- person are two rows in the register but one booking for two people, and the
-- party counter on the door screen already models exactly that: each slip
-- admits one of the group.
--
-- Safe to re-run.

create table if not exists comp_tickets (
  -- The number printed on the slip. Primary key because it is the thing the
  -- physical world already treats as unique.
  ref         text primary key,
  order_id    uuid references ticket_orders(id) on delete set null,
  event_id    uuid references events(id) on delete cascade,
  -- Kept even once linked. It is what the register says, and when a link is
  -- wrong the handwritten name is the evidence for fixing it.
  holder_name text,
  notes       text,
  created_at  timestamptz default now()
);

create index if not exists comp_tickets_order_idx on comp_tickets(order_id);
create index if not exists comp_tickets_event_idx on comp_tickets(event_id);

alter table comp_tickets enable row level security;

drop policy if exists "Admins manage comp tickets" on comp_tickets;
create policy "Admins manage comp tickets" on comp_tickets for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);


-- ── Resolving a slip the way it is actually presented ───────
-- Whoever is on the door reads "0028" off a slip and types the shortest thing
-- that could work. Accepting only the full TSK-COMP-0028 would mean the manual
-- path is slower than it needs to be, at the exact moment speed is the point.
--
-- The numeric shorthand is guarded by an anchored 1-4 digit pattern rather than
-- by stripping non-digits. Pulling the digits out of a scanned uuid and padding
-- them to four would truncate to something like '0028' and cheerfully resolve a
-- real ticket to somebody else's comp slip.
--
-- A direct match on the order always wins, so nothing about comp slips can
-- change what an existing QR code or TS- reference already means.
create or replace function public.resolve_ticket_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with normalised as (
    select
      split_part(split_part(regexp_replace(btrim(p_code), '^.*/', ''), '?', 1), '#', 1) as code
  ),
  direct as (
    select o.id
      from public.ticket_orders o, normalised n
     where n.code <> ''
       and (
         o.qr_code   = n.code
         or o.order_ref = upper(n.code)
         or o.order_ref = 'TS-' || upper(n.code)
         or o.id::text  = n.code
       )
     limit 1
  ),
  comp as (
    select c.order_id as id
      from public.comp_tickets c, normalised n
     where n.code <> ''
       and c.order_id is not null
       and (
         c.ref = upper(n.code)
         or (n.code ~ '^[0-9]{1,4}$' and c.ref = 'TSK-COMP-' || lpad(n.code, 4, '0'))
       )
     limit 1
  )
  select coalesce((select id from direct), (select id from comp));
$$;

revoke all on function public.resolve_ticket_code(text) from public;
grant execute on function public.resolve_ticket_code(text) to authenticated;
