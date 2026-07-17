-- Battle results should affect stars, records and rankings as soon as they are reported.
-- The previous flow left reported matches pending until the opponent confirmed, while
-- the challenge already showed "completed", which made the app look out of sync.

create or replace function public.finalize_reported_match(mid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  m matches;
  loser uuid;
  transfer int;
begin
  select * into m from matches where id = mid for update;
  if m is null then raise exception 'match_not_found'; end if;
  if m.status <> 'pending' then return; end if;

  loser := case when m.winner = m.p1 then m.p2 else m.p1 end;

  perform 1 from profiles where id = m.winner for update;
  select least(m.wager, stars) into transfer from profiles where id = loser for update;
  transfer := coalesce(transfer, 0);

  update profiles set stars = stars + transfer, wins = wins + 1 where id = m.winner;
  update profiles set stars = stars - transfer, losses = losses + 1 where id = loser;
  update matches
    set status = 'confirmed',
        confirmed_at = now(),
        stars_moved = transfer
    where id = mid;
end $$;

revoke execute on function public.finalize_reported_match(uuid) from public;
revoke execute on function public.finalize_reported_match(uuid) from anon;
revoke execute on function public.finalize_reported_match(uuid) from authenticated;

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
begin
  select * into c from challenges where id = cid for update;
  if c is null then raise exception 'challenge_not_found'; end if;
  if c.status <> 'accepted' then raise exception 'challenge_not_accepted'; end if;
  if auth.uid() <> c.host and auth.uid() <> c.opponent then
    raise exception 'not_a_participant';
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

-- Repair existing battles that were already reported but left pending.
do $$
declare
  pending_match record;
begin
  for pending_match in
    select id from public.matches where status = 'pending' order by created_at asc
  loop
    perform public.finalize_reported_match(pending_match.id);
  end loop;
end $$;
