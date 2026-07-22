-- SPINDEX battle system: profiles, challenges, matches, star wagers.
-- Stars/wins/losses only ever change inside security-definer functions.

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-zA-Z0-9_]{3,20}$'),
  display_name text not null default '',
  city text,
  stars int not null default 5 check (stars >= 0),
  wins int not null default 0,
  losses int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are public" on public.profiles
  for select using (true);

create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Only cosmetic columns are user-updatable; stars/records move via functions.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, city) on public.profiles to authenticated;

-- Create a profile automatically on signup (handle comes from signup metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle, display_name, city)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'handle', ''), 'blader_' || substr(replace(new.id::text, '-', ''), 1, 10)),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), new.raw_user_meta_data->>'handle', 'Blader'),
    new.raw_user_meta_data->>'city'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ challenges (battle board) ============
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references public.profiles (id) on delete cascade,
  city text not null,
  venue text,
  battle_at timestamptz,
  wager int not null default 1 check (wager between 1 and 50),
  note text check (char_length(note) <= 280),
  status text not null default 'open' check (status in ('open', 'accepted', 'completed', 'cancelled')),
  opponent uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;

create policy "challenges are public" on public.challenges
  for select using (true);

create policy "post own challenge" on public.challenges
  for insert with check (auth.uid() = host);

create policy "host cancels own open challenge" on public.challenges
  for update using (auth.uid() = host and status = 'open')
  with check (status in ('open', 'cancelled'));

-- ============ matches (battle records) ============
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges (id) on delete set null,
  p1 uuid not null references public.profiles (id),  -- challenge host
  p2 uuid not null references public.profiles (id),  -- challenge opponent
  p1_score int not null check (p1_score >= 0),
  p2_score int not null check (p2_score >= 0),
  rounds jsonb not null default '[]',
  winner uuid not null references public.profiles (id),
  wager int not null,
  stars_moved int,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  reported_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.matches enable row level security;

create policy "matches are public" on public.matches
  for select using (true);
-- No insert/update policies: matches only move through the functions below.

-- ============ functions ============

-- Accept an open challenge (not your own; you must be able to cover the wager).
create or replace function public.accept_challenge(cid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare c challenges;
begin
  select * into c from challenges where id = cid for update;
  if c is null then raise exception 'challenge_not_found'; end if;
  if c.status <> 'open' then raise exception 'challenge_not_open'; end if;
  if c.host = auth.uid() then raise exception 'cannot_accept_own'; end if;
  if (select stars from profiles where id = auth.uid()) < c.wager then
    raise exception 'not_enough_stars';
  end if;
  update challenges set opponent = auth.uid(), status = 'accepted' where id = cid;
end $$;

-- Report the result of an accepted challenge (either participant).
create or replace function public.report_match(cid uuid, p_rounds jsonb, s_host int, s_opp int)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c challenges;
  mid uuid;
begin
  select * into c from challenges where id = cid for update;
  if c is null then raise exception 'challenge_not_found'; end if;
  if c.status <> 'accepted' then raise exception 'challenge_not_accepted'; end if;
  if auth.uid() <> c.host and auth.uid() <> c.opponent then
    raise exception 'not_a_participant';
  end if;
  if s_host = s_opp then raise exception 'no_draws'; end if;
  if s_host < 0 or s_opp < 0 or greatest(s_host, s_opp) < 4 then
    raise exception 'invalid_score';
  end if;

  insert into matches (challenge_id, p1, p2, p1_score, p2_score, rounds, winner, wager, reported_by)
  values (
    cid, c.host, c.opponent, s_host, s_opp, coalesce(p_rounds, '[]'::jsonb),
    case when s_host > s_opp then c.host else c.opponent end,
    c.wager, auth.uid()
  )
  returning id into mid;

  update challenges set status = 'completed' where id = cid;
  return mid;
end $$;

-- Opponent (the participant who did NOT report) confirms: stars move atomically.
create or replace function public.confirm_match(mid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  m matches;
  loser uuid;
  transfer int;
begin
  select * into m from matches where id = mid for update;
  if m is null then raise exception 'match_not_found'; end if;
  if m.status <> 'pending' then raise exception 'match_not_pending'; end if;
  if auth.uid() = m.reported_by then raise exception 'reporter_cannot_confirm'; end if;
  if auth.uid() <> m.p1 and auth.uid() <> m.p2 then raise exception 'not_a_participant'; end if;

  loser := case when m.winner = m.p1 then m.p2 else m.p1 end;
  select least(m.wager, stars) into transfer from profiles where id = loser for update;

  update profiles set stars = stars + transfer, wins = wins + 1 where id = m.winner;
  update profiles set stars = stars - transfer, losses = losses + 1 where id = loser;
  update matches set status = 'confirmed', confirmed_at = now(), stars_moved = transfer where id = mid;
end $$;

-- Opponent rejects a wrongly-reported result. No stars move.
create or replace function public.reject_match(mid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare m matches;
begin
  select * into m from matches where id = mid for update;
  if m is null then raise exception 'match_not_found'; end if;
  if m.status <> 'pending' then raise exception 'match_not_pending'; end if;
  if auth.uid() = m.reported_by then raise exception 'reporter_cannot_reject'; end if;
  if auth.uid() <> m.p1 and auth.uid() <> m.p2 then raise exception 'not_a_participant'; end if;
  update matches set status = 'rejected' where id = mid;
end $$;

revoke execute on function public.accept_challenge(uuid) from anon;
revoke execute on function public.report_match(uuid, jsonb, int, int) from anon;
revoke execute on function public.confirm_match(uuid) from anon;
revoke execute on function public.reject_match(uuid) from anon;

-- ============ indexes ============
create index challenges_status_city_idx on public.challenges (status, city, created_at desc);
create index matches_p1_idx on public.matches (p1, created_at desc);
create index matches_p2_idx on public.matches (p2, created_at desc);
create index matches_status_idx on public.matches (status) where status = 'pending';
