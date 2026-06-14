create extension if not exists "pgcrypto";

create type pick_choice as enum ('home', 'draw', 'away');
create type match_phase as enum ('group', 'round32', 'round16', 'quarter', 'semi', 'third', 'final');
create type match_status as enum ('scheduled', 'live', 'finished');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.matches (
  id text primary key,
  match_no int not null unique,
  phase match_phase not null,
  kickoff_at timestamptz not null,
  venue text not null default '',
  home_team text not null,
  away_team text not null,
  home_score int,
  away_score int,
  status match_status not null default 'scheduled',
  winner pick_choice,
  source text not null default 'fifa.com scores-fixtures',
  source_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint group_draw_allowed check (phase = 'group' or winner is null or winner <> 'draw')
);

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  choice pick_choice not null,
  locked_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create table public.featured_matches (
  match_id text primary key references public.matches(id) on delete cascade,
  selected_by uuid references public.profiles(id),
  selected_at timestamptz not null default now()
);

create table public.result_overrides (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches(id) on delete cascade,
  home_score int,
  away_score int,
  status match_status not null,
  winner pick_choice,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create view public.standings as select
  p.id as user_id,
  p.display_name,
  count(pk.id) filter (where m.status = 'finished' and m.winner is not null) as played,
  count(pk.id) filter (where m.status = 'finished' and m.winner is not null and pk.choice <> m.winner) as wrong,
  count(pk.id) filter (where m.status = 'finished' and m.winner is not null and pk.choice <> m.winner) * 10 as points
from public.profiles p
left join public.picks pk on pk.user_id = p.id
left join public.matches m on m.id = pk.match_id
group by p.id, p.display_name;

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.picks enable row level security;
alter table public.featured_matches enable row level security;
alter table public.result_overrides enable row level security;

create policy "profiles visible to signed in users" on public.profiles
  for select to authenticated using (true);

create policy "matches visible to signed in users" on public.matches
  for select to authenticated using (true);

create policy "admins update matches" on public.matches
  for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

create policy "picks visible to signed in users" on public.picks
  for select to authenticated using (true);

create policy "featured matches visible to signed in users" on public.featured_matches
  for select to authenticated using (true);

create policy "admins manage featured matches" on public.featured_matches
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

create policy "users insert own picks before kickoff" on public.picks
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.matches m
      join public.featured_matches fm on fm.match_id = m.id
      where m.id = match_id
        and m.status = 'scheduled'
        and now() < m.kickoff_at
    )
    and (
      select count(*)
      from public.picks existing
      join public.matches existing_match on existing_match.id = existing.match_id
      join public.matches target_match on target_match.id = match_id
      where existing.user_id = auth.uid()
        and (existing_match.kickoff_at at time zone 'America/New_York')::date = (target_match.kickoff_at at time zone 'America/New_York')::date
    ) < 2
  );

create policy "picks cannot be updated" on public.picks
  for update to authenticated using (false);

create policy "admins insert result overrides" on public.result_overrides
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

create policy "overrides visible to signed in users" on public.result_overrides
  for select to authenticated using (true);

create or replace function public.limit_featured_matches_per_day()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  featured_count int;
begin
  select count(*)
  into featured_count
  from public.featured_matches fm
  join public.matches selected_match on selected_match.id = fm.match_id
  join public.matches target_match on target_match.id = new.match_id
  where (selected_match.kickoff_at at time zone 'America/New_York')::date = (target_match.kickoff_at at time zone 'America/New_York')::date;

  if featured_count >= 2 then
    raise exception 'Only two featured matches are allowed per match day';
  end if;

  if now() >= (
    select target_match.kickoff_at
    from public.matches target_match
    where target_match.id = new.match_id
  ) then
    raise exception 'Featured matches must be selected before that match starts';
  end if;

  if exists (
    select 1
    from public.matches target_match
    where target_match.id = new.match_id
      and target_match.status <> 'scheduled'
  ) then
    raise exception 'Only scheduled matches can be selected as featured matches';
  end if;

  return new;
end;
$$;

create trigger limit_featured_matches_per_day
before insert on public.featured_matches
for each row execute function public.limit_featured_matches_per_day();

create or replace function public.prevent_late_featured_match_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if now() >= (
    select target_match.kickoff_at
    from public.matches target_match
    where target_match.id = old.match_id
  ) then
    raise exception 'Featured matches cannot be changed after that match starts';
  end if;

  return old;
end;
$$;

create trigger prevent_late_featured_match_delete
before delete on public.featured_matches
for each row execute function public.prevent_late_featured_match_delete();

create or replace function public.apply_latest_override()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.matches
  set
    home_score = new.home_score,
    away_score = new.away_score,
    status = new.status,
    winner = new.winner,
    updated_at = now()
  where id = new.match_id;
  return new;
end;
$$;

create trigger apply_result_override
after insert on public.result_overrides
for each row execute function public.apply_latest_override();

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.picks;
alter publication supabase_realtime add table public.featured_matches;
