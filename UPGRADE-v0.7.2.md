# Nexus v0.7.2 — hotfix de imágenes y fuentes

Esta actualización corrige cargas de imagen/fuente en navegadores que informan `File.type` como `application/octet-stream` (común en algunos entornos Linux).

## Actualizar
1. Haz una copia de seguridad del repositorio y de Supabase.
2. En Supabase → SQL Editor ejecuta una vez `supabase/migrations/20261101_nexus_v072_profile_asset_mime.sql`. La migración es idempotente.
3. Sube el contenido de esta carpeta `nexus-chat` a la raíz del repositorio GitHub Pages.
4. Conserva tu `assets/js/config.js`.
5. Recarga Nexus con Ctrl+F5. El `index.html` ahora carga `app.js?v=0.7.2-profile-asset-mime` para evitar reutilizar el JavaScript anterior.

## Qué cambia
- Ya no utiliza `File.type` para decidir si una imagen/fuente es válida.
- Comprueba la firma binaria real del archivo (PNG, JPEG, GIF, WebP, WOFF, WOFF2 o TTF).
- Sube imágenes y fuentes como `Blob` con MIME explícito.
- Mantiene el límite de 8 MB y la lista MIME cerrada del bucket `profile-media`.
- No permite `application/octet-stream` en Storage.

## Prueba recomendada
Prueba primero un PNG o JPG de menos de 8 MB para avatar, después banner y finalmente un TTF. Si falla, copia el mensaje completo del aviso y el navegador/versión.
