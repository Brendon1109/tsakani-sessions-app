-- PAYSTACK: card checkout through a hosted payment page.
--
-- This is the pasted-link version, not the API integration. An admin creates a
-- payment page in the Paystack dashboard and pastes its URL into
-- /admin/store-settings. Checkout writes the order, then sends the buyer to
-- that page with the amount and their email pre-filled and locked.
--
-- What this deliberately does NOT do, and it matters:
--
-- Paystack payment pages accept email, first_name, last_name and amount as
-- query parameters, and nothing else. There is no reference parameter and no
-- metadata. So money arrives in the Paystack dashboard with no way for us to
-- tell which order it belongs to, and reconciliation stays manual, exactly as
-- it is for EFT. The buyer is shown their TS- reference before they are sent
-- across and asked to type it into a custom field on the page.
--
-- The version that closes that loop is POST /transaction/initialize with our
-- own reference, plus a charge.success webhook. That needs API keys and is the
-- next step, not this one.
--
-- Run after merch_store.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- STORE SETTINGS
-- ---------------------------------------------------------------------------

alter table store_settings add column if not exists paystack_enabled boolean not null default false;
alter table store_settings add column if not exists paystack_url text;
alter table store_settings add column if not exists paystack_note text;

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------

alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('whatsapp', 'eft', 'paystack', 'yoco', 'payfast'));

-- ---------------------------------------------------------------------------
-- CHECKOUT_OPTIONS
-- ---------------------------------------------------------------------------
--
-- What the shop is allowed to offer. Two booleans and nothing else: the bank
-- account and the payment link stay admin-only, and a visitor learns only
-- which buttons to draw.
--
-- eft_available() is kept because the currently deployed build calls it. It can
-- go once nothing references it.

create or replace function public.checkout_options()
returns table (eft boolean, paystack boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce((select s.eft_enabled from public.store_settings s where s.id = true), false),
    coalesce((select s.paystack_enabled from public.store_settings s where s.id = true), false)
       and coalesce((select s.paystack_url from public.store_settings s where s.id = true), '') <> '';
$$;

revoke all on function public.checkout_options() from public;
grant execute on function public.checkout_options() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- CREATE_MERCH_ORDER, now with paystack
-- ---------------------------------------------------------------------------

create or replace function public.create_merch_order(
  p_customer_name   text,
  p_customer_phone  text,
  p_customer_email  text,
  p_items           jsonb,
  p_payment_method  text
)
returns table (
  order_id          uuid,
  total_zar         integer,
  payment_reference text,
  eft_enabled       boolean,
  account_holder    text,
  bank_name         text,
  account_number    text,
  branch_code       text,
  account_type      text,
  payment_email     text,
  eft_instructions  text,
  paystack_url      text,
  paystack_note     text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item      jsonb;
  v_product   public.products;
  v_qty       integer;
  v_size      text;
  v_colour    text;
  v_total     integer := 0;
  v_validated jsonb := '[]'::jsonb;
  v_ref       text;
  v_order_id  uuid;
  v_method    text;
  v_settings  public.store_settings;
  v_attempt   integer := 0;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'Please enter your name' using errcode = '22023';
  end if;

  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'Please enter a phone number' using errcode = '22023';
  end if;

  if p_customer_email is not null and btrim(p_customer_email) <> ''
     and (position('@' in p_customer_email) = 0 or length(p_customer_email) > 254) then
    raise exception 'Please enter a valid email address' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) > 40 then
    raise exception 'Too many lines in one order' using errcode = '22023';
  end if;

  v_method := coalesce(nullif(btrim(p_payment_method), ''), 'whatsapp');
  if v_method not in ('whatsapp', 'eft', 'paystack') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  select * into v_settings from public.store_settings where id = true;

  if v_method = 'eft' and coalesce(v_settings.eft_enabled, false) = false then
    raise exception 'EFT payment is not available right now' using errcode = '22023';
  end if;

  if v_method = 'paystack'
     and (coalesce(v_settings.paystack_enabled, false) = false
          or coalesce(v_settings.paystack_url, '') = '') then
    raise exception 'Card payment is not available right now' using errcode = '22023';
  end if;

  -- Paystack needs an email to send the receipt to, and it is the only handle
  -- we get for matching a payment back to an order by hand.
  if v_method = 'paystack' and coalesce(btrim(p_customer_email), '') = '' then
    raise exception 'An email address is needed to pay by card' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
      from public.products
     where id = (v_item ->> 'product_id')::uuid;

    if not found or v_product.is_active = false then
      raise exception 'One of the items is no longer available' using errcode = '22023';
    end if;

    if v_product.in_stock = false then
      raise exception '% is sold out', v_product.name using errcode = '22023';
    end if;

    v_qty := coalesce((v_item ->> 'qty')::integer, 0);
    if v_qty < 1 or v_qty > 50 then
      raise exception 'Quantity for % must be between 1 and 50', v_product.name using errcode = '22023';
    end if;

    v_size := nullif(btrim(coalesce(v_item ->> 'size', '')), '');
    v_colour := nullif(btrim(coalesce(v_item ->> 'color', '')), '');

    if coalesce(array_length(v_product.sizes, 1), 0) = 0 then
      v_size := null;
    elsif v_size is null or not (v_size = any (v_product.sizes)) then
      raise exception 'Pick a size for %', v_product.name using errcode = '22023';
    end if;

    if coalesce(array_length(v_product.colors, 1), 0) = 0 then
      v_colour := null;
    elsif v_colour is null or not (v_colour = any (v_product.colors)) then
      raise exception 'Pick a colour for %', v_product.name using errcode = '22023';
    end if;

    v_total := v_total + (v_product.price_zar * v_qty);

    v_validated := v_validated || jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'size', coalesce(v_size, ''),
      'color', coalesce(v_colour, ''),
      'qty', v_qty,
      'price', round(v_product.price_zar / 100.0, 2)
    );
  end loop;

  if v_total <= 0 then
    raise exception 'Order total came to zero' using errcode = '22023';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_ref := 'TS-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.orders o where o.payment_reference = v_ref);
    if v_attempt > 10 then
      raise exception 'Could not allocate a payment reference' using errcode = '55000';
    end if;
  end loop;

  insert into public.orders
    (customer_name, customer_email, customer_phone, items, total_zar,
     status, payment_method, payment_reference)
  values
    (btrim(p_customer_name),
     nullif(lower(btrim(coalesce(p_customer_email, ''))), ''),
     btrim(p_customer_phone),
     v_validated,
     v_total,
     'pending',
     v_method,
     v_ref)
  returning id into v_order_id;

  return query
  select
    v_order_id,
    v_total,
    v_ref,
    v_method = 'eft',
    case when v_method = 'eft' then v_settings.account_holder end,
    case when v_method = 'eft' then v_settings.bank_name end,
    case when v_method = 'eft' then v_settings.account_number end,
    case when v_method = 'eft' then v_settings.branch_code end,
    case when v_method = 'eft' then v_settings.account_type end,
    case when v_method = 'eft' then v_settings.payment_email end,
    case when v_method = 'eft' then v_settings.eft_instructions end,
    case when v_method = 'paystack' then v_settings.paystack_url end,
    case when v_method = 'paystack' then v_settings.paystack_note end;
end;
$$;

revoke all on function public.create_merch_order(text, text, text, jsonb, text) from public;
grant execute on function public.create_merch_order(text, text, text, jsonb, text) to anon, authenticated;
