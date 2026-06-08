-- Predictive local analytics: first-party event store.
-- Run this in the Supabase SQL Editor (hand-run convention, like the other
-- files in this folder — there is no migrations dir).
--
-- POPIA note: this table intentionally stores NO raw IP address and no
-- personal data. Geo is coarse (city/region/country), identity is a random
-- client session id, and props are non-personal interaction metadata.

CREATE TABLE IF NOT EXISTS analytics_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site          text NOT NULL DEFAULT 'app',        -- 'app' | 'static'
  event_name    text NOT NULL,                      -- page_view, book_now_cta_click, ...
  path          text,
  referrer_host text,
  session_id    text,                               -- anonymous, client-generated
  city          text,                               -- coarse geo (Vercel edge)
  region        text,
  country       text,
  device        text,                               -- mobile | tablet | desktop
  props         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_created
  ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_created
  ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_city_created
  ON analytics_events (city, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_session
  ON analytics_events (session_id);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous visitors included) may log an event. This matches the
-- existing public-write convention (orders / newsletter use WITH CHECK (true));
-- the /api/track route rate-limits, validates and caps the payload.
DROP POLICY IF EXISTS "Anyone can log analytics" ON analytics_events;
CREATE POLICY "Anyone can log analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

-- Only admins may read analytics. Uses the non-recursive security-definer
-- helper. This helper is normally created by fix_rls_recursion.sql; it is
-- (re)defined here with CREATE OR REPLACE so this file is self-contained and
-- can be run on its own (idempotent — safe if the function already exists).
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins read analytics" ON analytics_events;
CREATE POLICY "Admins read analytics"
  ON analytics_events FOR SELECT
  USING (is_current_user_admin());
