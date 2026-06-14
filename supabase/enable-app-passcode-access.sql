drop policy if exists "profiles visible to app visitors" on public.profiles;
drop policy if exists "matches visible to app visitors" on public.matches;
drop policy if exists "featured matches visible to app visitors" on public.featured_matches;
drop policy if exists "picks visible to app visitors" on public.picks;
drop policy if exists "app visitors insert picks before kickoff" on public.picks;
drop policy if exists "app visitors manage featured matches" on public.featured_matches;
drop policy if exists "app visitors insert match schedule" on public.matches;
drop policy if exists "app visitors update match teams" on public.matches;

create policy "profiles visible to app visitors" on public.profiles
  for select to anon using (true);

create policy "matches visible to app visitors" on public.matches
  for select to anon using (true);

create policy "featured matches visible to app visitors" on public.featured_matches
  for select to anon using (true);

create policy "picks visible to app visitors" on public.picks
  for select to anon using (true);

create policy "app visitors insert picks before kickoff" on public.picks
  for insert to anon
  with check (
    exists (select 1 from public.profiles where id = user_id)
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

create policy "app visitors manage featured matches" on public.featured_matches
  for all to anon
  using (true)
  with check (exists (select 1 from public.profiles where id = selected_by and is_admin));

create policy "app visitors insert match schedule" on public.matches
  for insert to anon
  with check (true);

create policy "app visitors update match teams" on public.matches
  for update to anon
  using (true)
  with check (true);
