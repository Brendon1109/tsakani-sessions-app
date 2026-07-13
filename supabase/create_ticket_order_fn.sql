-- Capture the ticket buyer. Same RLS trap as the newsletter, same principled fix.
--
-- Background: /api/tickets did `.insert(...).select().single()`, which compiles
-- to INSERT ... RETURNING. The only SELECT policy on ticket_orders is
-- `user_id = auth.uid()`, and a visitor has no auth.uid(), so the new row is
-- invisible to them and the RETURNING is refused with "new row violates
-- row-level security policy". The plain INSERT succeeds; it is the read-back
-- that fails. That route was never wired to a button, so nobody ever found out.
--
-- Adding a public SELECT policy would be the wrong fix: it would expose every
-- buyer's name, email and phone to anyone. Instead this SECURITY DEFINER
-- function performs the one narrow write and hands back only the order it just
-- created. It reads nobody else's row.
--
-- It also folds the seat reservation and the order insert into a SINGLE
-- transaction. The old route reserved seats, inserted, and on failure fired a
-- best-effort release_tickets call, which could leave seats sold to nobody if
-- that call was lost. Here a failed insert rolls the reservation back for free.

create or replace function public.create_ticket_order(
  p_ticket_id   uuid,
  p_buyer_name  text,
  p_buyer_email text,
  p_buyer_phone text,
  p_quantity    integer
)
returns table (
  order_id    uuid,
  qr_code     text,
  total_zar   integer,
  ticket_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket   public.tickets;
  v_qr       text := gen_random_uuid()::text;
  v_total    integer;
  v_order_id uuid;
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
  update public.tickets
     set quantity_sold = coalesce(quantity_sold, 0) + p_quantity
   where id = p_ticket_id
     and is_active = true
     and coalesce(quantity_sold, 0) + p_quantity <= quantity_total
  returning * into v_ticket;

  if not found then
    raise exception 'Not enough tickets available' using errcode = '22023';
  end if;

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
     'pending',
     'whatsapp')
  returning id into v_order_id;

  return query select v_order_id, v_qr, v_total, v_ticket.name;
end;
$$;

revoke all on function public.create_ticket_order(uuid, text, text, text, integer) from public;
grant execute on function public.create_ticket_order(uuid, text, text, text, integer) to anon, authenticated;
