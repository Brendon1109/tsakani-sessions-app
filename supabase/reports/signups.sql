-- ============================================================
-- SIGN-UPS & SUBSCRIPTIONS — read-only reports
-- ============================================================
-- HOW TO RUN (Supabase Dashboard → SQL Editor):
--   1. Set the row limit (top right) to "No limit" — it defaults to 100.
--   2. Highlight ONE query below and press Ctrl+Enter (Cmd+Enter on Mac).
--      Running the whole file only shows the last statement's result.
--   3. Use "Download CSV" above the results to open it in Excel.
--
-- Table names are schema-qualified (public.x) because the SQL Editor does
-- not always have "public" on its search path.
--
-- Every query here only READS. Nothing writes or deletes.
-- Results contain names, emails and phone numbers — personal data under
-- POPIA. Don't paste them into WhatsApp groups or forward them on.
--
-- All times are shown in SAST (Africa/Johannesburg).


-- ── 1. SUMMARY — the one-glance numbers ─────────────────────
SELECT
  (SELECT count(*) FROM public.newsletter_subscribers WHERE is_active) AS mailing_list,
  (SELECT count(*) FROM public.newsletter_subscribers WHERE is_active AND subscribed_at > now() - interval '7 days') AS new_subs_7d,
  (SELECT count(*) FROM public.ticket_orders) AS registrations,
  (SELECT coalesce(sum(quantity), 0) FROM public.ticket_orders) AS tickets_claimed,
  (SELECT count(*) FROM public.ticket_orders WHERE status = 'pending') AS pending_confirmation,
  (SELECT count(*) FROM public.ticket_orders WHERE status IN ('confirmed','used')) AS confirmed,
  (SELECT count(*) FROM auth.users) AS website_accounts;


-- ── 2. TICKET REGISTRATIONS — who's coming, with contact details ──
-- This is your guest list. Add  WHERE o.status = 'pending'  to see only
-- the ones you still need to confirm over WhatsApp.
SELECT
  to_char(o.created_at AT TIME ZONE 'Africa/Johannesburg', 'DD Mon HH24:MI') AS signed_up,
  o.buyer_name  AS name,
  o.buyer_email AS email,
  o.buyer_phone AS phone,
  o.quantity    AS tickets,
  o.status,
  t.name        AS ticket_type,
  'R' || t.price_zar AS price,
  trim(e.title) AS event,
  to_char(e.date AT TIME ZONE 'Africa/Johannesburg', 'DD Mon YYYY') AS event_date,
  CASE WHEN n.email IS NOT NULL THEN 'yes' ELSE 'no' END AS on_mailing_list
FROM public.ticket_orders o
LEFT JOIN public.tickets t ON t.id = o.ticket_id
LEFT JOIN public.events  e ON e.id = t.event_id
LEFT JOIN public.newsletter_subscribers n
       ON lower(n.email) = lower(o.buyer_email) AND n.is_active
ORDER BY o.created_at DESC;


-- ── 3. NEWSLETTER SUBSCRIBERS — the mailing list ──────────────
SELECT
  to_char(n.subscribed_at AT TIME ZONE 'Africa/Johannesburg', 'DD Mon YYYY HH24:MI') AS subscribed,
  n.email,
  n.source,
  CASE WHEN n.consent_events THEN 'yes' ELSE '-' END AS wants_events,
  CASE WHEN n.consent_merch  THEN 'yes' ELSE '-' END AS wants_merch,
  CASE WHEN n.is_active THEN 'active' ELSE 'unsubscribed' END AS state,
  CASE WHEN o.buyer_email IS NOT NULL THEN 'yes' ELSE 'no' END AS registered_for_event
FROM public.newsletter_subscribers n
LEFT JOIN LATERAL (
  SELECT buyer_email FROM public.ticket_orders
  WHERE lower(buyer_email) = lower(n.email) LIMIT 1
) o ON true
ORDER BY n.subscribed_at DESC;


-- ── 4. MAILING LIST FOR A SEND — event opt-ins only ──────────
-- Use this when blasting an event announcement: only people who ticked
-- "events". Swap consent_events for consent_merch for a merch drop.
SELECT email
FROM public.newsletter_subscribers
WHERE is_active AND consent_events
ORDER BY subscribed_at DESC;


-- ── 5. TICKET INVENTORY — what's selling, what's left ────────
SELECT
  trim(e.title) AS event,
  to_char(e.date AT TIME ZONE 'Africa/Johannesburg', 'DD Mon YYYY') AS event_date,
  e.status      AS event_status,
  t.name        AS ticket,
  'R' || t.price_zar AS price,
  t.quantity_sold  AS claimed,
  t.quantity_total AS capacity,
  t.quantity_total - t.quantity_sold AS remaining,
  t.is_active   AS on_sale
FROM public.tickets t
JOIN public.events e ON e.id = t.event_id
WHERE e.status <> 'past'
ORDER BY e.date, t.price_zar;


-- ── 6. SIGN-UPS PER DAY — is it growing? ─────────────────────
SELECT
  to_char(day, 'DD Mon YYYY') AS day,
  coalesce(subs, 0)  AS newsletter_signups,
  coalesce(regs, 0)  AS registrations,
  coalesce(tix, 0)   AS tickets_claimed
FROM generate_series(
       (current_date - interval '29 days')::date, current_date, interval '1 day'
     ) AS day
LEFT JOIN (
  SELECT (subscribed_at AT TIME ZONE 'Africa/Johannesburg')::date AS d, count(*) AS subs
  FROM public.newsletter_subscribers GROUP BY 1
) s ON s.d = day::date
LEFT JOIN (
  SELECT (created_at AT TIME ZONE 'Africa/Johannesburg')::date AS d,
         count(*) AS regs, sum(quantity) AS tix
  FROM public.ticket_orders GROUP BY 1
) r ON r.d = day::date
WHERE coalesce(subs, 0) + coalesce(regs, 0) > 0
ORDER BY day DESC;


-- ── 7. DUPLICATE / SUSPICIOUS REGISTRATIONS ─────────────────
-- Same email registering more than once for the same event, or unusually
-- large bookings worth a personal WhatsApp before the door.
SELECT
  o.buyer_email AS email,
  trim(e.title) AS event,
  count(*)      AS registrations,
  sum(o.quantity) AS total_tickets
FROM public.ticket_orders o
LEFT JOIN public.tickets t ON t.id = o.ticket_id
LEFT JOIN public.events  e ON e.id = t.event_id
GROUP BY o.buyer_email, trim(e.title)
HAVING count(*) > 1 OR sum(o.quantity) >= 5
ORDER BY total_tickets DESC;
