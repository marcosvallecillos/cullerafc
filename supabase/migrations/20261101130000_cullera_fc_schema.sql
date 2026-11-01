-- Cullera FC · esquema inicial para Supabase PostgreSQL.
-- Aplicar una sola vez desde Supabase CLI o SQL Editor del proyecto del equipo.
create extension if not exists pgcrypto;
create schema if not exists app_private;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  role text not null check (role in ('coach', 'player')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  jersey_number integer check (jersey_number between 0 and 99),
  position text,
  availability text not null default 'available' check (availability in ('available', 'injured', 'temporary_leave')),
  photo_path text,
  created_at timestamptz not null default now()
);
create unique index if not exists players_team_jersey_unique on public.players(team_id, jersey_number) where jersey_number is not null;
create index if not exists players_team_name_idx on public.players(team_id, full_name);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 110),
  activity_type text not null check (activity_type in ('training', 'friendly', 'league', 'other')),
  activity_date date not null,
  start_time time,
  location text,
  description text,
  objectives text,
  created_at timestamptz not null default now()
);
create index if not exists activities_team_date_idx on public.activities(team_id, activity_date, start_time);

create table if not exists public.activity_attendance (
  activity_id uuid not null references public.activities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  response text not null check (response in ('yes', 'no')),
  responded_at timestamptz not null default now(),
  primary key (activity_id, profile_id)
);
create index if not exists activity_attendance_team_activity_idx on public.activity_attendance(team_id, activity_id);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  opponent text not null check (length(trim(opponent)) between 1 and 110),
  match_date date not null,
  start_time time,
  location text,
  round text,
  home_score integer check (home_score between 0 and 99),
  away_score integer check (away_score between 0 and 99),
  status text not null default 'pending' check (status in ('pending', 'finished')),
  created_at timestamptz not null default now(),
  check ((status <> 'finished') or (home_score is not null and away_score is not null))
);
create index if not exists matches_team_date_idx on public.matches(team_id, match_date desc);

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 90),
  formation text not null check (formation in ('2-3-1', '3-2-1', '2-1-2-1', '3-1-2')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lineups_team_published_idx on public.lineups(team_id, published, updated_at desc);
create index if not exists lineups_match_idx on public.lineups(match_id);

create table if not exists public.lineup_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  lineup_id uuid not null references public.lineups(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  slot_type text not null check (slot_type in ('starter', 'bench')),
  x numeric(5,2) not null check (x between 0 and 100),
  y numeric(5,2) not null check (y between 0 and 100),
  position_label text,
  unique (lineup_id, player_id)
);
create index if not exists lineup_players_lineup_idx on public.lineup_players(lineup_id, slot_type);

create table if not exists public.tactical_plays (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 100),
  category text not null,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tactical_plays_team_updated_idx on public.tactical_plays(team_id, updated_at desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 90),
  body text not null check (length(trim(body)) between 1 and 700),
  created_at timestamptz not null default now()
);
create index if not exists announcements_team_created_idx on public.announcements(team_id, created_at desc);

create or replace function app_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function app_private.touch_updated_at() from public;
drop trigger if exists lineups_touch_updated_at on public.lineups;
create trigger lineups_touch_updated_at before update on public.lineups for each row execute function app_private.touch_updated_at();
drop trigger if exists tactical_plays_touch_updated_at on public.tactical_plays;
create trigger tactical_plays_touch_updated_at before update on public.tactical_plays for each row execute function app_private.touch_updated_at();

insert into public.teams (name, slug) values ('Cullera FC', 'cullera-fc') on conflict (slug) do nothing;

-- Security-definer helpers avoid recursive profiles RLS policies; access still requires an active team profile.
create or replace function app_private.is_team_member(target_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.team_id = target_team and p.active = true
  );
$$;

create or replace function app_private.is_team_coach(target_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.team_id = target_team and p.active = true and p.role = 'coach'
  );
$$;

revoke all on function app_private.is_team_member(uuid) from public;
revoke all on function app_private.is_team_coach(uuid) from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_team_member(uuid) to authenticated;
grant execute on function app_private.is_team_coach(uuid) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.teams, public.profiles, public.players, public.activities, public.activity_attendance, public.matches, public.lineups, public.lineup_players, public.tactical_plays, public.announcements to authenticated;

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.activities enable row level security;
alter table public.activity_attendance enable row level security;
alter table public.matches enable row level security;
alter table public.lineups enable row level security;
alter table public.lineup_players enable row level security;
alter table public.tactical_plays enable row level security;
alter table public.announcements enable row level security;

-- Teams and profiles: membership only; role/profile bootstrap is performed by an administrator or the invite function.
drop policy if exists "team members can read their team" on public.teams;
create policy "team members can read their team" on public.teams for select to authenticated using (app_private.is_team_member(id));
drop policy if exists "active team members can read profiles" on public.profiles;
create policy "active team members can read profiles" on public.profiles for select to authenticated using (active and app_private.is_team_member(team_id));

-- Roster: team members can read; only a coach can maintain player records.
drop policy if exists "team members read roster" on public.players;
create policy "team members read roster" on public.players for select to authenticated using (app_private.is_team_member(team_id));
drop policy if exists "coaches manage roster" on public.players;
create policy "coaches manage roster" on public.players for all to authenticated
  using (app_private.is_team_coach(team_id))
  with check (
    app_private.is_team_coach(team_id)
    and (user_id is null or exists (
      select 1 from public.profiles p
      where p.id = players.user_id and p.team_id = players.team_id and p.active = true and p.role = 'player'
    ))
  );

-- Shared team content: members read, coaches create/update/delete.
drop policy if exists "team members read activities" on public.activities;
create policy "team members read activities" on public.activities for select to authenticated using (app_private.is_team_member(team_id));
drop policy if exists "coaches manage activities" on public.activities;
create policy "coaches manage activities" on public.activities for all to authenticated using (app_private.is_team_coach(team_id)) with check (app_private.is_team_coach(team_id));

drop policy if exists "team members read matches" on public.matches;
create policy "team members read matches" on public.matches for select to authenticated using (app_private.is_team_member(team_id));
drop policy if exists "coaches manage matches" on public.matches;
create policy "coaches manage matches" on public.matches for all to authenticated using (app_private.is_team_coach(team_id)) with check (app_private.is_team_coach(team_id));

drop policy if exists "team members read lineups" on public.lineups;
create policy "team members read lineups" on public.lineups for select to authenticated
  using (app_private.is_team_member(team_id) and (published = true or app_private.is_team_coach(team_id)));
drop policy if exists "coaches manage lineups" on public.lineups;
create policy "coaches manage lineups" on public.lineups for all to authenticated
  using (app_private.is_team_coach(team_id) and (match_id is null or exists (
    select 1 from public.matches m where m.id = lineups.match_id and m.team_id = lineups.team_id
  )))
  with check (app_private.is_team_coach(team_id) and (match_id is null or exists (
    select 1 from public.matches m where m.id = lineups.match_id and m.team_id = lineups.team_id
  )));

drop policy if exists "team members read lineup players" on public.lineup_players;
create policy "team members read lineup players" on public.lineup_players for select to authenticated
  using (
    app_private.is_team_member(team_id)
    and exists (
      select 1 from public.lineups l
      where l.id = lineup_players.lineup_id and l.team_id = lineup_players.team_id
        and (l.published = true or app_private.is_team_coach(l.team_id))
    )
  );
drop policy if exists "coaches manage lineup players" on public.lineup_players;
create policy "coaches manage lineup players" on public.lineup_players for all to authenticated
  using (
    app_private.is_team_coach(team_id)
    and exists (select 1 from public.lineups l where l.id = lineup_players.lineup_id and l.team_id = lineup_players.team_id)
    and exists (select 1 from public.players p where p.id = lineup_players.player_id and p.team_id = lineup_players.team_id)
  )
  with check (
    app_private.is_team_coach(team_id)
    and exists (select 1 from public.lineups l where l.id = lineup_players.lineup_id and l.team_id = lineup_players.team_id)
    and exists (select 1 from public.players p where p.id = lineup_players.player_id and p.team_id = lineup_players.team_id)
  );

drop policy if exists "team members read tactical plays" on public.tactical_plays;
create policy "team members read tactical plays" on public.tactical_plays for select to authenticated
  using (app_private.is_team_member(team_id) and (published = true or app_private.is_team_coach(team_id)));
drop policy if exists "coaches manage tactical plays" on public.tactical_plays;
create policy "coaches manage tactical plays" on public.tactical_plays for all to authenticated using (app_private.is_team_coach(team_id)) with check (app_private.is_team_coach(team_id));

drop policy if exists "team members read announcements" on public.announcements;
create policy "team members read announcements" on public.announcements for select to authenticated using (app_private.is_team_member(team_id));
drop policy if exists "coaches manage announcements" on public.announcements;
create policy "coaches manage announcements" on public.announcements for all to authenticated using (app_private.is_team_coach(team_id)) with check (app_private.is_team_coach(team_id));

-- Attendance is private to the team; a player may only upsert/delete their own response.
drop policy if exists "team members read attendance" on public.activity_attendance;
create policy "team members read attendance" on public.activity_attendance for select to authenticated using (app_private.is_team_member(team_id));
drop policy if exists "players respond for themselves" on public.activity_attendance;
create policy "players respond for themselves" on public.activity_attendance for insert to authenticated
  with check (
    profile_id = auth.uid()
    and app_private.is_team_member(team_id)
    and exists (select 1 from public.activities a where a.id = activity_attendance.activity_id and a.team_id = activity_attendance.team_id)
  );
drop policy if exists "players update their own response" on public.activity_attendance;
create policy "players update their own response" on public.activity_attendance for update to authenticated
  using (
    profile_id = auth.uid()
    and app_private.is_team_member(team_id)
    and exists (select 1 from public.activities a where a.id = activity_attendance.activity_id and a.team_id = activity_attendance.team_id)
  )
  with check (
    profile_id = auth.uid()
    and app_private.is_team_member(team_id)
    and exists (select 1 from public.activities a where a.id = activity_attendance.activity_id and a.team_id = activity_attendance.team_id)
  );
drop policy if exists "players or coaches delete attendance" on public.activity_attendance;
create policy "players or coaches delete attendance" on public.activity_attendance for delete to authenticated
  using (app_private.is_team_member(team_id) and (profile_id = auth.uid() or app_private.is_team_coach(team_id)));

-- Removing a roster record also disables its linked profile, preventing continued team access.
create or replace function app_private.revoke_player_access_on_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.user_id is not null then
    update public.profiles set active = false where id = old.user_id;
  end if;
  return old;
end;
$$;
drop trigger if exists revoke_player_access_after_delete on public.players;
create trigger revoke_player_access_after_delete before delete on public.players for each row execute function app_private.revoke_player_access_on_delete();

-- Private object bucket. Object paths must begin with <team UUID>/<player UUID>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists "team members read player photos" on storage.objects;
create policy "team members read player photos" on storage.objects for select to authenticated
  using (bucket_id = 'player-photos' and app_private.is_team_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "coaches upload player photos" on storage.objects;
create policy "coaches upload player photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos' and app_private.is_team_coach(((storage.foldername(name))[1])::uuid));
drop policy if exists "coaches update player photos" on storage.objects;
create policy "coaches update player photos" on storage.objects for update to authenticated
  using (bucket_id = 'player-photos' and app_private.is_team_coach(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'player-photos' and app_private.is_team_coach(((storage.foldername(name))[1])::uuid));
drop policy if exists "coaches delete player photos" on storage.objects;
create policy "coaches delete player photos" on storage.objects for delete to authenticated
  using (bucket_id = 'player-photos' and app_private.is_team_coach(((storage.foldername(name))[1])::uuid));
