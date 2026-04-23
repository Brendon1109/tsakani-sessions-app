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

When you add a **new** migration file, append it to the table above with its
order number, and note what existing state it assumes.

## Environment Variables

### Required (app won't work without these)

| Variable | Where to find | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings → API | Database + auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings → API (anon public) | Client queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API (service role secret) | Admin operations |

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
  orders (>48h) and releases reserved tickets.

## Video pipeline

1. Admin queues a job via `/admin/video`
2. Run `python scripts/video_worker.py` on a machine with FFmpeg + your footage
3. Worker picks up queued jobs, runs `video_merge.py`, reports status back
