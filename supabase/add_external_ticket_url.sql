-- Per-event external ticket link.
--
-- When set, the public event page sends buyers to this URL (for example a
-- FestFlow checkout) instead of the native WhatsApp reservation flow. When
-- null, nothing changes and the WhatsApp flow is used as before.
alter table events add column if not exists external_ticket_url text;
