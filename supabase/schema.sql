-- Tsakani Sessions Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- PROFILES (extends Supabase auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- EVENTS
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text unique not null,
  description text,
  date timestamptz not null,
  venue_name text,
  venue_address text,
  cover_image_url text,
  status text default 'draft' check (status in ('draft', 'published', 'past')),
  is_featured boolean default false,
  external_ticket_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- GALLERIES (one per event, or standalone)
create table if not exists galleries (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete set null,
  title text not null,
  slug text unique not null,
  description text,
  qr_code_url text,
  is_public boolean default false,
  created_at timestamptz default now()
);

-- GALLERY_PHOTOS
create table if not exists gallery_photos (
  id uuid default gen_random_uuid() primary key,
  gallery_id uuid references galleries(id) on delete cascade not null,
  storage_path text not null,
  thumbnail_path text,
  caption text,
  sort_order integer default 0,
  width integer,
  height integer,
  created_at timestamptz default now()
);

-- PRODUCTS
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  price_zar integer not null,
  category text check (category in ('tshirt', 'cup', 'accessory')),
  image_url text,
  sizes text[],
  colors text[],
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ORDERS
create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  items jsonb not null,
  total_zar integer not null,
  status text default 'pending' check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_method text default 'whatsapp' check (payment_method in ('whatsapp', 'yoco', 'payfast')),
  payment_reference text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TICKETS (ticket types per event)
create table if not exists tickets (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  name text not null,
  price_zar integer not null,
  quantity_total integer not null,
  quantity_sold integer default 0,
  sale_start timestamptz,
  sale_end timestamptz,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- TICKET_ORDERS
create table if not exists ticket_orders (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references tickets(id) on delete cascade not null,
  user_id uuid references profiles(id),
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  quantity integer default 1,
  total_zar integer not null,
  qr_code text unique,
  status text default 'pending' check (status in ('pending', 'confirmed', 'used', 'cancelled')),
  payment_method text default 'whatsapp',
  created_at timestamptz default now()
);

-- TEAM_MEMBERS (must be created before venues due to FK)
create table if not exists team_members (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  name text not null,
  role text not null,
  responsibilities text[],
  phone text,
  email text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- VENUES (partnership CRM)
create table if not exists venues (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  area text,
  capacity integer,
  venue_type text,
  hire_cost_zar integer,
  revenue_share_percent integer,
  partnership_status text default 'prospect'
    check (partnership_status in ('prospect', 'contacted', 'negotiating', 'partnered', 'declined')),
  notes text,
  website text,
  instagram text,
  assigned_to uuid references team_members(id),
  last_contacted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- VENUE_CONTACTS
create table if not exists venue_contacts (
  id uuid default gen_random_uuid() primary key,
  venue_id uuid references venues(id) on delete cascade not null,
  name text not null,
  role text,
  phone text,
  email text,
  is_primary boolean default false,
  created_at timestamptz default now()
);

-- TEAM_TASKS
create table if not exists team_tasks (
  id uuid default gen_random_uuid() primary key,
  assigned_to uuid references team_members(id) not null,
  title text not null,
  description text,
  due_date date,
  status text default 'todo' check (status in ('todo', 'in_progress', 'done', 'blocked')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  event_id uuid references events(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- GALLERY_VIEWS (lead capture)
create table if not exists gallery_views (
  id uuid default gen_random_uuid() primary key,
  gallery_id uuid references galleries(id) on delete cascade,
  user_id uuid references profiles(id),
  viewed_at timestamptz default now()
);

-- NEWSLETTER_SUBSCRIBERS
create table if not exists newsletter_subscribers (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  source text default 'website',
  subscribed_at timestamptz default now(),
  is_active boolean default true
);

-- BOOKING_ENQUIRIES (service booking requests from /services)
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

-- VIDEO_PROJECTS
create table if not exists video_projects (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id),
  title text not null,
  status text default 'pending' check (status in ('pending', 'processing', 'complete', 'failed')),
  source_files jsonb,
  output_path text,
  youtube_url text,
  instagram_url text,
  tiktok_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

alter table profiles enable row level security;
alter table events enable row level security;
alter table galleries enable row level security;
alter table gallery_photos enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table tickets enable row level security;
alter table ticket_orders enable row level security;
alter table venues enable row level security;
alter table venue_contacts enable row level security;
alter table team_members enable row level security;
alter table team_tasks enable row level security;
alter table gallery_views enable row level security;
alter table newsletter_subscribers enable row level security;
alter table booking_enquiries enable row level security;
alter table video_projects enable row level security;

-- Profiles: users read/update own, admins read all
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Admins read all profiles" on profiles for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Service role manages profiles" on profiles for all using (auth.role() = 'service_role');

-- Events: public read published, admins CRUD all
create policy "Public read published events" on events for select using (status = 'published');
create policy "Admins manage events" on events for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Galleries: public read public ones, authenticated read all, admins CRUD
create policy "Public read public galleries" on galleries for select using (is_public = true);
create policy "Authenticated read galleries" on galleries for select using (auth.uid() is not null);
create policy "Admins manage galleries" on galleries for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Gallery photos: same as galleries
create policy "Read gallery photos" on gallery_photos for select using (
  exists (select 1 from galleries where id = gallery_photos.gallery_id and (is_public = true or auth.uid() is not null))
);
create policy "Admins manage photos" on gallery_photos for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Products: public read active
create policy "Public read active products" on products for select using (is_active = true);
create policy "Admins manage products" on products for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Orders: users read own, admins read all
create policy "Users read own orders" on orders for select using (user_id = auth.uid());
create policy "Admins manage orders" on orders for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Anyone can create orders" on orders for insert with check (true);

-- Tickets: public read active
create policy "Public read active tickets" on tickets for select using (is_active = true);
create policy "Admins manage tickets" on tickets for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Ticket orders: users read own, admins manage all
create policy "Users read own ticket orders" on ticket_orders for select using (user_id = auth.uid());
create policy "Admins manage ticket orders" on ticket_orders for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Anyone can create ticket orders" on ticket_orders for insert with check (true);

-- Admin-only tables
create policy "Admins manage venues" on venues for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins manage venue contacts" on venue_contacts for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins manage team members" on team_members for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins manage team tasks" on team_tasks for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins manage video projects" on video_projects for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Gallery views: authenticated insert, admins read all
create policy "Authenticated insert gallery views" on gallery_views for insert with check (auth.uid() is not null);
create policy "Admins read gallery views" on gallery_views for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Newsletter: anyone can subscribe, admins read all
create policy "Anyone can subscribe" on newsletter_subscribers for insert with check (true);
create policy "Admins manage subscribers" on newsletter_subscribers for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Booking enquiries: anyone can submit, admins manage all
create policy "Anyone can submit a booking" on booking_enquiries
  for insert to anon, authenticated with check (true);
create policy "Admins manage bookings" on booking_enquiries for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'user'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
