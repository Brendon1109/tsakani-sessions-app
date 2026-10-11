-- Scrub ticket codes out of analytics_events. 11 October 2026.
--
-- lib/analytics.ts sends location.pathname, and /api/track stored it as it
-- arrived, so every visit to /ticket/<code> wrote a working ticket code into
-- analytics_events. The code is the whole proof the ticket is yours, and the
-- admin analytics page lists paths. From the deploy that adds redactPath to
-- /api/track, new rows arrive clean. This file cleans the rows from before.
--
-- The rule is redactPath in app/api/e/core.ts, segment by segment and each
-- dot separated part of a segment: a capability prefix, a UUID, a run of 16 or
-- more hex characters, or 12 or more letters, digits, dashes and underscores
-- with at least one letter and one digit becomes [id]. Old and new rows then
-- read the same on the admin analytics page. It also catches event slugs with
-- a digit in them, which /api/track now does for new rows as well.
--
-- props needs no scrub: on 11 October no stored props value had the shape of
-- a code. Step 1 counts it again so that stays checked.
--
-- RUN AFTER the deploy that adds redactPath to /api/track, otherwise a visit
-- in between writes a fresh code. Step 1 is read only. Step 2 changes rows.
-- Safe to re-run: a clean row is left alone.
--
-- Run in the Supabase SQL Editor against gryssobrndqukwnjyosf.


-- ── Step 1. Read only. How many rows carry a code ───────────
-- On 11 October 2026: 48 rows would change, 40 of them /ticket/<code>, and
-- the other 8 the 1st birthday event's slug. 0 props values had a code shape.

with cleaned as (
  select a.id, a.path,
         (select string_agg(
                   case when seg <> '' and exists (
                          select 1 from unnest(string_to_array(seg, '.')) as q(part)
                           where part ~* '^(tab|vo|rsv|ord|tkt|inv|tok|key|sess|share|reset|confirm)[-_]'
                              or part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                              or part ~* '^[0-9a-f]{16,}$'
                              or part ~ '^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9_-]{12,}$')
                        then '[id]' else seg end,
                   '/' order by ord)
            from unnest(string_to_array(left(a.path, 512), '/')) with ordinality as t(seg, ord)) as new_path
    from public.analytics_events a
   where a.path is not null
)
select
  (select count(*) from cleaned where path is distinct from new_path)                         as rows_to_scrub,
  (select count(*) from cleaned where path ~ '^/ticket/' and path is distinct from new_path)  as ticket_code_rows,
  (select count(*) from public.analytics_events
    where props::text ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,}') as props_with_a_code;


-- ── Step 2. The scrub. Changes rows ─────────────────────────

with cleaned as (
  select a.id,
         (select string_agg(
                   case when seg <> '' and exists (
                          select 1 from unnest(string_to_array(seg, '.')) as q(part)
                           where part ~* '^(tab|vo|rsv|ord|tkt|inv|tok|key|sess|share|reset|confirm)[-_]'
                              or part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                              or part ~* '^[0-9a-f]{16,}$'
                              or part ~ '^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9_-]{12,}$')
                        then '[id]' else seg end,
                   '/' order by ord)
            from unnest(string_to_array(left(a.path, 512), '/')) with ordinality as t(seg, ord)) as new_path
    from public.analytics_events a
   where a.path is not null
)
update public.analytics_events a
   set path = c.new_path
  from cleaned c
 where a.id = c.id
   and a.path is distinct from c.new_path;
