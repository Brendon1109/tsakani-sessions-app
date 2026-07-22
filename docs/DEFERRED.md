# Deferred Work

Things the ship-readiness audit flagged as non-blockers. Picking any of
these up is safe once the app is live — they're improvements, not fixes
for broken behaviour.

---

## 1. Admin management UI

**Status**: currently hardcoded in SQL.

**Today**: `supabase/admin_setup.sql` contains a hardcoded list of email
addresses that get promoted to `role = 'admin'` by the
`promote_admins_on_signup` trigger whenever a matching email signs up.
Adding or removing an admin means editing that SQL file and re-running it
against the production database.

**What to build**:
- A new page `app/admin/admins/page.tsx` listing all rows in `profiles` where
  `role = 'admin'`.
- A form to promote any existing signed-up user to admin (by email lookup).
- A "revoke" button that sets `role = 'user'`.
- Guard with the existing middleware admin-only check.
- Remove the hardcoded email list from `admin_setup.sql` once the UI is in
  place (or keep it as a bootstrapping list for the very first admin).

**Why deferred**: three admins at launch, all already hardcoded — works for
now. Friction only shows up when adding the 4th admin.

---

## 2. Remove unused payment method options

**Status**: schema declares options that aren't wired up.

**Today**: `lib/types.ts` declares `payment_method: 'whatsapp' | 'yoco' | 'payfast'`,
but only `whatsapp` is ever set in code. The orders and ticket_orders tables
likely have a CHECK constraint matching this union, so removing them
requires a DB migration too.

**What to do (pick one)**:
- **Simplify**: drop `'yoco'` and `'payfast'` from the type + any DB CHECK
  constraints. Creates a clean state.
- **Implement**: wire up Yoco and/or Payfast checkout as real paid options.
  Requires merchant accounts, webhook handling, signature verification.

**Why deferred**: WhatsApp payment works for current volume. Gateway
integration is a feature addition, not a launch blocker.

---

## 3. Real test coverage

**Status**: `__tests__/` files are scaffolding with no meaningful assertions.

**Today**: CI runs `vitest` and passes because the test files don't assert
anything. A broken order flow or auth redirect would not be caught.

**What to write (in priority order)**:
1. **Order flow integration test** — POST `/api/orders` with valid + invalid
   product IDs, mismatched sizes/colors, tampered prices. Verify the server
   always uses DB-side prices.
2. **Ticket reservation race test** — two concurrent `reserve_tickets` calls
   that together exceed inventory. The DB function must reject the second.
3. **Newsletter consent test** — POST `/api/newsletter` with no consent
   flags (expect 400), with one flag (expect 200 + stored consent), with
   both flags.
4. **Admin middleware test** — non-admin user hitting `/admin` redirects to
   `/`. Unauthenticated user hitting `/admin` redirects to `/auth/signin`.
5. **Cron auth test** — `/api/cron/cleanup-orders` rejects requests without
   the right `Authorization: Bearer` header in production.

Use a dedicated Supabase test project (or local Supabase) so tests run
against a real database with RLS enabled.

**Why deferred**: launch scope. Worth doing before the second round of
feature work starts, so regressions don't slip in.

---

## Audit items already addressed

Kept here for reference so anyone reviewing this doc knows what's done:

- ~~Legal pages (privacy, terms, refund) missing~~ → added `app/privacy`, `app/terms`, `app/refund-policy`.
- ~~Resend API key silently fails~~ → `lib/email.ts` now logs a one-time warning when the key is missing.
- ~~Cron endpoint fails open without `CRON_SECRET`~~ → rejects unauthenticated requests in production.
- ~~SQL migration order undocumented~~ → `docs/SETUP.md` now has a "Database setup" table.
- ~~Newsletter form missing on site~~ → `components/NewsletterForm.tsx` in the footer, with granular consent checkboxes + privacy policy link.
- ~~WhatsApp checkout loses context~~ → `/shop/success` page shows order ID + deliberate "Send via WhatsApp" button.
- ~~Ticket buyers got no confirmation, only a redirect into a WhatsApp chat with a number they'd never seen~~ → `supabase/ticket_confirmation.sql` + `components/TicketCheckout.tsx`: on-page confirmation with order number and QR, a confirmation email, and `/ticket/[code]` as the buyer's own copy. WhatsApp is an optional button, never a redirect.
- ~~No way to unsubscribe from the newsletter~~ → per-subscriber `unsubscribe_token`, `/unsubscribe`, and RFC 8058 one-click via `List-Unsubscribe`. `subscribe_newsletter` returns a token only for an address that wasn't already subscribed, so it can't be used to harvest someone else's.
