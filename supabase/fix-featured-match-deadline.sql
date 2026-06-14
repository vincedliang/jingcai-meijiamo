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
