# Actualizar Nexus v0.11.0-alpha1-hotfix2 → hotfix3

Esta actualización corrige la validación de avisos globales y elimina la antigua barra de avisos del encabezado de los canales.

## Antes de empezar

1. Haz una copia del repositorio.
2. Conserva `assets/js/config.js`.
3. Comprueba que ya está instalada la migración de `hotfix2` para avisos globales y envíos a múltiples megagrupos.

## 1. Migración SQL

En Supabase → SQL Editor, ejecuta una sola vez:

`supabase/migrations/20261104_nexus_v0110_hotfix3_announcement_validation.sql`

La migración reemplaza `create_nexus_important_announcement` con validación explícita:
- El título debe tener entre 3 y 100 caracteres.
- El mensaje debe tener entre 5 y 3000 caracteres.
- Los espacios al principio y al final se eliminan antes de insertar.

No crea ni elimina tablas y no modifica datos existentes, RLS o permisos.

## 2. Publicar la web

1. Descomprime `nexus-chat-v0.11.0-alpha1-hotfix3-upgrade.zip`.
2. Sube el contenido de `nexus-chat/` a la raíz de tu repositorio de GitHub Pages y acepta sustituir archivos.
3. No reemplaces `assets/js/config.js`.
4. Fuerza una recarga con `Ctrl + F5` en escritorio. En móvil, cierra la pestaña/PWA y vuelve a abrirla.

## 3. Pruebas recomendadas

1. Como administrador, intenta publicar un aviso global con menos de 5 caracteres: ahora debe aparecer un mensaje de validación claro y no un error de Postgres.
2. Publica un aviso global válido y comprueba que aparece una sola vez por cuenta.
3. Envía un aviso a uno o varios megagrupos y verifica que aparece como mensaje en el historial de los canales suscritos.
4. Abre un canal que antes mostraba el banner superior: la barra antigua ya no debe aparecer.
5. Comprueba que los mensajes normales y los avisos automatizados siguen mostrándose en el historial.
