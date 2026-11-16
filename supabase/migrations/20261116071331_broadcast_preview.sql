-- Broadcast preview (M4).

-- A fingerprint of the audience at preview time: who had the tag and their
-- consent. send_broadcast refuses when the audience no longer matches it.
alter table public.broadcasts add column audience_hash text;

-- Add custom_fields, so a broadcast can fill {{ward}}-style template fields.
-- "create or replace view" can only add columns at the end, so it goes last.
create or replace view public.contacts_with_consent
with (security_invoker = true) as
select
  c.id,
  c.created_at,
  c.first_name,
  c.last_name,
  c.phone_e164,
  c.timezone,
  s.status       as consent_status,
  s.channel      as consent_channel,
  s.status_at    as consent_status_at,
  s.is_opted_out,
  c.custom_fields
from public.contacts c
join public.contact_consent_status s on s.contact_id = c.id;
