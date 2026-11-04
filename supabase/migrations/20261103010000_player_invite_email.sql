-- Correo de invitación guardado en la ficha para poder reenviar sin volver a pedirlo.
alter table public.players
  add column if not exists invite_email text;

alter table public.players
  drop constraint if exists players_invite_email_format;

alter table public.players
  add constraint players_invite_email_format
  check (
    invite_email is null
    or invite_email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  );

create unique index if not exists players_team_invite_email_unique
  on public.players (team_id, lower(invite_email))
  where invite_email is not null;
