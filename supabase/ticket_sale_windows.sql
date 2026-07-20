-- ============================================================
-- TICKET SALE WINDOWS
-- ============================================================
-- Tickets already had sale_start and sale_end columns, but nothing ever
-- read them. Visibility was driven purely by is_active, a manual switch
-- with no admin control and no automation behind it.
--
-- This makes the window real, so a door ticket can open by itself at
-- 13:00 on the day and close at 04:00 the next morning without anyone
-- remembering to flip a toggle, and without a cron job that can miss a
-- run or fire twice.
--
-- Safe to re-run.
--
-- Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.


-- ── 1. Teach reserve_tickets about the window ───────────────
-- The database stays the authority. The UI hides tickets that are off
-- sale, but a stale tab or a direct POST must still be refused here.
--
-- Unchanged from before: SECURITY DEFINER, owned by postgres, so the
-- anon role can reserve without holding UPDATE on tickets.
-- Added: an explicit search_path, which Supabase's own security advisor
-- flags as missing on SECURITY DEFINER functions.

CREATE OR REPLACE FUNCTION public.reserve_tickets(p_ticket_id uuid, p_quantity integer)
 RETURNS tickets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ticket tickets;
BEGIN
  -- Atomic update with row-level lock via WHERE clause.
  -- The window is half open, [sale_start, sale_end), so a ticket ending
  -- at 04:00 is already closed at 04:00 exactly.
  UPDATE tickets
  SET quantity_sold = quantity_sold + p_quantity
  WHERE id = p_ticket_id
    AND is_active = true
    AND (sale_start IS NULL OR sale_start <= now())
    AND (sale_end   IS NULL OR sale_end   >  now())
    AND quantity_sold + p_quantity <= quantity_total
  RETURNING * INTO v_ticket;

  IF v_ticket IS NULL THEN
    RAISE EXCEPTION 'Not enough tickets available, or this ticket is not on sale right now';
  END IF;

  RETURN v_ticket;
END;
$function$;


-- ── 2. Helper: default windows for an event ─────────────────
-- Free entry runs until the door opens, then door tickets take over
-- until the event is over. All times are Africa/Johannesburg, computed
-- from the event's own date so it works for any future event.
--
--   free  tickets (price_zar = 0): sale_end   = event day 13:00
--   paid  tickets (price_zar > 0): sale_start = event day 13:00
--                                  sale_end   = next day  04:00
--
-- Pass different hours if an event runs to a different rhythm.

CREATE OR REPLACE FUNCTION public.set_default_ticket_windows(
  p_event_id uuid,
  p_door_open_hour integer DEFAULT 13,
  p_close_hour integer DEFAULT 4
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_day date;
  v_open timestamptz;
  v_close timestamptz;
  v_count integer;
BEGIN
  SELECT (date AT TIME ZONE 'Africa/Johannesburg')::date
    INTO v_day
    FROM events WHERE id = p_event_id;

  IF v_day IS NULL THEN
    RAISE EXCEPTION 'No event with id %', p_event_id;
  END IF;

  v_open  := ((v_day     + make_time(p_door_open_hour, 0, 0)) AT TIME ZONE 'Africa/Johannesburg');
  v_close := ((v_day + 1 + make_time(p_close_hour,     0, 0)) AT TIME ZONE 'Africa/Johannesburg');

  UPDATE tickets
     SET sale_start = NULL,
         sale_end   = v_open
   WHERE event_id = p_event_id AND price_zar = 0;

  UPDATE tickets
     SET sale_start = v_open,
         sale_end   = v_close
   WHERE event_id = p_event_id AND price_zar > 0;

  SELECT count(*) INTO v_count FROM tickets WHERE event_id = p_event_id;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_default_ticket_windows(uuid, integer, integer) FROM public, anon, authenticated;


-- ── 3. Apply to the 25 July event ───────────────────────────
-- Free entrance closes at 13:00, door admission opens at 13:00 and
-- closes at 04:00 the next morning. Door admission goes back to
-- is_active = true, because the window now does the gating instead.
--
-- The duplicate "Door Admission" at R100 is deliberately left inactive.
-- Two door tickets on one event is what let a guest pay R50 for a free
-- event in the first place. Decide which price is right, then delete
-- the other rather than leaving both.

UPDATE tickets t
   SET is_active = true
  FROM events e
 WHERE e.id = t.event_id
   AND e.slug = 'road-to-spring-cleaning'
   AND t.name = 'Door admission';

SELECT public.set_default_ticket_windows(id)
  FROM events WHERE slug = 'road-to-spring-cleaning';


-- ── 4. Check ────────────────────────────────────────────────
SELECT
  t.name,
  t.price_zar,
  t.is_active,
  to_char(t.sale_start AT TIME ZONE 'Africa/Johannesburg', 'DD Mon HH24:MI') AS opens_sast,
  to_char(t.sale_end   AT TIME ZONE 'Africa/Johannesburg', 'DD Mon HH24:MI') AS closes_sast,
  (t.is_active
    AND (t.sale_start IS NULL OR t.sale_start <= now())
    AND (t.sale_end   IS NULL OR t.sale_end   >  now())) AS on_sale_now
FROM tickets t
JOIN events e ON e.id = t.event_id
WHERE e.slug = 'road-to-spring-cleaning'
ORDER BY t.price_zar;
