# Nexus v0.7.1 — actualización desde v0.7

Esta es una actualización pequeña que corrige la subida de fuentes WOFF, WOFF2 y TTF. No requiere repetir migraciones anteriores.

1. Haz una copia de seguridad.
2. Ejecuta `supabase/migrations/20261104_nexus_v071_font_mime.sql` en Supabase SQL Editor.
3. Sube el contenido de `nexus-chat` a la raíz del repositorio, sobrescribiendo los archivos existentes.
4. Conserva `assets/js/config.js`.
5. Espera el despliegue y abre Nexus de nuevo. El script usa una URL versionada para evitar la caché anterior.
6. Prueba con un `.ttf`, `.woff` o `.woff2` de menos de 8 MB.

Consulta `FONT-MIME-v0.7.1.md` si Supabase sigue rechazando el MIME.
