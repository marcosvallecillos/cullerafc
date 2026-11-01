# Cullera FC

PWA privada para el equipo amateur de fútbol 7 Cullera FC. El cliente se construye con React, TypeScript, Vite y Tailwind; la identidad visual y las pizarras tácticas usan SVG, con iconos Lucide. La app no incluye datos de demostración.

## Arranque local

```sh
pnpm install
pnpm dev
```

El servidor escucha en `http://localhost:3000`. Para verificar el proyecto, ejecuta `pnpm run typecheck` y `pnpm run build`.

## Supabase

El proyecto espera `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el entorno de build/Preview. Usa exclusivamente la clave publicable/anon. No incluyas `service_role` en variables `VITE_*` ni en el navegador.

Para crear el esquema, el bucket privado, las políticas RLS y el trigger de revocación, aplica `supabase/migrations/20261101130000_cullera_fc_schema.sql` al proyecto Supabase del equipo. Después, sigue `docs/supabase-setup.md` para vincular la primera cuenta de entrenador, configurar Auth y desplegar la Edge Function segura `invite-player`.

El esquema de Supabase y la creación del primer perfil entrenador son operaciones administrativas del proyecto Supabase; no se ejecutan automáticamente durante el build. Hasta que estén aplicados, la app no inventa datos ni habilita usuarios.

## Rutas

`/` Inicio · `/tactics` Táctica · `/roster` Plantilla · `/activities` Entrenamientos · `/matches` Partidos · `/login` Acceso. El manifiesto de rutas de Manus vive en `public/manus-routes.json`.
