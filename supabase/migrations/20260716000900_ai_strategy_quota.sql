-- AI matchup strategy quota and cache.
-- Quota is counted per Malaysia calendar day. Cache is shared because inputs are public part IDs.

create table if not exists public.ai_strategy_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  quota_date date not null,
  used int not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, quota_date)
);

create table if not exists public.ai_strategy_cache (
  matchup_hash text primary key check (matchup_hash ~ '^[a-f0-9]{64}$'),
  matchup jsonb not null,
  strategy_en jsonb not null,
  strategy_zh jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

alter table public.ai_strategy_usage enable row level security;
alter table public.ai_strategy_cache enable row level security;

create index if not exists ai_strategy_usage_user_date_idx
  on public.ai_strategy_usage (user_id, quota_date desc);

create index if not exists ai_strategy_cache_expires_idx
  on public.ai_strategy_cache (expires_at);

revoke all on public.ai_strategy_usage from anon, authenticated;
revoke all on public.ai_strategy_cache from anon, authenticated;

create or replace function public.ai_strategy_quota_payload(
  p_user_id uuid,
  p_limit int default 3
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  used_value int := 0;
  reset_at timestamptz := ((today + 1)::timestamp at time zone 'Asia/Kuala_Lumpur');
begin
  if p_limit < 1 then
    raise exception 'invalid_limit';
  end if;

  select coalesce(used, 0) into used_value
  from public.ai_strategy_usage
  where user_id = p_user_id and quota_date = today;

  return jsonb_build_object(
    'limit', p_limit,
    'used', least(coalesce(used_value, 0), p_limit),
    'remaining', greatest(p_limit - coalesce(used_value, 0), 0),
    'resetAt', reset_at
  );
end $$;

create or replace function public.consume_ai_strategy_quota(
  p_user_id uuid,
  p_limit int default 3
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  used_value int;
  reset_at timestamptz := ((today + 1)::timestamp at time zone 'Asia/Kuala_Lumpur');
begin
  if p_limit < 1 then
    raise exception 'invalid_limit';
  end if;

  insert into public.ai_strategy_usage (user_id, quota_date, used, updated_at)
  values (p_user_id, today, 1, now())
  on conflict (user_id, quota_date) do update
    set used = public.ai_strategy_usage.used + 1,
        updated_at = now()
    where public.ai_strategy_usage.used < p_limit
  returning used into used_value;

  if used_value is null then
    select coalesce(used, 0) into used_value
    from public.ai_strategy_usage
    where user_id = p_user_id and quota_date = today;

    return jsonb_build_object(
      'allowed', false,
      'limit', p_limit,
      'used', least(coalesce(used_value, 0), p_limit),
      'remaining', 0,
      'resetAt', reset_at
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'limit', p_limit,
    'used', least(used_value, p_limit),
    'remaining', greatest(p_limit - used_value, 0),
    'resetAt', reset_at
  );
end $$;

create or replace function public.refund_ai_strategy_quota(
  p_user_id uuid,
  p_limit int default 3
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  used_value int := 0;
begin
  update public.ai_strategy_usage
  set used = greatest(used - 1, 0),
      updated_at = now()
  where user_id = p_user_id and quota_date = today
  returning used into used_value;

  return public.ai_strategy_quota_payload(p_user_id, p_limit);
end $$;

revoke execute on function public.ai_strategy_quota_payload(uuid, int) from public;
revoke execute on function public.consume_ai_strategy_quota(uuid, int) from public;
revoke execute on function public.refund_ai_strategy_quota(uuid, int) from public;

grant execute on function public.ai_strategy_quota_payload(uuid, int) to service_role;
grant execute on function public.consume_ai_strategy_quota(uuid, int) to service_role;
grant execute on function public.refund_ai_strategy_quota(uuid, int) to service_role;
