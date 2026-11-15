-- Create-or-update contacts in bulk. Used by upsert_contact (one row) and
-- import_contacts_csv (up to 5,000 rows).
--
-- Server code validates and normalizes every row first, and removes duplicate
-- phones. This function only writes. It runs as one transaction, so a real
-- import either fully lands or fully rolls back.
--
-- Each element of p_rows is an object like:
--   {"phone_e164": "+13125550101", "first_name": "Maya", "last_name": null,
--    "timezone": "America/Chicago", "custom_fields": {"ward": "3"},
--    "tags": ["volunteers"], "consent": "opt_in"}
-- A null or missing field means "not given": it keeps the stored value.
--
-- Returns a report: {"inserted", "updated", "consent_recorded", "opt_in_blocked"}.
-- With p_dry_run = true (the default) it returns the same report and writes nothing.
create function public.import_contacts(
  p_rows    jsonb,
  p_source  text,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_report jsonb;
begin
  -- Turn the JSON array into a table we can join against. The temp table lives
  -- until the transaction ends. Drop any copy left by an earlier call in the
  -- same transaction (the DB tests do this).
  drop table if exists pg_temp.incoming;
  create temporary table incoming on commit drop as
  select *
  from jsonb_to_recordset(p_rows) as r (
    phone_e164    text,
    first_name    text,
    last_name     text,
    timezone      text,
    custom_fields jsonb,
    tags          text[],
    consent       public.consent_type
  );

  -- The report, computed before any write so a dry run and a real run agree.
  -- Consent rules: record an event only when it changes the contact's status,
  -- and never let an import opt back in a contact who is opted out.
  select jsonb_build_object(
    'inserted', count(*) filter (where c.id is null),
    'updated',  count(*) filter (where c.id is not null),
    'consent_recorded', count(*) filter (
      where i.consent is not null
        and s.status is distinct from i.consent
        and not (i.consent = 'opt_in' and coalesce(s.is_opted_out, false))
    ),
    'opt_in_blocked', coalesce(
      jsonb_agg(i.phone_e164) filter (where i.consent = 'opt_in' and s.is_opted_out),
      '[]'::jsonb
    )
  )
  into v_report
  from incoming i
  left join public.contacts c on c.phone_e164 = i.phone_e164
  left join public.contact_consent_status s on s.contact_id = c.id;

  if p_dry_run then
    return v_report;
  end if;

  -- Contacts. "excluded" is the row we tried to insert. source is set only on
  -- insert, so a contact keeps the source it first came from.
  insert into public.contacts as c
    (phone_e164, first_name, last_name, timezone, source, custom_fields)
  select phone_e164, first_name, last_name, timezone, p_source,
         coalesce(custom_fields, '{}'::jsonb)
  from incoming
  on conflict (phone_e164) do update set
    first_name    = coalesce(excluded.first_name, c.first_name),
    last_name     = coalesce(excluded.last_name, c.last_name),
    timezone      = coalesce(excluded.timezone, c.timezone),
    custom_fields = c.custom_fields || excluded.custom_fields;

  -- Tags: create any new ones, then link them. Imports only add tags.
  insert into public.tags (name)
  select distinct unnest(tags) from incoming
  on conflict (name) do nothing;

  insert into public.contact_tags (contact_id, tag_id)
  select c.id, t.id
  from incoming i
  cross join lateral unnest(i.tags) as tag_name
  join public.contacts c on c.phone_e164 = i.phone_e164
  join public.tags t on t.name = tag_name
  on conflict (contact_id, tag_id) do nothing;

  -- Consent events, with the same rules as the report above.
  insert into public.consent_events (contact_id, type, channel)
  select c.id, i.consent, 'import'
  from incoming i
  join public.contacts c on c.phone_e164 = i.phone_e164
  left join public.contact_consent_status s on s.contact_id = c.id
  where i.consent is not null
    and s.status is distinct from i.consent
    and not (i.consent = 'opt_in' and coalesce(s.is_opted_out, false));

  return v_report;
end;
$$;

-- Supabase grants execute on new functions to anon and authenticated, which
-- would expose this through the public REST API. Only server code may call it.
revoke execute on function public.import_contacts(jsonb, text, boolean)
  from public, anon, authenticated;
grant execute on function public.import_contacts(jsonb, text, boolean) to service_role;
