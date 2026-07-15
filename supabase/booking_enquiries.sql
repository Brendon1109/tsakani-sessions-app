-- BOOKING_ENQUIRIES: capture service booking requests from /services
--
-- Before this table existed the booking form only opened WhatsApp and stored
-- nothing, so every enquiry lived only in a chat thread and was lost the moment
-- the tab closed. Now each submission is written here first, then WhatsApp opens
-- with the same details so the team can still confirm the usual way.
--
-- The public insert path uses the anon key. We deliberately do NOT read the row
-- back with RETURNING: the only SELECT policy here is admin, so a RETURNING as
-- anon would be refused by RLS, the same trap documented in
-- create_ticket_order_fn.sql. The API mints the id itself and inserts it, so a
-- plain INSERT (no read-back) is all that is needed.

create table if not exists booking_enquiries (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text,
  phone text,
  event_type text,
  event_date text,
  venue text,
  message text,
  status text default 'new' check (status in ('new', 'contacted', 'confirmed', 'declined')),
  source text default 'services_form',
  created_at timestamptz default now()
);

alter table booking_enquiries enable row level security;

-- Anyone can submit a booking (anon and signed-in visitors).
create policy "Anyone can submit a booking" on booking_enquiries
  for insert to anon, authenticated
  with check (true);

-- Admins can read, update and delete every enquiry.
create policy "Admins manage bookings" on booking_enquiries for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
