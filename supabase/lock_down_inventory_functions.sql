-- Lock down the inventory and cleanup functions. 24 September 2026.
--
-- release_tickets, reserve_tickets and cleanup_stale_merch_orders were
-- SECURITY DEFINER and executable by anon and authenticated, which means by
-- anyone holding the public anon key that ships in the browser bundle.
--
--   release_tickets had no guard at all. Anyone could lower quantity_sold on
--   any ticket and make an event oversell, or pass a negative quantity and
--   push it up so an event looks sold out.
--   reserve_tickets could be called in a loop to fill an event's capacity so
--   it looks sold out. Nothing in the app calls it: create_ticket_order and
--   admin_create_ticket_order update stock themselves.
--   cleanup_stale_merch_orders took p_hours as low as 1, so anyone could
--   cancel every pending merch order older than an hour.
--
-- After this file:
--   reserve_tickets             service role only.
--   release_tickets             authenticated keeps EXECUTE, because the admin
--                               ticket route calls it with the admin's own
--                               session, and the function now refuses anyone
--                               who is not an admin or the service role. anon
--                               and PUBLIC lose it. Quantity must be 1 or more.
--   cleanup_stale_merch_orders  service role only, and never less than 48 hours.
--                               The nightly cron calls it with the service role
--                               key (app/api/cron/cleanup-orders).
--
-- Run it AFTER the deploy that moves the cron onto the service role key, or
-- the merch cleanup fails for a night. Idempotent, safe to re-run. If
-- critical_fixes.sql, ticket_sale_windows.sql or merch_store.sql is ever
-- re-run, run this file again afterwards.
--
-- Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.


-- ── 1. reserve_tickets: unused by the app, service role only ─

revoke all on function public.reserve_tickets(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_tickets(uuid, integer) to service_role;


-- ── 2. release_tickets: admins and the service role only ────

create or replace function public.release_tickets(p_ticket_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_current_user_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1' using errcode = '22023';
  end if;

  update public.tickets
     set quantity_sold = greatest(0, quantity_sold - p_quantity)
   where id = p_ticket_id;
end;
$$;

revoke all on function public.release_tickets(uuid, integer) from public, anon;
grant execute on function public.release_tickets(uuid, integer) to authenticated, service_role;


-- ── 3. cleanup_stale_merch_orders: service role only ────────

create or replace function public.cleanup_stale_merch_orders(p_hours integer default 48)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  -- Never shorter than the 48 hours the nightly cron uses.
  if p_hours is null or p_hours < 48 then
    p_hours := 48;
  end if;

  with cancelled as (
    update public.orders
       set status = 'cancelled', updated_at = now()
     where status = 'pending'
       and created_at < now() - (p_hours || ' hours')::interval
    returning id
  )
  select count(*) into v_count from cancelled;

  return v_count;
end;
$$;

revoke all on function public.cleanup_stale_merch_orders(integer) from public, anon, authenticated;
grant execute on function public.cleanup_stale_merch_orders(integer) to service_role;
