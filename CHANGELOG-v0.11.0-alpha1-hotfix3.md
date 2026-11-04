# Nexus v0.11.0-alpha1-hotfix3

Hotfix sobre `v0.11.0-alpha1-hotfix2`.

## Corregido

- El formulario de avisos importantes valida el título (mínimo 3 caracteres) y el cuerpo (mínimo 5) antes de llamar a Supabase.
- La RPC global `create_nexus_important_announcement` valida y normaliza los campos en servidor y devuelve errores legibles, en vez de dejar que el usuario reciba una violación opaca de `nexus_important_announcements_body_check`.
- Retirada la antigua barra de avisos del encabezado de los canales. Los avisos importantes de megagrupo se muestran como mensajes en el historial de cada canal suscrito.
- Eliminados los estilos obsoletos de las tarjetas superiores de avisos.
- Actualizadas las versiones de caché de `app.js` y `app.css` para que el navegador descargue los recursos nuevos.

## Migración

`supabase/migrations/20261104_nexus_v0110_hotfix3_announcement_validation.sql`

Reemplaza la RPC global para validar `title` y `body` antes del INSERT. No cambia tablas, políticas, datos ni permisos. Ejecutar una sola vez después de hotfix2.

## Límites

- Título: 3–100 caracteres.
- Mensaje: 5–3000 caracteres.
- En canales, los avisos se publican en el historial como mensajes automatizados; no se muestra el banner antiguo.
