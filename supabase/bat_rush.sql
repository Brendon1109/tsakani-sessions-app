-- BAT RUSH: the Halloween 2026 phone game at /halloween and its leaderboard.
-- 29 October 2026.
--
-- Three tables, three functions, admin policies and the seed rounds.
--
-- 1. bat_rush_rounds. A competition belongs to an event, so the next Tsakani
--    event can run its own rounds. A round is open from opens_at until
--    closes_at. Prize text and times are edited on /admin/halloween, and the
--    winner of the live play-off is marked there.
--
-- 2. bat_rush_players. One row per player per event: the first name and
--    initial taken from their Google account, and the Instagram handle they
--    gave, if any, with whether they ticked "show it on the board". Not
--    profiles: nothing in this file alters an existing table.
--
-- 3. bat_rush_scores. One row per saved round.
--
-- Nobody but an admin can read or write these tables. Everyone else goes
-- through two functions:
--
--   bat_rush_board(slug)   anyone. The top 10 of the round on the board, best
--                          aura per player, as display name, aura and rank.
--                          Never an email and never a user id.
--   bat_rush_submit(...)   signed in players only. The one way a score gets
--                          in. It refuses anonymous callers, any aura above
--                          the cap, and a second save from the same player
--                          inside 30 seconds, counted from this table itself
--                          (the app's rate_limits table has never worked,
--                          RLS on and no policy). The round is the one open
--                          when the save arrives, decided here, not by the
--                          browser.
--   bat_rush_set_handle()  signed in players only. Changes or withdraws their
--                          own handle and whether it shows, at any time.
--
-- THE SCORE CAP, 270, is lib/bat-rush/rules.ts SCORE_CAP. A round has exactly
-- 72 spawns (the schedule there is deterministic), at most 3 of them gold bats
-- at 67, every other spawn at most a plain bat at 1, and a pumpkin only takes
-- aura away: 69 * 1 + 3 * 67 = 270. __tests__/batRush.test.ts fails if this
-- file and the game disagree. To change the cap, change the number in
-- bat_rush_submit and re-run this file, AND alter the table's CHECK by hand
-- (alter table public.bat_rush_scores drop constraint bat_rush_scores_aura_check,
-- then add it back with the new number): it sits inside create table if not
-- exists, so a re-run does not touch it.
--
-- RETENTION. Handles and scores are kept for 30 days after the event and then
-- deleted, so by 30 November 2026 for the Halloween party. Nothing deletes
-- them on its own. It is two statements, run by hand in the SQL editor:
--
--   delete from public.bat_rush_rounds
--    where event_id = (select id from public.events where slug = 'hallowee-kani');
--   delete from public.bat_rush_players
--    where event_id = (select id from public.events where slug = 'hallowee-kani');
--
-- Scores go with their rounds. Deleting a user removes their rows too.
--
-- Additive only. Run after schema.sql (events, profiles). Safe to re-run: the
-- seed never overwrites a round an admin has edited.
--
-- Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.


-- ── 1. Tables ───────────────────────────────────────────────

create table if not exists public.bat_rush_rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  prize text check (prize is null or char_length(prize) <= 120),
  winner_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bat_rush_rounds_closes_after_opens check (closes_at > opens_at),
  constraint bat_rush_rounds_name_per_event unique (event_id, name)
);

create table if not exists public.bat_rush_players (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  instagram_handle text
    check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  show_handle boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.bat_rush_scores (
  id bigint generated always as identity primary key,
  round_id uuid not null references public.bat_rush_rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  aura integer not null check (aura between 0 and 270),
  created_at timestamptz not null default now()
);

create index if not exists bat_rush_scores_board_idx
  on public.bat_rush_scores (round_id, user_id, aura desc, created_at);
create index if not exists bat_rush_scores_user_idx
  on public.bat_rush_scores (user_id, created_at desc);

comment on table public.bat_rush_rounds is
  'Bat Rush rounds per event. Admins only; the public board reads through bat_rush_board.';
comment on table public.bat_rush_players is
  'Bat Rush players per event: Google first name and initial, optional Instagram handle. Admins only. Deleted 30 days after the event.';
comment on table public.bat_rush_scores is
  'Bat Rush saved rounds. Written only by bat_rush_submit. Admins read and delete. Deleted 30 days after the event.';


-- ── 2. Access: admins only, through RLS like the rest of the app ──

alter table public.bat_rush_rounds enable row level security;
alter table public.bat_rush_players enable row level security;
alter table public.bat_rush_scores enable row level security;

-- Supabase grants everything on new tables to anon and authenticated by
-- default. Take it all back, then give authenticated only what an admin
-- screen needs, which RLS then narrows to admins. Nobody inserts a score
-- directly, admins included.
revoke all on table public.bat_rush_rounds, public.bat_rush_players, public.bat_rush_scores
  from anon, authenticated;
grant select, insert, update, delete on table public.bat_rush_rounds to authenticated;
grant select, update, delete on table public.bat_rush_players to authenticated;
grant select, delete on table public.bat_rush_scores to authenticated;
revoke all on sequence public.bat_rush_scores_id_seq from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                  and tablename = 'bat_rush_rounds' and policyname = 'Admins manage bat rush rounds') then
    create policy "Admins manage bat rush rounds" on public.bat_rush_rounds
      for all to authenticated
      using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
      with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
                  and tablename = 'bat_rush_players' and policyname = 'Admins read bat rush players') then
    create policy "Admins read bat rush players" on public.bat_rush_players
      for select to authenticated
      using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
                  and tablename = 'bat_rush_players' and policyname = 'Admins update bat rush players') then
    create policy "Admins update bat rush players" on public.bat_rush_players
      for update to authenticated
      using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
      with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
                  and tablename = 'bat_rush_players' and policyname = 'Admins delete bat rush players') then
    create policy "Admins delete bat rush players" on public.bat_rush_players
      for delete to authenticated
      using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
                  and tablename = 'bat_rush_scores' and policyname = 'Admins read bat rush scores') then
    create policy "Admins read bat rush scores" on public.bat_rush_scores
      for select to authenticated
      using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
                  and tablename = 'bat_rush_scores' and policyname = 'Admins delete bat rush scores') then
    create policy "Admins delete bat rush scores" on public.bat_rush_scores
      for delete to authenticated
      using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
  end if;
end
$$;


-- ── 3. Display name: "Brendon M." from a Google full name ───

create or replace function public.bat_rush_display_name(p_full_name text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_parts text[];
  v_first text;
  v_initial text;
begin
  v_parts := regexp_split_to_array(
    btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g')), ' ');
  v_first := left(v_parts[1], 20);
  if v_first is null or v_first = '' then
    return 'Player';
  end if;
  if array_length(v_parts, 1) > 1 then
    v_initial := upper(left(regexp_replace(v_parts[array_length(v_parts, 1)], '[^[:alnum:]]', '', 'g'), 1));
    if v_initial <> '' then
      return v_first || ' ' || v_initial || '.';
    end if;
  end if;
  return v_first;
end;
$$;

revoke all on function public.bat_rush_display_name(text) from public, anon, authenticated;


-- ── 4. bat_rush_submit: the only way a score gets in ────────

create or replace function public.bat_rush_submit(
  p_event_slug text,
  p_aura integer,
  p_handle text default null,
  p_show_handle boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_round public.bat_rush_rounds%rowtype;
  v_player public.bat_rush_players%rowtype;
  v_handle text;
  v_name text;
  v_best integer;
  v_rank integer;
begin
  if v_uid is null then
    raise exception 'Sign in to save your aura' using errcode = '42501';
  end if;

  -- SCORE_CAP in lib/bat-rush/rules.ts.
  if p_aura is null or p_aura < 0 or p_aura > 270 then
    return jsonb_build_object('ok', false, 'reason', 'bad_score');
  end if;

  select id into v_event from public.events where slug = p_event_slug;
  if v_event is null then
    return jsonb_build_object('ok', false, 'reason', 'no_event');
  end if;

  -- One save per player per 30 seconds, from this table. The lock queues two
  -- saves sent at the same moment, so the second sees the first.
  perform pg_advisory_xact_lock(hashtextextended('bat_rush_submit:' || v_uid::text, 0));
  if exists (
    select 1 from public.bat_rush_scores
     where user_id = v_uid and created_at > now() - interval '30 seconds'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'too_soon');
  end if;

  select * into v_round from public.bat_rush_rounds
   where event_id = v_event and opens_at <= now() and closes_at > now()
   order by closes_at asc
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  select * into v_player from public.bat_rush_players
   where event_id = v_event and user_id = v_uid;

  -- First save of the event asks once for an Instagram handle. p_show_handle
  -- set means the player has answered, with or without a handle.
  if not found and p_show_handle is null then
    return jsonb_build_object('ok', false, 'reason', 'need_handle');
  end if;

  if p_show_handle is not null then
    v_handle := nullif(regexp_replace(btrim(coalesce(p_handle, '')), '^@', ''), '');
    if v_handle is not null and v_handle !~ '^[A-Za-z0-9._]{1,30}$' then
      return jsonb_build_object('ok', false, 'reason', 'bad_handle');
    end if;

    -- The name comes from the Google identity, which only Google can change.
    -- profiles.full_name and user_metadata are both editable by the user.
    select public.bat_rush_display_name(
             coalesce(i.identity_data ->> 'full_name', i.identity_data ->> 'name'))
      into v_name
      from auth.identities i
     where i.user_id = v_uid and i.provider = 'google'
     order by i.created_at
     limit 1;

    insert into public.bat_rush_players
      (event_id, user_id, display_name, instagram_handle, show_handle)
    values
      (v_event, v_uid, coalesce(v_name, 'Player'), v_handle,
       p_show_handle and v_handle is not null)
    on conflict (event_id, user_id) do update
      set instagram_handle = excluded.instagram_handle,
          show_handle = excluded.show_handle,
          updated_at = now()
    returning * into v_player;
  end if;

  insert into public.bat_rush_scores (round_id, user_id, aura)
  values (v_round.id, v_uid, p_aura);

  with best as (
    select distinct on (s.user_id) s.user_id, s.aura, s.created_at
      from public.bat_rush_scores s
     where s.round_id = v_round.id
     order by s.user_id, s.aura desc, s.created_at asc
  ), ranked as (
    select b.user_id, b.aura,
           row_number() over (order by b.aura desc, b.created_at asc) as rank
      from best b
  )
  select r.aura, r.rank into v_best, v_rank from ranked r where r.user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'round', v_round.name,
    'best', v_best,
    'rank', v_rank,
    'name', case when v_player.show_handle and v_player.instagram_handle is not null
                 then '@' || v_player.instagram_handle else v_player.display_name end
  );
end;
$$;

revoke all on function public.bat_rush_submit(text, integer, text, boolean) from public, anon;
grant execute on function public.bat_rush_submit(text, integer, text, boolean) to authenticated;


-- ── 4b. bat_rush_set_handle: change or withdraw your own handle ──
-- Consent to show a handle can be withdrawn at any time, so a player can
-- clear it or untick it without saving another score. Touches only the
-- caller's own row, and never creates one.

create or replace function public.bat_rush_set_handle(
  p_event_slug text,
  p_handle text,
  p_show_handle boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_handle text;
  v_player public.bat_rush_players%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;

  select id into v_event from public.events where slug = p_event_slug;
  if v_event is null then
    return jsonb_build_object('ok', false, 'reason', 'no_event');
  end if;

  v_handle := nullif(regexp_replace(btrim(coalesce(p_handle, '')), '^@', ''), '');
  if v_handle is not null and v_handle !~ '^[A-Za-z0-9._]{1,30}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_handle');
  end if;

  update public.bat_rush_players
     set instagram_handle = v_handle,
         show_handle = coalesce(p_show_handle, false) and v_handle is not null,
         updated_at = now()
   where event_id = v_event and user_id = v_uid
  returning * into v_player;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_player');
  end if;

  return jsonb_build_object(
    'ok', true,
    'name', case when v_player.show_handle and v_player.instagram_handle is not null
                 then '@' || v_player.instagram_handle else v_player.display_name end
  );
end;
$$;

revoke all on function public.bat_rush_set_handle(text, text, boolean) from public, anon;
grant execute on function public.bat_rush_set_handle(text, text, boolean) to authenticated;


-- ── 5. bat_rush_board: the public top 10 ────────────────────

create or replace function public.bat_rush_board(p_event_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_event uuid;
  v_round public.bat_rush_rounds%rowtype;
  v_rows jsonb;
begin
  select id into v_event from public.events where slug = p_event_slug;
  if v_event is null then
    return jsonb_build_object('round', null, 'rows', '[]'::jsonb);
  end if;

  -- The open round, else the one that closed last, else the next to open.
  select * into v_round from public.bat_rush_rounds
   where event_id = v_event and opens_at <= now() and closes_at > now()
   order by closes_at asc limit 1;
  if not found then
    select * into v_round from public.bat_rush_rounds
     where event_id = v_event and closes_at <= now()
     order by closes_at desc limit 1;
  end if;
  if not found then
    select * into v_round from public.bat_rush_rounds
     where event_id = v_event and opens_at > now()
     order by opens_at asc limit 1;
  end if;
  if not found then
    return jsonb_build_object('round', null, 'rows', '[]'::jsonb);
  end if;

  with best as (
    select distinct on (s.user_id) s.user_id, s.aura, s.created_at
      from public.bat_rush_scores s
     where s.round_id = v_round.id
     order by s.user_id, s.aura desc, s.created_at asc
  ), ranked as (
    select b.user_id, b.aura,
           row_number() over (order by b.aura desc, b.created_at asc) as rank
      from best b
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', r.rank,
           'name', case when p.show_handle and p.instagram_handle is not null
                        then '@' || p.instagram_handle
                        else coalesce(p.display_name, 'Player') end,
           'aura', r.aura,
           'winner', r.user_id is not distinct from v_round.winner_user_id
         ) order by r.rank), '[]'::jsonb)
    into v_rows
    from ranked r
    left join public.bat_rush_players p
      on p.event_id = v_event and p.user_id = r.user_id
   where r.rank <= 10;

  return jsonb_build_object(
    'round', jsonb_build_object(
      'name', v_round.name,
      'opens_at', v_round.opens_at,
      'closes_at', v_round.closes_at,
      'prize', v_round.prize,
      'open', v_round.opens_at <= now() and v_round.closes_at > now()
    ),
    'rows', v_rows
  );
end;
$$;

revoke all on function public.bat_rush_board(text) from public;
grant execute on function public.bat_rush_board(text) to anon, authenticated;


-- ── 6. Seed: the Halloween party's rounds, Cape Town time ───
-- Times and prizes are not confirmed. Both are edited on /admin/halloween.

insert into public.bat_rush_rounds (event_id, name, opens_at, closes_at)
select e.id, v.name, v.opens_at, v.closes_at
  from public.events e
 cross join (values
   ('Warm up', timestamptz '2026-10-29 00:00:00+02', timestamptz '2026-10-31 16:00:00+02'),
   ('Round 1', timestamptz '2026-10-31 16:00:00+02', timestamptz '2026-10-31 19:30:00+02'),
   ('Round 2', timestamptz '2026-10-31 19:30:00+02', timestamptz '2026-10-31 22:00:00+02'),
   ('Round 3', timestamptz '2026-10-31 22:00:00+02', timestamptz '2026-11-01 00:30:00+02')
 ) as v(name, opens_at, closes_at)
 where e.slug = 'hallowee-kani'
on conflict (event_id, name) do nothing;
