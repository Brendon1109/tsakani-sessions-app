-- Atomic ticket reservation function — prevents race conditions
-- Returns the updated row only if inventory was sufficient
CREATE OR REPLACE FUNCTION reserve_tickets(
  p_ticket_id uuid,
  p_quantity integer
)
RETURNS tickets AS $$
DECLARE
  v_ticket tickets;
BEGIN
  -- Atomic update with row-level lock via WHERE clause
  UPDATE tickets
  SET quantity_sold = quantity_sold + p_quantity
  WHERE id = p_ticket_id
    AND is_active = true
    AND quantity_sold + p_quantity <= quantity_total
  RETURNING * INTO v_ticket;

  IF v_ticket IS NULL THEN
    RAISE EXCEPTION 'Not enough tickets available or ticket inactive';
  END IF;

  RETURN v_ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Service role only. Nothing in the app calls it, and open to anon it let
-- anyone fill an event's capacity. See lock_down_inventory_functions.sql.
REVOKE ALL ON FUNCTION reserve_tickets(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_tickets(uuid, integer) TO service_role;

-- Gives seats back when an admin cancels an order. Admins and the service
-- role only: open to anon it let anyone make an event oversell. Kept in step
-- with lock_down_inventory_functions.sql.
CREATE OR REPLACE FUNCTION release_tickets(
  p_ticket_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tickets
  SET quantity_sold = GREATEST(0, quantity_sold - p_quantity)
  WHERE id = p_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION release_tickets(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION release_tickets(uuid, integer) TO authenticated, service_role;

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- Audit log for admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  user_email text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log" ON audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role writes audit log" ON audit_log
  FOR INSERT WITH CHECK (true);

-- Gallery summary view to fix N+1
CREATE OR REPLACE VIEW gallery_summaries AS
SELECT
  g.*,
  COALESCE(p.photo_count, 0) AS photo_count,
  p.cover_path,
  e.title AS event_title,
  e.date AS event_date,
  e.slug AS event_slug
FROM galleries g
LEFT JOIN events e ON e.id = g.event_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS photo_count,
    (array_agg(storage_path ORDER BY sort_order ASC))[1] AS cover_path
  FROM gallery_photos
  WHERE gallery_id = g.id
) p ON true;

-- Job queue for video processing
CREATE TABLE IF NOT EXISTS video_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES video_projects(id) ON DELETE CASCADE,
  config jsonb NOT NULL,
  status text DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  progress integer DEFAULT 0,
  output_path text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status, created_at);

ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage video jobs" ON video_jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
