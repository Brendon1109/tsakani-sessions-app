# Tsakani Sessions

The site for Tsakani Sessions, a Cape Town DJ and live music events brand: events and tickets, the DJ roster, the merch shop, photo galleries, bookings and the admin behind them. Live at https://tsakanisessions.co.za.

## Stack

- Next.js 16 (app router), React 19, TypeScript, Tailwind CSS
- Supabase for Postgres, Google sign in and photo storage. The schema is hand run SQL in `supabase/`
- Resend for email. Turnstile bot defence is wired into the forms but switched off until its keys are set
- Hosted on a Cloudflare Worker through OpenNext. Workers Builds deploys every merge to `master`, nothing is deployed from a laptop

## Commands

```bash
npm ci                 # install from the lock file, see the note below
npm run dev            # local dev server on http://localhost:3000
npm run lint
npm run type-check
npm test -- --run
npm run build
```

CI runs lint, type check, tests and build on every pull request, plus a Linux Worker build and smoke test.

Do not regenerate `package-lock.json` on Windows. npm there drops the `@emnapi/core` and `@emnapi/runtime` entries that Linux `npm ci` needs. After a dependency change, put those two entries back by hand and prove it with a CI run on the branch.

## Docs

- [docs/SETUP.md](docs/SETUP.md), the database files in run order, environment variables, sign in and admin roles
- [docs/CLOUDFLARE-MOVE.md](docs/CLOUDFLARE-MOVE.md), how hosting moved to the Cloudflare Worker, its settings and the checks to run
