# Tsakani Sessions — Setup Guide

## Database setup (Supabase)

There is no migration tooling. Run these SQL files in the Supabase SQL Editor
**in this exact order** for a fresh project. All files are idempotent (use
`IF NOT EXISTS` / `CREATE OR REPLACE`), so re-running a file you've already
applied is safe.

| Order | File | What it does |
|---|---|---|
| 1 | `supabase/schema.sql` | Core tables, RLS enablement, baseline policies, `handle_new_user` trigger. |
| 2 | `supabase/critical_fixes.sql` | `reserve_tickets` / `release_tickets` RPCs for atomic inventory, plus other post-launch fixes. |
| 3 | `supabase/fix_rls_recursion.sql` | Fixes infinite-recursion bug in the "admins read all profiles" policy. Must run after schema.sql. |
| 4 | `supabase/featured_posts.sql` | Optional — adds the `featured_posts` table used by the homepage social feed. |
| 5 | `supabase/admin_setup.sql` | `promote_admins_on_signup` trigger. Edit the hardcoded email list before running to match your admins. |
| 6 | `supabase/newsletter_consent.sql` | Adds granular-consent columns (`consent_events`, `consent_merch`, `consent_at`, `consent_ip`) to `newsletter_subscribers` for POPIA compliance. |
| 7 | `supabase/fix_role_escalation.sql` | Column-level privileges on `profiles` so users can't grant themselves admin by writing `role` (or `email`, which the promote trigger matches on). Must run after schema.sql and admin_setup.sql. |
| 8 | `supabase/subscribe_newsletter_fn.sql` | `subscribe_newsletter` SECURITY DEFINER function. Anon holds only an INSERT policy, so a direct upsert is refused by RLS — this owns the one narrow write. Must run after newsletter_consent.sql. |
| 9 | `supabase/create_ticket_order_fn.sql` | `create_ticket_order` SECURITY DEFINER function. Reserves seats and writes the order in one transaction, and returns the new order despite RLS hiding it from anon. |
| 10 | `supabase/ticket_sale_windows.sql` | Makes `sale_start` / `sale_end` real — `reserve_tickets` enforces the window so a ticket opens and closes on its own. |
| 11 | `supabase/add_external_ticket_url.sql` | Adds `events.external_ticket_url` for per-event external checkout (e.g. FestFlow). |
| 12 | `supabase/ticket_confirmation.sql` | **Ticket confirmations.** Adds `events.payment_url` / `payment_note`, the generated `ticket_orders.order_ref`, and `newsletter_subscribers.unsubscribe_token`. Replaces `create_ticket_order` (now returns event + payment details, and honours the sale window) and `subscribe_newsletter` (now returns the unsubscribe token). Adds `get_ticket_order` and `unsubscribe_newsletter`. Must run after 8, 9, 10 and 11. |
| 13 | `supabase/merch_store.sql` | **The merch store.** Widens `products.category` to cover hoodies and hats, adds `images`, `sort_order`, `in_stock`; allows `eft` as an order payment method; adds the admin-only `store_settings` table holding the EFT bank details. Adds `create_merch_order` (the merch equivalent of 9, and the fix for merch checkout failing on RLS at the read-back), `eft_available`, and `cleanup_stale_merch_orders`. Must run after schema.sql. |
| 14 | `supabase/lock_down_inventory_functions.sql` | **Closes three functions anyone with the anon key could call.** `reserve_tickets` becomes service role only (nothing in the app calls it), `release_tickets` refuses anyone who is not an admin or the service role and any quantity below 1, and `cleanup_stale_merch_orders` becomes service role only with a 48 hour floor. Run it after the deploy that moves the cleanup cron onto the service role key, and again if 2, 10 or 13 is ever re-run. |

Optional, order-independent once `schema.sql` has run: `analytics_events.sql`
(first-party analytics), `booking_enquiries.sql` (the /services form),
`storage_policies.sql` (bucket policies), `add_gallery_drive_url.sql`.

When you add a **new** migration file, append it to the table above with its
order number, and note what existing state it assumes.

## Environment Variables

### Required (app won't work without these)

| Variable | Where to find | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings → API | Database + auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings → API (anon public) | Client queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API (service role secret) | Server only. The cleanup cron uses it for `cleanup_stale_merch_orders`, and `scripts/signups.mjs` reads it locally. Never used in a route a visitor can reach |

### Optional (app works without, but features degrade gracefully)

| Variable | Purpose | Where to get |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Used in sitemap/SEO | Your deployed URL |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp checkout number | Your WhatsApp (country code, no +) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | CAPTCHA site key | Cloudflare dashboard → Turnstile |
| `TURNSTILE_SECRET_KEY` | CAPTCHA secret key | Same as above |
| `RESEND_API_KEY` | Transactional emails | resend.com |
| `RESEND_FROM_EMAIL` | From address | `Tsakani Sessions <hello@yourdomain>` |
| `ADMIN_EMAIL` | Where admin alerts go | Your email |
| `NEXT_PUBLIC_SENTRY_DSN` | Error tracking | sentry.io |
| `CRON_SECRET` | Protects cron endpoints | Generate with `openssl rand -hex 32` |
| `WORKER_SECRET` | Auth for video worker | Generate with `openssl rand -hex 32` |

### Set via Vercel CLI

```bash
echo "value" | npx vercel env add VARNAME production
```

## Google OAuth (Supabase Auth)

1. Google Cloud Console → OAuth consent screen (External)
2. Credentials → Create OAuth 2.0 Client (Web)
3. Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
4. Supabase Dashboard → Authentication → Providers → Google → paste Client ID + Secret

## Admin roles

Admin emails are auto-promoted via the `promote_admins_on_signup` trigger in
`supabase/admin_setup.sql`. To add a new admin, update the email list in that
file and re-run it.

## Cron jobs

Configured in `vercel.json`:
- `/api/cron/cleanup-orders` runs daily at 03:00 UTC — cancels stale pending
  orders (>48h) and releases reserved tickets. The merch half runs on the
  service role key. The ticket half still runs on the anon key, which RLS
  keeps from seeing any ticket orders, so it does nothing; switching it on
  would auto cancel unpaid EFT ticket orders and is a business decision.

## Video pipeline

1. Admin queues a job via `/admin/video`
2. Run `python scripts/video_worker.py` on a machine with FFmpeg + your footage
3. Worker picks up queued jobs, runs `video_merge.py`, reports status back
