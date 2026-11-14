-- Outreach MCP: local seed data. Runs after migrations on `npx supabase db reset`.
-- All phone numbers use 555-0100 to 555-0199, which are reserved for fiction.

-- Staging table: one row per person, with the tags they belong to.
create temporary table seed_people (
  first_name text,
  last_name  text,
  phone      text,
  tz         text,
  tag_names  text[]
);

insert into seed_people (first_name, last_name, phone, tz, tag_names) values
  ('Maya',    'Okafor',     '+13125550101', 'America/Chicago',     array['volunteers', 'members']),
  ('Daniel',  'Reyes',      '+12125550102', 'America/New_York',    array['donors']),
  ('Priya',   'Raman',      '+14155550103', 'America/Los_Angeles', array['volunteers']),
  ('Samuel',  'Whitlock',   '+13035550104', 'America/Denver',      array['members']),
  ('Grace',   'Liang',      '+16025550105', 'America/Phoenix',     array['volunteers', 'donors']),
  ('Marcus',  'Bell',       '+12065550106', 'America/Los_Angeles', array['members']),
  ('Elena',   'Vasquez',    '+16175550107', 'America/New_York',    array['volunteers']),
  ('Theo',    'Nakamura',   '+14045550108', null,                  array['donors']),
  ('Hannah',  'Brooks',     '+15125550109', 'America/Chicago',     array['volunteers', 'members']),
  ('Omar',    'Haddad',     '+19075550110', 'America/Anchorage',   array['members']),
  ('Lucy',    'Fairbanks',  '+18085550111', 'Pacific/Honolulu',    array['donors']),
  ('Jonah',   'Pierce',     '+13125550112', 'America/Chicago',     array['volunteers']),
  ('Rosa',    'Delgado',    '+12125550113', 'America/New_York',    array['members', 'donors']),
  ('Ivan',    'Petrov',     '+14155550114', null,                  array['volunteers']),
  ('Amara',   'Nwosu',      '+13035550115', 'America/Denver',      array['volunteers']),
  ('Felix',   'Moreau',     '+16175550116', 'America/New_York',    array['donors']),
  ('Nadia',   'Karim',      '+14045550117', 'America/New_York',    array['members']),
  ('Caleb',   'Turner',     '+15125550118', null,                  array['members']),
  ('Sofia',   'Lindqvist',  '+12065550119', 'America/Los_Angeles', array['volunteers', 'donors']),
  (null,      'Adeyemi',    '+16025550120', 'America/Phoenix',     array['volunteers']),
  ('Wesley',  'Grant',      '+13125550121', 'America/Chicago',     array['donors']),
  ('Ines',    'Carvalho',   '+12125550122', 'America/New_York',    array['members']),
  ('Ruth',    'Abernathy',  '+14155550123', 'America/Los_Angeles', array['volunteers']),
  ('Kai',     'Mahoe',      '+18085550124', 'Pacific/Honolulu',    array['members']),
  ('Leo',     'Brennan',    '+16175550125', 'America/New_York',    array['donors']);

-- Contacts
insert into public.contacts (first_name, last_name, phone_e164, timezone, source)
select first_name, last_name, phone, tz, 'seed'
from seed_people;

-- Tags
insert into public.tags (name) values ('volunteers'), ('donors'), ('members');

-- Contact <-> tag links: unnest turns each person's tag array into rows.
insert into public.contact_tags (contact_id, tag_id)
select c.id, t.id
from seed_people p
join public.contacts c on c.phone_e164 = p.phone
cross join lateral unnest(p.tag_names) as tag_name
join public.tags t on t.name = tag_name;

-- Consent: everyone opted in 30 days ago, except two with no consent record.
insert into public.consent_events (contact_id, type, channel, received_at)
select c.id, 'opt_in'::public.consent_type, 'manual'::public.consent_channel,
       now() - interval '30 days'
from public.contacts c
where c.phone_e164 not in ('+18085550124', '+16175550125');

-- Two contacts later texted an opt-out keyword. Their latest event wins.
insert into public.consent_events (contact_id, type, channel, raw_body, received_at)
select c.id, 'opt_out'::public.consent_type, 'sms_keyword'::public.consent_channel,
       v.raw_body, now() - interval '3 days'
from (values ('+13125550112', 'STOP'),
             ('+16175550116', 'unsubscribe')) as v (phone, raw_body)
join public.contacts c on c.phone_e164 = v.phone;

drop table seed_people;
