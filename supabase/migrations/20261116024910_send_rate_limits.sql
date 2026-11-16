-- Rate limit for the send tools (M4): a counter per API key per time window.
--
-- take_send_quota adds one to the key's counter for the current window and
-- says whether the call is allowed. It's one statement, so two calls at the
-- same moment can't both take the last slot.

create table public.send_rate_limits (
  api_key_id   uuid not null references public.api_keys (id) on delete cascade,
  window_start timestamptz not null,
  used         integer not null,
  primary key (api_key_id, window_start)
);

alter table public.send_rate_limits enable row level security;

create function public.take_send_quota(
  p_api_key_id     uuid,
  p_limit          integer,
  p_window_seconds integer
)
returns table (allowed boolean, used integer, resets_at timestamptz)
language plpgsql
set search_path = ''
as $$
declare
  v_window   interval    := make_interval(secs => p_window_seconds);
  -- Round now() down to the start of its window, e.g. 14:03:27 -> 14:03:00.
  v_start    timestamptz := date_bin(v_window, now(), timestamptz '2000-01-01');
  v_used     integer;
begin
  -- Old windows are never read again. Keep this key's rows small.
  delete from public.send_rate_limits r
  where r.api_key_id = p_api_key_id and r.window_start < v_start;

  -- First call in the window inserts 1. Later calls add 1, but only while
  -- under the limit. At the limit the update is skipped and nothing returns.
  insert into public.send_rate_limits as r (api_key_id, window_start, used)
  values (p_api_key_id, v_start, 1)
  on conflict (api_key_id, window_start)
  do update set used = r.used + 1
  where r.used < p_limit
  returning r.used into v_used;

  if v_used is null then
    return query select false, p_limit, v_start + v_window;
  else
    return query select true, v_used, v_start + v_window;
  end if;
end;
$$;

-- Supabase grants execute on new functions to anon and authenticated, which
-- would expose this through the public REST API. Only server code may call it.
revoke execute on function public.take_send_quota(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.take_send_quota(uuid, integer, integer) to service_role;
