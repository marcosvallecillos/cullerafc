# Configuración de Supabase — Cullera FC

La app usa el proyecto Supabase del equipo. El navegador solo utiliza `VITE_SUPABASE_URL` y la clave publicable/anon; nunca debe recibir la clave `service_role`. RLS protege los datos incluso si alguien conoce la clave publicable.

## 1. Aplicar el esquema

En el proyecto Supabase del equipo, ejecuta una vez el archivo `supabase/migrations/20261101130000_cullera_fc_schema.sql` desde el SQL Editor, o usa Supabase CLI con `supabase db push`. La migración crea la organización Cullera FC, el esquema de perfiles/plantilla/actividades/asistencia/partidos/alineaciones/jugadas/avisos, las políticas RLS y el bucket privado `player-photos`.

Configura las URL de redirección de Supabase Auth para el origen publicado y el Preview que vayas a utilizar. No habilites el registro público por correo; las altas se hacen mediante invitación de Auth. Tras cambiar la lista de orígenes, vuelve a enviar invitaciones para que su enlace use el dominio correcto.

## 2. Vincular la primera cuenta entrenadora

1. En Supabase Auth, invita al correo del entrenador (o crea su usuario) y confirma que puede establecer una contraseña.
2. En SQL Editor, ejecuta el siguiente bloque reemplazando el correo por el correo real de la cuenta. El nombre y el proyecto Cullera FC ya son los declarados en la migración.

```sql
insert into public.profiles (id, team_id, full_name, role, active)
select u.id, t.id, 'Entrenador Cullera FC', 'coach', true
from auth.users u
cross join public.teams t
where lower(u.email) = lower('correo-real-del-entrenador@example.com')
  and t.slug = 'cullera-fc'
on conflict (id) do update
set team_id = excluded.team_id, role = 'coach', active = true;
```

Este bloque debe ejecutarlo un administrador dentro de Supabase; la aplicación no permite asignar roles ni crear perfiles desde el navegador.

## 3. Invitación a jugadores desde Plantilla

La Edge Function `supabase/functions/invite-player/index.ts` es la única que usa permisos de administración de Auth y verifica que quien la llama sea entrenador activo. Despliégala con Supabase CLI después de vincular el directorio con el proyecto correcto:

```sh
supabase functions deploy invite-player
```

Supabase proporciona `SUPABASE_URL` y `SUPABASE_ANON_KEY` al runtime de funciones. Si tu proyecto no proporciona automáticamente `SUPABASE_SERVICE_ROLE_KEY`, configúrala como secreto de Edge Functions desde Supabase; no la pongas en `VITE_*`, en el frontend ni en este repositorio. La función utiliza la sesión del entrenador y asocia la cuenta invitada con la ficha ya creada.

Si la función aún no está desplegada, crea la ficha sin correo, invita la cuenta desde Supabase Auth y después crea su perfil de equipo y vincula la ficha desde SQL Editor. La invitación de Auth, por sí sola, no concede acceso al equipo. Ejemplo administrativo, sustituyendo el UUID de la ficha y el correo real:

```sql
insert into public.profiles (id, team_id, full_name, role, active)
select u.id, p.team_id, p.full_name, 'player', true
from auth.users u
join public.players p on p.id = '00000000-0000-0000-0000-000000000000'::uuid
where lower(u.email) = lower('jugador@example.com')
on conflict (id) do update
set team_id = excluded.team_id, full_name = excluded.full_name, role = 'player', active = true;

update public.players p
set user_id = u.id
from auth.users u
where p.id = '00000000-0000-0000-0000-000000000000'::uuid
  and lower(u.email) = lower('jugador@example.com');
```

La invitación de Auth nunca se implementa mediante una clave privilegiada en el cliente web.

## 4. Variables del cliente

Las variables protegidas del proyecto web son `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Están disponibles para el cliente Vite como valores publicables; la clave no otorga permisos por sí sola. La aplicación muestra un estado de configuración y no datos falsos si falta alguna variable.

## 5. Permisos aplicados

- Solo perfiles activos de Cullera FC pueden leer datos del equipo.
- Solo el entrenador activo puede crear, actualizar o borrar jugadores, actividades, partidos, alineaciones, jugadas y avisos.
- Los jugadores solo pueden consultar alineaciones y jugadas marcadas como publicadas; el entrenador activo también puede consultar borradores.
- Un jugador autenticado puede consultar el equipo y enviar/actualizar/borrar únicamente su propia respuesta a una actividad.
- Las fotografías viven en el bucket privado `player-photos`; sus rutas empiezan por el UUID del equipo y las URL de lectura son firmadas.
- Al borrar de la plantilla a un jugador vinculado a una cuenta, un trigger marca su perfil inactivo y las funciones RLS dejan de darle acceso al equipo.
