# Cullera FC — seguimiento de entregables

> **Estado:** implementación y compilación de la aplicación completadas; los elementos marcados `[x]` describen entregables implementados en el código/migración. La app todavía no puede validarse de extremo a extremo hasta aplicar la migración y vincular la cuenta entrenadora en Supabase. Las operaciones externas pendientes se detallan al final; no se han creado cuentas ni escrito datos de equipo durante esta tarea.

## 1. Acceso privado, perfiles y permisos
- [x] Implementar autenticación por correo electrónico y contraseña.
- [x] No debe existir registro público libre; los jugadores acceden mediante invitación o cuentas creadas por el entrenador.
- [x] Existirán dos roles: Entrenador y Jugador.
- [x] El entrenador podrá gestionar jugadores, crear y modificar alineaciones, diseñar jugadas, crear entrenamientos y actividades, crear y gestionar partidos y publicar información para los jugadores.
- [x] El jugador podrá consultar plantilla, alineaciones publicadas, jugadas, entrenamientos y partidos, y confirmar o rechazar convocatorias y actividades.
- [x] Solo el entrenador podrá modificar contenido deportivo. Los jugadores tendrán acceso de lectura y podrán gestionar sus propias confirmaciones de asistencia.
- [x] Los permisos estarán protegidos también en el backend y en la base de datos; los datos serán privados y accesibles solo por integrantes autorizados de Cullera FC.

## 2. Inicio, diseño de aplicación y navegación
- [x] Crear una PWA/app funcional, no una web corporativa ni landing page, destinada principalmente a teléfonos, con experiencia moderna, intuitiva y similar a una aplicación móvil profesional.
- [x] Aplicar la estética deportiva, moderna, minimalista y premium; paleta exacta: fondo `#0B1118`, tarjetas `#151F2B`, verde `#B6F23B`, texto `#FFFFFF`, secundario `#A5B3C1`, bordes `#263442`.
- [x] Diseño mobile-first y completamente responsive, tarjetas redondeadas, iconografía Lucide, animaciones/transiciones suaves, tipografía legible, botones grandes utilizables con una mano e interfaz despejada con identidad de equipo de fútbol.
- [x] Inicio mostrará nombre y escudo del equipo, próximo partido, próxima actividad, última alineación publicada, últimos avisos y accesos rápidos a alineaciones, jugadas y calendario; el contenido se adaptará al rol.
- [x] Implementar navegación fluida sin recargas innecesarias: barra inferior móvil con Inicio, Táctica, Plantilla, Entrenamientos y Partidos; Táctica tendrá pestañas Alineaciones y Jugadas; escritorio podrá usar barra lateral.
- [x] Incluir estados de carga, mensajes de confirmación, mensajes de error comprensibles, estados vacíos bien diseñados, confirmación antes de borrar y validación de formularios.
- [x] No presentar datos ficticios como reales; cualquier dato demostrativo estará identificado claramente.

## 3. Alineaciones de fútbol 7
- [x] Crear dentro de Táctica un editor visual e interactivo, no una imagen estática, con campo de fútbol 7 en orientación vertical para móviles.
- [x] Permitir colocar jugadores mediante arrastrar y soltar, moverlos libremente, mostrar nombre y dorsal, seleccionar jugadores de plantilla y añadir suplentes.
- [x] Incluir formaciones 2-3-1 como predeterminada, 3-2-1, 2-1-2-1 y 3-1-2.
- [x] Permitir guardar y modificar alineaciones, asociarlas a un partido y consultar alineaciones publicadas.

## 4. Pizarra y jugadas tácticas
- [x] Crear pizarra táctica interactiva y usable en pantalla táctil con campo de fútbol 7.
- [x] Permitir añadir y mover jugadores, dibujar flechas de movimiento y líneas de pase, añadir zonas y referencias, e incorporar textos explicativos.
- [x] Permitir crear varios pasos de una misma jugada, guardar, editar, eliminar y consultar jugadas publicadas.
- [x] La pizarra debe permitir preparar saques de esquina, faltas, salidas de balón, contraataques y movimientos defensivos.

## 5. Plantilla
- [x] Cada jugador tendrá fotografía, nombre y apellidos, dorsal, posición y estado de disponibilidad.
- [x] Estados admitidos: Disponible, Lesionado y Baja temporal.
- [x] El entrenador podrá crear, editar y eliminar jugadores; los jugadores podrán consultar la plantilla.
- [x] Las fotografías se almacenarán mediante el backend solicitado y se mostrarán con estados de carga/vacío adecuados.

## 6. Entrenamientos, actividades y convocatorias
- [x] Incluir calendario mensual, lista de próximas actividades, visualización por fecha y filtros por tipo.
- [x] Tipos de actividad: Entrenamiento, Amistoso, Partido de liga y Otros eventos.
- [x] El entrenador podrá crear una actividad con fecha, nombre o título, tipo, hora de inicio, ubicación, descripción y objetivos o material necesario.
- [x] Los jugadores podrán consultar actividades y confirmar asistencia o rechazarla.
- [x] El detalle de actividad mostrará toda su información y la lista de jugadores que han confirmado, rechazado o todavía no han respondido.

## 7. Partidos e historial
- [x] Cada partido incluirá equipo rival, fecha, hora, ubicación, jornada, resultado y estado pendiente/finalizado.
- [x] El entrenador podrá crear y editar partidos, registrar resultados, asociar alineaciones y consultar historial de encuentros.
- [x] Los jugadores podrán consultar partidos y alineaciones publicadas.

## 8. Supabase, persistencia y almacenamiento
- [x] Utilizar Supabase como backend: Supabase Authentication, PostgreSQL, RLS, relaciones entre usuarios, jugadores, actividades y partidos, almacenamiento de fotografías y persistencia de alineaciones y jugadas.
- [x] Entidades principales: `profiles`, `players`, `teams`, `activities`, `activity_attendance`, `matches`, `lineups`, `lineup_players` y `tactical_plays`; incluir estructura extensible organizada y entidad para avisos mostrados en Inicio.
- [x] Todos los datos pertenecerán a Cullera FC y no serán accesibles por usuarios externos.
- [x] No inventar credenciales ni afirmar que la aplicación está conectada si no se configuran variables de entorno; preparar integración y solicitar las claves necesarias por medio protegido.

## 9. Tecnologías, PWA e instalación
- [x] Utilizar React, TypeScript, Tailwind CSS, Supabase, SVG para campo táctico/editors y Lucide Icons.
- [x] Desarrollar como PWA instalable en Android y iOS cuando el navegador lo permita, con icono personalizado, manifest correctamente configurado, experiencia visual similar a app nativa y diseño adaptable.

## 10. Alcance, mantenibilidad y acabado
- [x] Un jugador debe poder consultar una alineación en pocos segundos; el entrenador debe poder crear alineaciones y jugadas cómodamente desde su móvil; evitar formularios excesivamente largos.
- [x] No dejar botones decorativos sin funcionalidad ni sustituir editores tácticos por imágenes estáticas.
- [x] No añadir chat, inteligencia artificial, estadísticas avanzadas ni gestión económica.
- [ ] Mantener arquitectura limpia y código reutilizable; comprobar funcionamiento en móviles y escritorio.
- [x] No desplegar ni publicar públicamente sin autorización expresa; no crear cuentas reales ni afirmar conexión Supabase antes de configurar credenciales.

## Operaciones externas pendientes (requieren acceso administrativo a Supabase)
- [ ] Aplicar `supabase/migrations/20261101130000_cullera_fc_schema.sql` al proyecto Supabase del Cullera FC. Esta tarea no se ejecutó automáticamente.
- [ ] Invitar al primer entrenador en Supabase Auth y crear/vincular su perfil `coach` siguiendo `docs/supabase-setup.md`.
- [ ] Verificar en Auth de Supabase que el alta pública permanezca deshabilitada y que las URL de redirección incluyan el dominio usado por Preview/publicación.
- [ ] Desplegar `supabase/functions/invite-player` en el proyecto Supabase y verificar que el runtime tenga `SUPABASE_SERVICE_ROLE_KEY` como secreto de función, nunca en el navegador.
- [ ] Hacer una pasada funcional con una cuenta entrenador y una cuenta jugador sobre la base provisionada, incluidas las políticas RLS de borradores/publicaciones.
