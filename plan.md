# Plan de implementación — Cullera FC

## Enfoque

Aplicación web React + TypeScript pensada como una PWA móvil privada, no como una landing page. El frontend consumirá Supabase mediante el SDK oficial; PostgreSQL, Supabase Auth, Storage y las políticas RLS serán la fuente real de autenticación, permisos y persistencia. No se afirmará que hay conexión hasta configurar las variables de entorno y ejecutar la migración en el proyecto Supabase del equipo. Sin esa configuración, la app mostrará un estado de configuración/conexión claro y no presentará datos ficticios como datos reales.

El acceso será solo por correo y contraseña, sin alta pública. La creación/invitación de usuarios quedará en manos del entrenador o administrador; la invitación desde la app utilizará una Edge Function autenticada sin exponer privilegios al navegador. La app aplicará los roles en la interfaz, pero la autorización efectiva se hará también con RLS: solo miembros activos de Cullera FC pueden consultar los datos de su equipo; el entrenador puede modificar contenido deportivo y consultar borradores; los jugadores solo pueden consultar alineaciones y jugadas publicadas y cambiar su propia respuesta a actividades. La clave publicable de Supabase no se tratará como mecanismo de autorización; RLS será obligatoria.

## Alcance de producto

- **Inicio:** resumen contextual con próximo partido, próxima actividad, alineación publicada, avisos y accesos rápidos; contenido distinto para entrenador y jugador.
- **Táctica / Alineaciones:** vista de campo SVG vertical con formaciones 2-3-1, 3-2-1, 2-1-2-1 y 3-1-2; asignación de jugadores y suplentes desde la plantilla; arrastre táctil/ratón, edición de posición, dorsal/nombre; guardar, editar, publicar/consultar y asociar a partido.
- **Táctica / Jugadas:** pizarra SVG táctil por pasos con fichas de jugadores, flechas, líneas de pase, zonas, referencias y anotaciones. Guardar, editar, eliminar y consultar jugadas.
- **Plantilla:** jugadores con foto, nombre, dorsal, posición y estado Disponible/Lesionado/Baja temporal; CRUD reservado al entrenador y consulta para jugadores; imágenes en Supabase Storage.
- **Entrenamientos y actividades:** calendario mensual, lista próxima, detalle por fecha, filtros por tipo y asistencia (confirmar/rechazar/pendiente), con lista visible de respuestas. Campos: fecha, título, tipo, hora, ubicación, descripción, objetivos/material.
- **Partidos:** rival, fecha, hora, ubicación, jornada, resultado, estado pendiente/finalizado, asociación con alineación e historial.
- **Avisos:** publicación simple para los anuncios que se muestran en Inicio.
- **PWA y navegación:** cinco secciones (Inicio, Táctica, Plantilla, Entrenamientos, Partidos), pestañas Alineaciones/Jugadas, barra inferior móvil y navegación lateral en escritorio, manifest e iconos. El service worker podrá almacenar solo el shell estático, no respuestas privadas del equipo.
- En todas las secciones se implementarán vacíos claros, carga, validación, mensajes de error/confirmación y confirmación antes de borrar. No se incluirán chat, IA, economía o estadísticas avanzadas.

## Arquitectura de datos y seguridad

Se preparará una migración SQL versionada para Supabase con tablas `teams`, `profiles`, `players`, `activities`, `activity_attendance`, `matches`, `lineups`, `lineup_players`, `tactical_plays` y `announcements` (para cubrir los avisos del Inicio). Se establecerán claves foráneas, restricciones para estados/tipos, relación equipo-usuario-jugador y datos tácticos serializados como JSONB versionable cuando corresponda. La estructura almacenará posiciones y pasos de pizarras de forma persistente.

Las políticas RLS limitarán lecturas a usuarios autenticados y activos del equipo; jugadores solo verán alineaciones y jugadas publicadas, mientras el entrenador podrá consultar borradores. Las escrituras de contenido deportivo y el borrado/edición de plantilla, táctica, actividades y partidos quedarán reservados al entrenador; el jugador podrá insertar/actualizar solo su propio registro de asistencia. No habrá políticas de registro público. Se incluirá una guía de despliegue de migraciones, creación/invitación de cuentas, asignación de roles y almacenamiento de fotos privado. La URL del proyecto y la clave publicable se suministraron por el canal seguro de variables del proyecto; no se incluirán en código ni commits.

## Diseño

- **Movimiento:** lenguaje visual de vestuario/analítica de fútbol contemporánea, con contraste alto y precisión de una pizarra táctica.
- **Principios:** primero móvil; acciones deportivas directas; jerarquía muy legible; privacidad y estados explícitos.
- **Color:** respetar el fondo nocturno `#0B1118` y tarjetas `#151F2B` para sensación de concentración; el verde `#B6F23B` será el acento de energía y acción; blanco y gris azulado separarán jerarquías; bordes `#263442` delimitarán sin ruido.
- **Composición:** encabezado compacto de equipo, contexto del siguiente evento y contenido en tarjetas apiladas; navegación inferior fija en móvil, panel lateral en escritorio. El campo táctico ocupa el foco de la pantalla cuando se edita.
- **Motivos:** contornos de campo en SVG; acentos de línea verde y marcas circulares de jugador; escudo geométrico propio, claramente de Cullera FC y sin apropiarse de un escudo oficial no proporcionado.
- **Interacción y movimiento:** objetivos táctiles amplios; selección/arrastre con pointer events; transiciones breves de 160–220 ms en pestañas, tarjetas y menús; evitar animaciones prolongadas o que distraigan durante la edición táctica; soporte `prefers-reduced-motion`.
- **Tipografía:** sistema sans-serif moderno y legible, con títulos condensados/deportivos solo si se dispone de fuente de licencia adecuada; números/dorsales con peso alto. Mantener carga tipográfica ligera y contraste accesible.
- **Marca:** “Cullera FC” como centro táctico privado del equipo; personalidad competitiva, clara y cercana. Voz breve y práctica. Ejemplos: “El próximo reto, a la vista.” / “Confirma si contamos contigo.”
- **Escudo/wordmark:** escudo vectorial original con iniciales CFC y un motivo de balón/campo, usado como marca de interfaz; no se presentará como escudo oficial del club sin un recurso entregado por el usuario.
- **Color de marca:** verde lima `#B6F23B`.

## Estructura del proyecto

- `src/app/`: router, layout autenticado, navegación móvil/escritorio y límites de rol.
- `src/components/`: componentes UI reutilizables, estados vacíos y feedback de formularios.
- `src/features/home/`, `tactics/`, `roster/`, `activities/`, `matches/`, `announcements/`: páginas y lógica de cada dominio.
- `src/features/tactics/lineups/` y `src/features/tactics/plays/`: editores táctiles SVG separados, serialización y formularios.
- `src/lib/supabase/`: cliente, tipado y helpers de sesión; nunca contiene secretos de servidor.
- `src/lib/permissions/`: comprobaciones de rol para UX, sin sustituir RLS.
- `src/styles/`: tokens Tailwind y estilos globales.
- `public/`: manifest, iconos, escudo SVG y `/manus-routes.json`.
- `supabase/migrations/`: SQL de esquema, constraints e implementación de RLS.
- `docs/supabase-setup.md`: configuración de variables, ejecución de migraciones y aprovisionamiento privado de usuarios.

## Entrega y decisiones pendientes

Se implementará y comprobará primero el producto dentro del Preview del proyecto, en móvil y escritorio. No se publicará el sitio ni se crearán usuarios reales sin que el propietario lo solicite. La integración con Supabase quedará plenamente operativa al disponer de `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en las variables protegidas del proyecto y de acceso al proyecto Supabase para aplicar la migración; si esas credenciales no están disponibles, se entregará el código, esquema, políticas y pasos de configuración sin afirmar que está conectado.
