-- One row per contact with its current consent status, for search and lookup.
-- contact_consent_status is a view with no foreign keys, so PostgREST cannot
-- join it to contacts. This view exposes contacts.id as id, which lets
-- PostgREST follow contact_tags.contact_id from here to tags.
create view public.contacts_with_consent
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
  s.is_opted_out
from public.contacts c
join public.contact_consent_status s on s.contact_id = c.id;
