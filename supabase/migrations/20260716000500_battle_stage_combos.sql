-- Battle Stage: user deck slots plus combo snapshots on reported matches.

alter table public.matches
  add column if not exists p1_combo jsonb
    check (p1_combo is null or jsonb_typeof(p1_combo) = 'object'),
  add column if not exists p2_combo jsonb
    check (p2_combo is null or jsonb_typeof(p2_combo) = 'object');

create table if not exists public.user_beyblades (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles (id) on delete cascade,
  slot int not null check (slot between 1 and 3),
  combo jsonb not null check (jsonb_typeof(combo) = 'object' and octet_length(combo::text) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, slot)
);

alter table public.user_beyblades enable row level security;

drop policy if exists "user beyblades are public" on public.user_beyblades;
create policy "user beyblades are public" on public.user_beyblades
  for select using (true);

drop policy if exists "insert own user beyblades" on public.user_beyblades;
create policy "insert own user beyblades" on public.user_beyblades
  for insert with check (auth.uid() = owner);

drop policy if exists "update own user beyblades" on public.user_beyblades;
create policy "update own user beyblades" on public.user_beyblades
  for update using (auth.uid() = owner)
  with check (auth.uid() = owner);

drop policy if exists "delete own user beyblades" on public.user_beyblades;
create policy "delete own user beyblades" on public.user_beyblades
  for delete using (auth.uid() = owner);

grant select on public.user_beyblades to anon, authenticated;
grant insert (owner, slot, combo) on public.user_beyblades to authenticated;
grant update (slot, combo, updated_at) on public.user_beyblades to authenticated;
grant delete on public.user_beyblades to authenticated;

create or replace function public.touch_user_beyblades_updated_at()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists touch_user_beyblades_updated_at on public.user_beyblades;
create trigger touch_user_beyblades_updated_at
  before update on public.user_beyblades
  for each row execute function public.touch_user_beyblades_updated_at();

-- Combo-aware result reporting. Keeps the original report_match(uuid,jsonb,int,int)
-- function intact so older clients can continue to submit plain score records.
create or replace function public.report_match_with_combos(
  cid uuid,
  p_rounds jsonb,
  s_host int,
  s_opp int,
  combo_host jsonb,
  combo_opp jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c challenges;
  mid uuid;
  r jsonb;
  side int;
  finish text;
  pts int;
  calc_host int := 0;
  calc_opp int := 0;
begin
  select * into c from challenges where id = cid for update;
  if c is null then raise exception 'challenge_not_found'; end if;
  if c.status <> 'accepted' then raise exception 'challenge_not_accepted'; end if;
  if auth.uid() <> c.host and auth.uid() <> c.opponent then
    raise exception 'not_a_participant';
  end if;

  if combo_host is not null and (
    jsonb_typeof(combo_host) <> 'object' or octet_length(combo_host::text) > 4096
  ) then
    raise exception 'invalid_combo';
  end if;
  if combo_opp is not null and (
    jsonb_typeof(combo_opp) <> 'object' or octet_length(combo_opp::text) > 4096
  ) then
    raise exception 'invalid_combo';
  end if;

  p_rounds := coalesce(p_rounds, '[]'::jsonb);
  if jsonb_typeof(p_rounds) <> 'array' then raise exception 'invalid_rounds'; end if;

  for r in select value from jsonb_array_elements(p_rounds) loop
    if calc_host >= c.target_score or calc_opp >= c.target_score then
      raise exception 'invalid_rounds';
    end if;
    if coalesce(r->>'side', '') not in ('1', '2') then
      raise exception 'invalid_rounds';
    end if;
    if coalesce(r->>'pts', '') !~ '^[0-9]+$' then
      raise exception 'invalid_rounds';
    end if;

    side := (r->>'side')::int;
    finish := r->>'finish';
    pts := (r->>'pts')::int;

    if not (
      (finish = 'spin' and pts = 1)
      or (finish in ('over', 'burst') and pts = 2)
      or (finish = 'xtreme' and pts = 3)
    ) then
      raise exception 'invalid_rounds';
    end if;

    if side = 1 then
      calc_host := calc_host + pts;
    else
      calc_opp := calc_opp + pts;
    end if;
  end loop;

  if calc_host <> s_host or calc_opp <> s_opp then raise exception 'invalid_score'; end if;
  if s_host = s_opp then raise exception 'no_draws'; end if;
  if s_host < 0 or s_opp < 0 or greatest(s_host, s_opp) < c.target_score then
    raise exception 'invalid_score';
  end if;
  if least(s_host, s_opp) >= c.target_score or greatest(s_host, s_opp) > c.target_score + 2 then
    raise exception 'invalid_score';
  end if;

  insert into matches (
    challenge_id,
    p1,
    p2,
    p1_score,
    p2_score,
    rounds,
    winner,
    wager,
    reported_by,
    format,
    team_size,
    target_score,
    p1_combo,
    p2_combo
  )
  values (
    cid,
    c.host,
    c.opponent,
    s_host,
    s_opp,
    p_rounds,
    case when s_host > s_opp then c.host else c.opponent end,
    c.wager,
    auth.uid(),
    c.format,
    c.team_size,
    c.target_score,
    combo_host,
    combo_opp
  )
  returning id into mid;

  update challenges set status = 'completed' where id = cid;
  return mid;
end $$;

revoke execute on function public.report_match_with_combos(uuid, jsonb, int, int, jsonb, jsonb) from public;
revoke execute on function public.report_match_with_combos(uuid, jsonb, int, int, jsonb, jsonb) from anon;
grant execute on function public.report_match_with_combos(uuid, jsonb, int, int, jsonb, jsonb) to authenticated;

create index if not exists user_beyblades_owner_slot_idx
  on public.user_beyblades (owner, slot);
