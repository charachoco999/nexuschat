# Actualizar Nexus v0.10.2-alpha1 → v0.11.0-alpha1

Esta actualización abre la rama web/móvil 0.11. No modifica Nexus Desktop.

## Antes de empezar

1. Haz una copia del repositorio y un backup de la base de datos de Supabase.
2. Confirma que tu instalación está en v0.10.2-alpha1 y que el **SQL Repair Bundle de 0.10.2 terminó correctamente**. La reparación de 0.10.2 debe haber creado `profiles.last_seen_at`, y las tablas de perfiles por megagrupo, Workshop, feedback y moderación.
3. No vuelvas a ejecutar las migraciones 0.10.2 si ya se aplicaron correctamente.
4. Conserva `assets/js/config.js`; no reemplaces tus credenciales locales por `config.js.example`.

Si las migraciones 0.10.2 siguen fallando o faltan tablas, detén la actualización y corrige primero esa versión. El ZIP completo incluye las versiones reparadas de esos archivos para instalaciones nuevas, pero no sustituye el estado real de tu base de datos.

## 1. Migración SQL de 0.11

En Supabase → SQL Editor, ejecuta una sola vez:

`supabase/migrations/20261104_nexus_v0110_forums_channels_plus_announcements_badges.sql`

La migración crea:

- Overrides de Channels+ por miembro y rol, con validación de permisos en RLS y Realtime.
- Foros y tableros de megagrupo.
- Avisos importantes globales y por megagrupo.
- Solicitudes de insignias y notificaciones de estado.
- Historial de moderación para el resumen de reputación.

No ejecutes otra vez `NEXUS-v0.10.2-SQL-REPAIR-BUNDLE.sql` si ya se ejecutó correctamente.

## 2. Publicar la web

1. Descomprime `nexus-chat-v0.11.0-alpha1-upgrade.zip`.
2. Sube el contenido de la carpeta `nexus-chat/` a la raíz del repositorio de GitHub Pages y acepta sustituir los archivos.
3. Conserva tu `assets/js/config.js`.
4. Espera al despliegue y fuerza la recarga con `Ctrl + F5` en escritorio. En móvil, cierra la pestaña o aplicación instalada y vuelve a abrirla.

## 3. Comprobaciones recomendadas

1. En un MD, añade dos archivos y un texto, marca spoiler y comprueba que se envíen en un solo mensaje. Repite en un canal.
2. Envía un bloque de código con `&&lang=true` y comprueba que aparezca la etiqueta del lenguaje.
3. Abre un chat con muchas imágenes; entra desde abajo, sube por el historial y comprueba que ImageCulling cargue los medios al acercarte. Prueba también desactivarlo desde Optimización.
4. Como administrador del megagrupo, crea una categoría de Foros. Con una segunda cuenta, crea un tablero y prueba `#Foros/Tablero/`.
5. En Channels+, asigna `view_channel`, `send_messages` y `attach_files` a un miembro y a un rol. Comprueba que los permisos efectivos se cumplen desde una segunda cuenta y que no basta con ocultar botones.
6. Publica un aviso global y uno de megagrupo. Comprueba que el segundo solo aparezca en canales con recepción activada.
7. Solicita una insignia con una cuenta normal; desde el panel de plataforma, cambia su estado y comprueba las notificaciones.
8. Emite un warn, un mute temporal y un ban de prueba. Revisa el buzón `Nexus (App)` y el apartado Reputación; retira después las sanciones de prueba.
9. Activa Megacompactación con Compactar paneles y revisa Chats, Amigos y Workshops en móvil y escritorio.
10. Comprueba que las ventanas de confirmación, avisos y novedades se comportan bien. Activa los diálogos nativos en Optimización y repite.
11. Verifica que solo una cuenta con `is_platform_admin()` pueda abrir el panel de plataforma y publicar avisos globales.

## 4. Estado de compatibilidad

- Esta entrega es **v0.11.0-alpha1**, no una versión estable.
- La migración SQL se ha revisado estáticamente, pero no se ha ejecutado contra tu base de datos real.
- La compilación no incluye servicios TURN, credenciales, claves privadas ni cambios en Desktop.
- El panel separado requiere que los administradores de plataforma estén configurados con el rol global `admin` que reconoce `is_platform_admin()`.
