-- Newsletter consent columns (POPIA: granular, recorded consent)
-- Adds per-topic opt-in flags and a timestamp so we can prove when consent
-- was given. Existing rows default to false for both topics — those
-- subscribers will need to re-opt-in via the form.

alter table newsletter_subscribers
  add column if not exists consent_events boolean not null default false,
  add column if not exists consent_merch boolean not null default false,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_ip text;

create index if not exists newsletter_subscribers_consent_events_idx
  on newsletter_subscribers(consent_events) where consent_events = true;

create index if not exists newsletter_subscribers_consent_merch_idx
  on newsletter_subscribers(consent_merch) where consent_merch = true;
