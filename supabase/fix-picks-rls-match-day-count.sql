drop policy if exists "app visitors insert picks before kickoff" on public.picks;

create policy "app visitors insert picks before kickoff" on public.picks
  for insert to anon
  with check (
    exists (select 1 from public.profiles where id = public.picks.user_id)
    and exists (
      select 1
      from public.matches m
      join public.featured_matches fm on fm.match_id = m.id
      where m.id = public.picks.match_id
        and m.status = 'scheduled'
        and now() < m.kickoff_at
    )
    and (
      select count(*)
      from public.picks existing
      join public.matches existing_match on existing_match.id = existing.match_id
      join public.matches target_match on target_match.id = public.picks.match_id
      where existing.user_id = public.picks.user_id
        and (existing_match.kickoff_at at time zone 'America/New_York')::date = (target_match.kickoff_at at time zone 'America/New_York')::date
    ) < 2
  );
