# Moving tsakanisessions.co.za from Vercel to Cloudflare Workers

The cutover runbook. Written 24 September 2026, when the code was prepared (PR 6 for Next 16, PR 7 for the Worker wiring) and nothing had been deployed. Supabase stays exactly where it is. Only the hosting moves.

Until step 9, Vercel is production and every merge to `master` still deploys there. The Worker answers only on its workers.dev address, so every step before step 9 can be undone without anyone noticing.

## What the code already does

| Vercel feature | On the Worker | Where |
|---|---|---|
| Two crons at 03:00 UTC (cleanup-orders, finalize-events) | One Cron Trigger. `custom-worker.ts` calls both existing routes through the same fetch handler with `CRON_SECRET`. A failure is logged, emailed to `ADMIN_EMAIL` and thrown, so it shows as failed under the Worker's cron events | `wrangler.jsonc` triggers, `custom-worker.ts` |
| ISR (`revalidate` on six pages) | Not needed. Those pages always rendered per request, because the Supabase server client reads cookies. The dead exports are gone and there is no incremental cache. The YouTube feed keeps its own hour long copy per isolate | `open-next.config.ts`, `lib/youtube.ts` |
| Image optimisation | The Cloudflare Images binding `IMAGES` | `wrangler.jsonc` |
| IP and geo headers | `lib/request-meta.ts` trusts only the edge named in `HOST_PLATFORM`: `cf-connecting-ip` and `request.cf` on Cloudflare | `wrangler.jsonc` vars |
| Analytics adapter platform | `BZ_PLATFORM=cloudflare`, set next to `HOST_PLATFORM` so they cannot disagree | `wrangler.jsonc` vars |
| www to apex (two rules in `vercel.json`) | The same two rules in `next.config.mjs` `redirects()`, so no zone rule is needed | `next.config.mjs` |
| Edge middleware (Supabase session, the /admin gate) | Runs as OpenNext's edge middleware, unchanged. It stays `middleware.ts` on purpose, because `proxy.ts` would force Node middleware, which OpenNext still marks experimental | `middleware.ts` |
| Sentry | Dormant, `NEXT_PUBLIC_SENTRY_DSN` is unset. `instrumentation.ts` builds under OpenNext | |

### Size

The first Linux build on 24 September 2026 came to 13,964.62 KiB, 2,983.52 KiB gzipped, as `wrangler deploy --dry-run` reports it. Workers now cap only the uncompressed size, 64 MiB, and have no compressed limit. The one to watch is the 1 second startup limit, which a bigger bundle pushes against. The `Workers build` check prints the size on every pull request.

### Why no incremental cache

The brief allowed either OpenNext's R2 cache or dynamic pages. Dynamic won because it is already true: Next 14's prerender manifest and Next 16's route table both show `/`, `/events`, `/events/[slug]`, `/gallery`, `/gallery/[slug]` and `/shop` as rendered per request. An R2 cache would add a bucket, a deploy time upload and a queue, and change nothing a visitor sees. The two `revalidatePath("/shop")` calls in the admin routes stay and are harmless no-ops.

If a page ever needs ISR, it needs all of this, and none of it exists yet:

- An R2 bucket, for example `tsakani-sessions-app-opennext-cache`, bound as `NEXT_INC_CACHE_R2_BUCKET`, with `r2IncrementalCache` in `open-next.config.ts`.
- For time based revalidation, the Durable Object queue (`NEXT_CACHE_DO_QUEUE`, class `DOQueueHandler`, re-exported from `custom-worker.ts`, plus a migration) and the self reference service binding `WORKER_SELF_REFERENCE`.
- For `revalidatePath` to do anything, a tag cache, D1 `NEXT_TAG_CACHE_D1`.

### Why the Images binding, and its limit

Gallery uploads are compressed in the browser to at most 1 MB and 2048 px. With `unoptimized`, phones would download those originals on the gallery grid, and the CSP `img-src` would have to allow the YouTube, TikTok and Instagram image hosts. Without the binding, OpenNext passes the originals through the Worker.

Cloudflare Images gives every account 5,000 unique transformations a month free, the `format` counts once however many copies are served, and past the limit new transformations return error 9422 while cached ones keep working (images pricing page, updated 8 July 2026, read 24 September 2026). The site has about 60 images today at a few widths each, so it sits far below that. Check Images, Transformations in the dashboard after each big gallery upload. If it ever runs out, the fallback is `images.unoptimized: true` in `next.config.mjs` plus those hosts in `img-src`.

## Before anything else

1. **The account stays on Workers Free, watched.** Brendon's call on 24 September 2026, after Cloudflare's documented slack for occasional overruns and 30 days of NO-Q data on this account (2 refusals in 12,107 requests) made Free worth trying. Free allows 10 ms of CPU per request. After cutover, watch the Worker's `exceededResources` count (error 1102 for a visitor). If refusals show up steadily, upgrade to Workers Paid, USD 5 a month (Manage Account, Billing, Subscriptions).
2. **Export every DNS record** for tsakanisessions.co.za from the domains.co.za panel. Public DNS cannot list everything, and the list below is only what it shows.
3. **Bank every value** in the vault before it is needed, using the table below. Cloudflare secrets are write only, so bank each new one the moment it is created.

## Worker settings

### Build variables

**None are set in the dashboard.** The three public values live in the committed `.env.production` (PR 8), which Workers Builds reads like any build. Keep them bare there: PR 8 copied them from a `vercel env pull` with their `\n` escapes but without the quotes that make dotenv read one as a newline, so on the Worker every Supabase call went to `/n/rest/v1` and got 401, and the shop and gallery showed their empty states. PR 9 fixed it and `__tests__/envProduction.test.ts` now guards the file. Vercel never saw the problem, its own env vars win over the file. The table below is where each value comes from.

| Name | Value comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel production env (readable), or Supabase, project `gryssobrndqukwnjyosf`, Settings, API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same place. Supabase retires the legacy anon and service role keys at the end of 2026, so the key swap is due soon anyway |
| `NEXT_PUBLIC_SITE_URL` | `https://tsakanisessions.co.za`. Not set on Vercel today, which leaves ticket links relative. Set it here from the first build, so cutover never needs a rebuild |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Not set on Vercel today (open work). Only when Turnstile is switched on |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_ANALYTICS_DISABLED` | Not set on Vercel. The code defaults apply |

### Runtime secrets

Set each as a Secret (Worker, Settings, Variables and secrets, or `npx wrangler secret put NAME`). Use secrets rather than plain text variables, because a deploy replaces plain variables with what `wrangler.jsonc` lists, while secrets survive.

| Name | Value comes from | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel production (readable) or Supabase, Settings, API | The cleanup cron needs it since PR 5 |
| `CRON_SECRET` | Generate a new one, for example `openssl rand -hex 32` | Only the Worker's own scheduled handler sends it now. Bank it |
| `RESEND_API_KEY` | **Create a new key in Resend**, sending access for tsakanisessions.co.za | The Vercel copy is type sensitive and reads back empty. Do not revoke the old key until the Vercel project is retired, or Vercel's emails stop |
| `RESEND_FROM_EMAIL`, `REPLY_TO_EMAIL`, `ADMIN_EMAIL` | Vercel production (readable) | `ADMIN_EMAIL` also receives the cron failure alert |
| `BZ_SITE`, `BZ_SALT`, `BZ_INGEST_SECRET`, `BZ_ENDPOINT` | Vercel production (readable) | Same values as Vercel, so visitor counts stay continuous. The collector lives on a different Cloudflare account, so a plain fetch reaches it. If it ever moves onto this account, switch to a service binding, because a Worker cannot fetch another Worker's workers.dev address on the same account |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile | Only when Turnstile is switched on |
| `WORKER_SECRET` | The local video worker's config | Not set on Vercel. Only if the video pipeline talks to production |

**Never set** `HOST_PLATFORM` or `BZ_PLATFORM` in the dashboard. They live in `wrangler.jsonc`, and a secret with the same name makes the deploy fail.

## Order of steps

1. **Merge PR 6, then PR 7.** Vercel stays production and keeps working, both were checked on Vercel previews.
2. **Bank the values** above. New `CRON_SECRET`, new Resend key.
3. **Connect Workers Builds.** Dashboard, Workers and Pages, Create, Import a repository, pick `Brendon1109/tsakani-sessions-app` (the Cloudflare GitHub app has to be installed on the account once). The Worker name must be `tsakani-sessions-app`, the name in `wrangler.jsonc`.
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - Production branch: `master`. Root directory: the repo root.
   - Builds for non production branches: off. `preview_urls` is off, so they would upload versions nobody can open.
   - No build variables, see above.

   Workers Builds reads `.node-version` (22) and runs `npm ci`, which the `Workers build` GitHub check proves on every pull request. Never build or deploy from the laptop: OpenNext bakes any local `.env*` file into the bundle, and its bundle step fails on Windows.
4. **Set the runtime secrets**, then retry the latest build so a version carries them.
5. **Supabase**, Authentication, URL Configuration. Leave the Site URL as `https://tsakanisessions.co.za`. Add `https://tsakani-sessions-app.breazy.workers.dev/**` to the redirect URLs (confirm the workers.dev subdomain in the first deploy's output). Google's OAuth client needs nothing, because Google redirects to Supabase's own callback.
6. **Verify on workers.dev**, the checklist below.
7. **Create the zone.** Add `tsakanisessions.co.za` to the personal account on the Free plan. Compare the imported records against the panel export line by line, then set:
   - apex `A 76.76.21.21` and `www A 76.76.21.21`, DNS only, TTL 1 minute. These keep Vercel serving through the nameserver move.
   - apex `TXT google-site-verification=...`, copied exactly.
   - `_dmarc TXT v=DMARC1; p=none;`
   - `resend._domainkey TXT p=...`, the full DKIM key from the panel or the Resend dashboard.
   - `send MX 10 feedback-smtp.eu-west-1.amazonses.com`
   - `send TXT v=spf1 include:amazonses.com ~all`
   - Anything else the export shows. Public DNS showed no apex MX, no AAAA and no CAA on 24 September 2026.

   In the zone, switch on SSL/TLS, Edge Certificates, Always Use HTTPS. Check the zone's managed robots.txt and AI crawler setting stays off, so the zone does not prepend rules that contradict the app's own robots.
8. **Move the nameservers** at domains.co.za from the `tld-ns` servers to the two Cloudflare gives the zone. Wait until the zone shows Active. Nothing changes for visitors, Vercel still serves through the A records. Check Resend still shows the domain verified.
9. **Cut over.** Delete the apex and www A records, then straight away add both `tsakanisessions.co.za` and `www.tsakanisessions.co.za` as Custom Domains on the Worker (Settings, Domains and Routes). The gap is seconds. Then run the checklist again against the real domain.
10. **Put the routes in config** the same day, in a small PR, so `wrangler.jsonc` stays the source of truth:
    ```jsonc
    "routes": [
      { "pattern": "tsakanisessions.co.za", "custom_domain": true },
      { "pattern": "www.tsakanisessions.co.za", "custom_domain": true }
    ]
    ```
11. **Watch for a week.** The morning after, open the Worker's cron events and logs and confirm the 03:00 run passed. Vercel's crons keep running too until step 12. Both jobs are idempotent, so a double run is harmless.
12. **Retire Vercel after two quiet weeks.** Remove `vercel.json`, remove the domains from the Vercel project and delete it, revoke the old Resend key, and remove the workers.dev entry from Supabase if `workers_dev` is switched off.

## Checklist on the Worker

Run it at step 6 on workers.dev and again at step 9 on the real domain, with a cache buster, looking for something only the new build contains.

- `/`, `/events`, an event page, `/shop`, `/gallery`, `/services`, `/faq` answer 200 with live data (products and event titles, not empty states).
- `/events/no-such-event` is a 404. `/ticket/anything-wrong` shows "We can't find that ticket."
- `/admin` redirects to sign in. Sign in with Google on this host, and `/admin` then loads for an admin account.
- An image on `/gallery` loads through `/_next/image` and the response is WebP or AVIF, not the original JPEG.
- `https://www.tsakanisessions.co.za/shop` answers 308 to `https://tsakanisessions.co.za/shop` (step 9 only).
- The analytics collector records a view from a real browser.
- Logs show no errors on those requests.
- Optional, with Brendon's say: one real merch order, checked and deleted afterwards the way the 25 August test was.

## Rollback

Before step 9 there is nothing to roll back, Vercel is still serving.

After step 9, remove the two Custom Domains from the Worker and re-add the apex and www `A 76.76.21.21` records, DNS only. Vercel still holds both domains and serves again within the record TTL. Keep the Vercel project, its domains and its env vars untouched until step 12 for exactly this reason. Moving the nameservers back to domains.co.za is only needed if the zone itself is the problem.

## Known gaps

- The cron alert fires when a run fails. A run that never starts sends nothing. The next morning check in step 11 covers the first week.
- The account is on Workers Free (see Before anything else). A page that runs past its CPU allowance too often is refused with error 1102, so the `exceededResources` count is the number to watch in the first week.
- The rate limiter still writes to `rate_limits`, which has RLS on and no policy, so it has never limited anything. That is an existing bug, unchanged by the move.
