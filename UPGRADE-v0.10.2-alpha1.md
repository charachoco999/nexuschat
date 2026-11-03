# Actualizar Nexus v0.10.1-alpha3-hotfix2 → v0.10.2-alpha1

Esta entrega continúa la rama web/móvil 0.10 y no modifica Nexus Desktop.

## Antes de empezar
1. Haz una copia del repositorio y una copia de seguridad de Supabase.
2. Comprueba que ya están aplicadas las migraciones anteriores hasta el hotfix2, incluidas las de reacciones personalizadas, Markdown/InputSync/hojas de cálculo y formatos de audio.
3. Conserva `assets/js/config.js`; los paquetes no incluyen credenciales.

## Migraciones SQL
Desde Supabase → SQL Editor, ejecuta en este orden. Cada archivo debe ejecutarse una sola vez por proyecto:

1. `supabase/migrations/20261103_nexus_v0102_platform_community_profiles_workshop.sql`
   - Añade `last_seen_at`, perfiles por megagrupo, feedback de plataforma, buzón interno `Nexus (App)`, silencios temporales y Sticker Workshop.
   - Instala las políticas RLS y las funciones protegidas para moderación y recursos compartidos.
2. `supabase/migrations/20261103_nexus_v0102_z_admin_indexes_and_platform_bans.sql`
   - Añade índices administrativos, la tabla `user_bans` y funciones de ban/desban reservadas a `is_platform_admin()`.

No ejecutes `20261103_nexus_v0102_grouped_messages_theme_emoji_reactions.sql` ni `20261103_nexus_v0103_markdown_inputs_sync_spreadsheets.sql` otra vez si ya las aplicaste en las versiones anteriores.

## Publicar
1. Descomprime `nexus-chat-v0.10.2-alpha1-upgrade.zip`.
2. Sube el contenido de `nexus-chat/` a la raíz del repositorio de GitHub Pages y acepta sustituir archivos.
3. Conserva `assets/js/config.js`.
4. Recarga con `Ctrl + F5` en escritorio; en móvil cierra y vuelve a abrir Nexus.

## Pruebas recomendadas
1. Reenvía mensajes de texto y con adjuntos a un MD y a un canal.
2. Selecciona varios archivos y añade una descripción en el compositor.
3. Comprueba vídeo inline, pantalla completa y descarga.
4. Comprueba separadores por fecha y agrupación activada/desactivada.
5. Revisa la guía detallada de Markdown.
6. Con una cuenta `is_platform_admin()`, prueba búsqueda por username/nickname, alta/última actividad, ban temporal, desban, silencio, advertencia y resolución de feedback.
7. Guarda un perfil distinto en dos megagrupos; confirma que fuentes, widgets y efectos cambian con el megagrupo y que Quick-Alt continúa global.
8. Publica un sticker, instálalo desde otra cuenta y comprueba sus permisos; prueba los cuatro ámbitos de visibilidad de emoji personal.
9. Activa Megacompactación únicamente después de Compactar paneles, en escritorio y móvil.

## Limitaciones conocidas
- Cada archivo del lote produce un mensaje independiente; solo el primero lleva la descripción del compositor.
- La reproducción de vídeo depende de códecs admitidos por el navegador/dispositivo.
- La fecha de última actividad es aproximada.
- El buzón `Nexus (App)` es interno y no utiliza una cuenta Auth ficticia.
- Se necesita validación real con Supabase y dos o más dispositivos antes de considerarla estable.
