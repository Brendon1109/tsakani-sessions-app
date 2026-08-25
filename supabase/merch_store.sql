-- MERCH STORE: admin-managed products, and EFT checkout.
--
-- Three things happen in this file.
--
-- 1. Products get the fields an admin actually needs to load a drop: more than
--    one photo, a category that covers hoodies and bucket hats, a sort order so
--    the shop is not stuck with "oldest first", and a stock flag that is
--    separate from is_active. Sold out and hidden are different states: sold out
--    still deserves a page, hidden does not.
--
-- 2. Bank details for EFT live in store_settings, one row, admin only. There is
--    deliberately no public read policy on this table. Buyers get the details
--    back from create_merch_order below, which means account numbers are handed
--    to someone who has placed an order rather than printed in the HTML of a
--    public page for anyone to scrape and re-use in a fake invoice.
--
-- 3. create_merch_order fixes a live bug. /api/orders did
--    `.insert(...).select().single()` as anon, which is INSERT ... RETURNING,
--    and the only SELECT policy on orders is `user_id = auth.uid()`. A visitor
--    has no auth.uid(), so the read-back was refused and every merch checkout
--    failed with "new row violates row-level security policy". The orders table
--    was empty because of it. This is the same trap already documented in
--    create_ticket_order_fn.sql and booking_enquiries.sql, so it gets the same
--    fix: one SECURITY DEFINER function that does the narrow write and hands
--    back only the row it just created.
--
-- Run after schema.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------------

alter table products drop constraint if exists products_category_check;
alter table products add constraint products_category_check
  check (category in ('tshirt', 'hoodie', 'hat', 'cup', 'accessory', 'other'));

-- Extra photos. image_url stays the primary shot so nothing that already reads
-- it has to change; images holds the rest, in display order.
alter table products add column if not exists images text[] not null default '{}';
alter table products add column if not exists sort_order integer not null default 0;
alter table products add column if not exists in_stock boolean not null default true;
alter table products add column if not exists updated_at timestamptz default now();

create index if not exists products_sort_idx on products (sort_order, created_at);

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------

alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('whatsapp', 'eft', 'yoco', 'payfast'));

-- The short code a buyer types into their banking app. Not a key, just
-- something a human can copy without reading a uuid down a phone line.
create unique index if not exists orders_payment_reference_idx
  on orders (payment_reference) where payment_reference is not null;

create index if not exists orders_status_idx on orders (status, created_at desc);

-- ---------------------------------------------------------------------------
-- STORE SETTINGS (bank details for EFT)
-- ---------------------------------------------------------------------------

create table if not exists store_settings (
  id boolean primary key default true check (id),
  eft_enabled boolean not null default false,
  account_holder text,
  bank_name text,
  account_number text,
  branch_code text,
  account_type text,
  payment_email text,
  eft_instructions text,
  updated_at timestamptz default now()
);

insert into store_settings (id) values (true) on conflict (id) do nothing;

alter table store_settings enable row level security;

-- Admin only. Buyers never select from this table; create_merch_order hands
-- them the details after their order exists.
drop policy if exists "Admins manage store settings" on store_settings;
create policy "Admins manage store settings" on store_settings for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ---------------------------------------------------------------------------
-- CLEANUP_STALE_MERCH_ORDERS
-- ---------------------------------------------------------------------------
--
-- /api/cron/cleanup-orders promises that an unpaid order is cancelled after 48
-- hours, and the EFT screen repeats that promise right under the bank details.
-- It was not true: that route runs on the anon key, the only UPDATE policy on
-- orders is the admin one, so the sweep matched zero rows every night and said
-- so with a cheerful "cancelled_orders: 0". Verified against the live database
-- before writing this.
--
-- Same fix as everywhere else in this schema, a narrow SECURITY DEFINER
-- function. It can only ever touch orders that are already pending and already
-- older than the cutoff, so the worst an unexpected caller can do is run
-- tonight's cleanup early.
--
-- NOTE: the ticket_orders and rate_limits halves of that same cron are blocked
-- by RLS in exactly the same way and are NOT fixed here.

create or replace function public.cleanup_stale_merch_orders(p_hours integer default 48)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_hours is null or p_hours < 1 then
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

revoke all on function public.cleanup_stale_merch_orders(integer) from public;
grant execute on function public.cleanup_stale_merch_orders(integer) to anon, authenticated;

-- Whether the shop should offer an EFT button at all. This is the only thing
-- about the bank account a visitor can learn before ordering: yes or no.
create or replace function public.eft_available()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select eft_enabled from public.store_settings where id = true), false);
$$;

revoke all on function public.eft_available() from public;
grant execute on function public.eft_available() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- CREATE_MERCH_ORDER
-- ---------------------------------------------------------------------------
--
-- Prices, sizes and colours are read from the products table inside the same
-- transaction, so a client that posts its own price is simply ignored. The
-- function raises 22023 for anything a buyer can fix by changing their input,
-- which the API maps to a 400.

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
  eft_instructions  text
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
  if v_method not in ('whatsapp', 'eft') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  select * into v_settings from public.store_settings where id = true;

  if v_method = 'eft' and coalesce(v_settings.eft_enabled, false) = false then
    raise exception 'EFT payment is not available right now' using errcode = '22023';
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

    -- An empty sizes or colors array means the product has no such choice,
    -- a bucket hat for instance, so anything sent is dropped rather than
    -- failing the order.
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
      -- price is per unit in RAND, matching what the confirmation email and the
      -- admin order table already render. orders.total_zar stays in CENTS.
      'price', round(v_product.price_zar / 100.0, 2)
    );
  end loop;

  if v_total <= 0 then
    raise exception 'Order total came to zero' using errcode = '22023';
  end if;

  -- Short, human-typeable reference. Hex on purpose: it gets read off a screen
  -- and typed into a banking app, and hex has no letter that can be mistaken
  -- for a digit the way O and 0 or I and 1 can.
  loop
    v_attempt := v_attempt + 1;
    v_ref := 'TS-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    -- Qualified, because payment_reference is also an OUT parameter of this
    -- function and an unqualified reference is ambiguous.
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
    case when v_method = 'eft' then v_settings.eft_instructions end;
end;
$$;

revoke all on function public.create_merch_order(text, text, text, jsonb, text) from public;
grant execute on function public.create_merch_order(text, text, text, jsonb, text) to anon, authenticated;
