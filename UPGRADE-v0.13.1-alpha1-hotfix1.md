# Nexus v0.13.1-alpha1-hotfix1 — instalación

Esta actualización corrige las subidas a Cloudflare R2. No requiere cambios SQL.

## Aplicación

1. Actualiza el repositorio con `git pull`.
2. Despliega la web en Cloudflare Pages.
3. Entra en `nexus-chat/cloudflare/worker`.
4. Ejecuta `npm install` y `npx wrangler deploy` para publicar el Worker corregido.
5. No cambies los secretos, el bucket `MEDIA`, el binding `ROOMS` ni las migraciones Durable Object existentes.

## Comprobación

Abre `https://api.nexuscollective.app/health`. Debe devolver `service: "nexus-edge"` y `version: "0.13.1-alpha1-hotfix1"`.

Prueba después una imagen pequeña, un archivo y un audio. Comprueba que aparecen en el chat y que se pueden volver a descargar.

## Alcance y limitaciones de verificación

- Sin migración SQL.
- Sin cambios en Auth, RLS, permisos de canales, historial o Durable Objects.
- Se mantienen los límites de tamaño por bucket: chat-media 50 MiB, nexus-assets 5 MiB y profile-media 8 MiB.
- La corrección se ha revisado estáticamente; la subida end-to-end debe verificarse en la instancia real de Cloudflare.
