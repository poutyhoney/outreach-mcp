-- Outreach MCP: initial schema (M1).
-- All access goes through server code using the service role key.
-- RLS is enabled on every table with NO policies, so anon/authenticated see nothing.

-- Enums -------------------------------------------------------------------
create type public.consent_type      as enum ('opt_in', 'opt_out');
create type public.consent_channel   as enum ('sms_keyword', 'import', 'manual');
create type public.message_direction as enum ('outbound', 'inbound');
create type public.broadcast_status  as enum ('draft', 'previewed', 'confirmed', 'sending', 'done');

-- Contacts and tags -------------------------------------------------------
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  first_name    text,
  last_name     text,
  phone_e164    text not null unique
                check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  timezone      text,          -- IANA name, e.g. America/Chicago; null = unknown
  source        text,
  custom_fields jsonb not null default '{}'::jsonb
);

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null unique
);

create table public.contact_tags (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  tag_id     uuid not null references public.tags (id) on delete cascade,
  unique (contact_id, tag_id)
);
create index contact_tags_tag_id_idx on public.contact_tags (tag_id);

-- Consent -----------------------------------------------------------------
create table public.consent_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  contact_id  uuid not null references public.contacts (id) on delete cascade,
  type        public.consent_type not null,
  channel     public.consent_channel not null,
  raw_body    text,
  received_at timestamptz not null default now()
);
create index consent_events_contact_latest_idx
  on public.consent_events (contact_id, received_at desc, created_at desc);

-- Current status = the latest event per contact. status is null when a
-- contact has no consent events at all.
create view public.contact_consent_status
with (security_invoker = true) as
select
  c.id                                       as contact_id,
  latest.type                                as status,
  latest.channel                             as channel,
  latest.received_at                         as status_at,
  coalesce(latest.type = 'opt_out', false)   as is_opted_out
from public.contacts c
left join lateral (
  select e.type, e.channel, e.received_at
  from public.consent_events e
  where e.contact_id = c.id
  order by e.received_at desc, e.created_at desc
  limit 1
) latest on true;

-- Broadcasts and messages -------------------------------------------------
create table public.broadcasts (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  name               text not null,
  body_template      text not null,
  tag_filter         text not null,   -- one tag name
  status             public.broadcast_status not null default 'draft',
  preview_count      integer,
  confirm_token_hash text,
  sent_count         integer not null default 0,
  skipped_count      integer not null default 0
);

create table public.messages (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  contact_id            uuid not null references public.contacts (id) on delete cascade,
  direction             public.message_direction not null,
  body                  text not null,
  provider              text not null,
  provider_message_id   text,
  status                text not null default 'queued',
  error_code            text,
  broadcast_id          uuid references public.broadcasts (id) on delete set null,
  sandbox_redirected_to text
);
create index messages_contact_created_idx on public.messages (contact_id, created_at desc);
create unique index messages_provider_id_idx
  on public.messages (provider, provider_message_id)
  where provider_message_id is not null;

-- API keys and audit log --------------------------------------------------
create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  key_hash     text not null unique,
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create table public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  api_key_id     uuid references public.api_keys (id) on delete set null,
  tool_name      text not null,
  args_redacted  jsonb not null default '{}'::jsonb,
  result_summary text,
  ok             boolean not null
);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- Row Level Security: on everywhere, no policies -------------------------
alter table public.contacts       enable row level security;
alter table public.tags           enable row level security;
alter table public.contact_tags   enable row level security;
alter table public.consent_events enable row level security;
alter table public.broadcasts     enable row level security;
alter table public.messages       enable row level security;
alter table public.api_keys       enable row level security;
alter table public.audit_log      enable row level security;