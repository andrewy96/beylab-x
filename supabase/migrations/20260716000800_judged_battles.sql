-- Judged battles let a non-playing creator open a match, wait for two players,
-- then submit the official score.

alter table public.challenges
  add column if not exists play_mode text not null default 'player'
    check (play_mode in ('player', 'judge')),
  add column if not exists player1 uuid references public.profiles (id),
  add column if not exists player2 uuid references public.profiles (id);

drop policy if exists "post covered open challenge" on public.challenges;
create policy "post covered open challenge" on public.challenges
  for insert with check (
    auth.uid() = host
    and status = 'open'
    and opponent is null
    and player1 is null
    and player2 is null
    and play_mode in ('player', 'judge')
    and (
      (format = 'single' and team_size = 1)
      or (format = 'team' and team_size between 2 and 20)
    )
    and target_score between 1 and 30
    and wager >= team_size
    and (
      play_mode = 'judge'
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.stars >= wager
      )
    )
  );

grant insert (play_mode) on public.challenges to authenticated;

create or replace function public.accept_challenge(cid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c challenges;
  joining uuid := auth.uid();
begin
  select * into c from challenges where id = cid for update;
  if c is null then raise exception 'challenge_not_found'; end if;
  if c.status <> 'open' then raise exception 'challenge_not_open'; end if;

  if c.play_mode = 'judge' then
    if c.host = joining then raise exception 'judge_cannot_join'; end if;
    if c.player1 = joining or c.player2 = joining then
      raise exception 'already_joined';
    end if;
    if (select stars from profiles where id = joining) < c.wager then
      raise exception 'not_enough_stars';
    end if;

    if c.player1 is null then
      update challenges set player1 = joining where id = cid;
      return;
    end if;

    if c.player2 is null then
      if (select stars from profiles where id = c.player1) < c.wager then
        raise exception 'player1_not_enough_stars';
      end if;
      update challenges
        set player2 = joining,
            opponent = joining,
            status = 'accepted'
        where id = cid;
      return;
    end if;

    raise exception 'challenge_full';
  end if;

  if c.host = joining then raise exception 'cannot_accept_own'; end if;
  if (select stars from profiles where id = c.host) < c.wager then
    raise exception 'host_not_enough_stars';
  end if;
  if (select stars from profiles where id = joining) < c.wager then
    raise exception 'not_enough_stars';
  end if;
  update challenges set opponent = joining, status = 'accepted' where id = cid;
end $$;

revoke execute on function public.accept_challenge(uuid) from public;
revoke execute on function public.accept_challenge(uuid) from anon;
grant execute on function public.accept_challenge(uuid) to authenticated;

create or replace function public.report_match(cid uuid, p_rounds jsonb, s_host int, s_opp int)
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
  reporter uuid := auth.uid();
  p1_id uuid;
  p2_id uuid;
begin
  select * into c from challenges where id = cid for update;
  if c is null then raise exception 'challenge_not_found'; end if;
  if c.status <> 'accepted' then raise exception 'challenge_not_accepted'; end if;

  if c.play_mode = 'judge' then
    if reporter <> c.host then raise exception 'not_judge'; end if;
    if c.player1 is null or c.player2 is null then raise exception 'players_not_ready'; end if;
    p1_id := c.player1;
    p2_id := c.player2;
  else
    if reporter <> c.host and reporter <> c.opponent then
      raise exception 'not_a_participant';
    end if;
    if c.opponent is null then raise exception 'challenge_not_accepted'; end if;
    p1_id := c.host;
    p2_id := c.opponent;
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
    target_score
  )
  values (
    cid,
    p1_id,
    p2_id,
    s_host,
    s_opp,
    p_rounds,
    case when s_host > s_opp then p1_id else p2_id end,
    c.wager,
    reporter,
    c.format,
    c.team_size,
    c.target_score
  )
  returning id into mid;

  perform public.finalize_reported_match(mid);
  update challenges set status = 'completed' where id = cid;
  return mid;
end $$;

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
  reporter uuid := auth.uid();
  p1_id uuid;
  p2_id uuid;
begin
  select * into c from challenges where id = cid for update;
  if c is null then raise exception 'challenge_not_found'; end if;
  if c.status <> 'accepted' then raise exception 'challenge_not_accepted'; end if;

  if c.play_mode = 'judge' then
    if reporter <> c.host then raise exception 'not_judge'; end if;
    if c.player1 is null or c.player2 is null then raise exception 'players_not_ready'; end if;
    p1_id := c.player1;
    p2_id := c.player2;
  else
    if reporter <> c.host and reporter <> c.opponent then
      raise exception 'not_a_participant';
    end if;
    if c.opponent is null then raise exception 'challenge_not_accepted'; end if;
    p1_id := c.host;
    p2_id := c.opponent;
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
    p1_id,
    p2_id,
    s_host,
    s_opp,
    p_rounds,
    case when s_host > s_opp then p1_id else p2_id end,
    c.wager,
    reporter,
    c.format,
    c.team_size,
    c.target_score,
    combo_host,
    combo_opp
  )
  returning id into mid;

  perform public.finalize_reported_match(mid);
  update challenges set status = 'completed' where id = cid;
  return mid;
end $$;

revoke execute on function public.report_match(uuid, jsonb, int, int) from public;
revoke execute on function public.report_match(uuid, jsonb, int, int) from anon;
grant execute on function public.report_match(uuid, jsonb, int, int) to authenticated;

revoke execute on function public.report_match_with_combos(uuid, jsonb, int, int, jsonb, jsonb) from public;
revoke execute on function public.report_match_with_combos(uuid, jsonb, int, int, jsonb, jsonb) from anon;
grant execute on function public.report_match_with_combos(uuid, jsonb, int, int, jsonb, jsonb) to authenticated;

create index if not exists challenges_player1_idx on public.challenges (player1, created_at desc);
create index if not exists challenges_player2_idx on public.challenges (player2, created_at desc);
