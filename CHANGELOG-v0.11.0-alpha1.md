# Nexus v0.11.0-alpha1 — cambios

Primera alpha de la rama 0.11 para web y móvil. Nexus Desktop no cambia.

## Mensajes y multimedia

- Los adjuntos se preparan en el compositor y se envían junto al texto como un único mensaje.
- Opción para ocultar los adjuntos agrupados tras un spoiler.
- Etiquetas de lenguaje en bloques de código mediante `&&lang=true`.
- ImageCulling beta: imágenes y vídeos de los mensajes se difieren y se cargan alrededor de la zona visible del historial, comenzando desde la parte inferior cuando se entra al chat.

## Megagrupos

- Foros con categorías y tableros creados por cualquier miembro.
- Los tableros se representan como canales de texto normales para conservar historial, mensajes y tiempo real.
- Menciones por ruta `#Foros/Tablero/` dentro del megagrupo.
- Channels+: overrides de permisos por miembro y por rol. La base de datos aplica las restricciones mediante RLS y autorización de Realtime. Un override individual prevalece sobre los roles; si varios roles discrepan, la denegación prevalece.
- Avisos importantes por megagrupo en canales que activan su recepción.

## Administración y comunidad

- Avisos importantes globales y por megagrupo desde el panel de administradores de plataforma.
- Solicitud y revisión de insignias universales, con notificaciones de cambio de estado.
- Registro de advertencias, baneos y silencios para el resumen de reputación.

## Interfaz y calidad de vida

- Megacompactación beta: navegación conjunta de Chats, Amigos y Workshops en una barra sobre la lista de MDs, condicionada a Compactar paneles.
- Ventanas emergentes de Nexus para avisos del sistema, confirmación de borrado y novedades por versión; la optimización permite usar diálogos nativos.
- Hovers+ con estilos integrados en el tema de Nexus.
- Pantalla de carga con el logo de Nexus animado y el texto curioso de esta versión.
- Revisión de textos de interfaz que hacían referencia al proyecto concreto del administrador o a funciones antiguas como pendientes.
- Ocultación del área de administración antigua; el acceso de plataforma queda en el panel independiente.

## SQL y seguridad

- Nueva migración `supabase/migrations/20261104_nexus_v0110_forums_channels_plus_announcements_badges.sql`.
- Permisos de canal comprobados en políticas de lectura/escritura, reacciones y canales Realtime.
- Las dos migraciones 0.10.2 distribuidas en este paquete son las versiones reparadas que ya se entregaron en el SQL Repair Bundle.

## Limitaciones conocidas de la alpha

- ImageCulling depende de `IntersectionObserver`; si el navegador no lo soporta, los medios se cargan normalmente.
- La eficacia de ImageCulling se debe revisar con historiales grandes y distintos navegadores móviles.
- Channels+, Foros, avisos, insignias y moderación requieren ejecutar la migración 0.11 en Supabase.
- No se ha ejecutado la migración en la instancia real del usuario ni se han probado dos cuentas conectadas a su proyecto. Los controles estáticos no sustituyen las pruebas de integración.
