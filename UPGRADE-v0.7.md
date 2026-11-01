# Nexus v0.7 — actualización desde v0.6

## Antes de actualizar
1. Haz una copia de seguridad de Supabase y del repositorio.
2. Confirma que ya ejecutaste las migraciones de v0.2 a v0.6, en ese orden.
3. Ejecuta una sola vez `supabase/migrations/20261103_nexus_v07_media_workshop_voice_push.sql` en SQL Editor.
4. Sustituye los archivos del frontend con el contenido de este paquete. Conserva tu `assets/js/config.js`.
5. Copia `GIPHY_API_KEY` desde `assets/js/config.js.example` a tu `config.js` y pega la clave beta de GIPHY.
6. Añade `VAPID_PUBLIC_KEY` a `config.js` si vas a activar Web Push. La clave privada nunca debe estar en el frontend.

## GIFs de GIPHY (sin coste para pruebas)
- Crea una cuenta de desarrollador y una API key beta en https://developers.giphy.com/dashboard/.
- Las claves beta documentadas permiten 100 búsquedas/llamadas por hora. La integración usa clasificación `pg` y atribución visible `Powered by GIPHY`.
- La documentación de GIPHY requiere que Search/Trending se invoquen desde el cliente; por eso la clave API aparece en `config.js`. Es una clave de API pública, no una contraseña ni una clave de servidor. No reutilices una clave privada de otro servicio.
- Pega la clave en `GIPHY_API_KEY` de `assets/js/config.js`. No necesitas desplegar una Edge Function ni configurar secretos de GIPHY en Supabase.

## Web Push (navegador cerrado)
1. Genera un par VAPID con `npx web-push generate-vapid-keys`.
2. Guarda la clave pública en `window.NEXUS_CONFIG.VAPID_PUBLIC_KEY`.
3. Guarda la privada en Supabase Secrets como `VAPID_PRIVATE_KEY`, junto con `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` y `PUSH_WEBHOOK_SECRET`.
4. Asegura que la Edge Function dispone de `SUPABASE_SERVICE_ROLE_KEY` como secreto del servidor; jamás se coloca en GitHub Pages. Si tu runtime usa la clave secreta nueva de Supabase, sigue la nota del README de la función.
5. Despliega `supabase/functions/send-web-push` con `supabase functions deploy send-web-push`. Esta función usa `verify_jwt = false`, pero exige el header secreto `x-nexus-webhook-secret`.
6. En Supabase → Database → Webhooks crea un webhook para `public.notifications`, evento INSERT, destino Edge Function `send-web-push`, con `Content-Type: application/json` y el header `x-nexus-webhook-secret: <PUSH_WEBHOOK_SECRET>`.
7. Cada navegador/dispositivo debe activar los avisos desde la campana y aceptar el permiso. Al cerrar sesión se elimina la suscripción push de ese navegador.

La clave privada VAPID y `PUSH_WEBHOOK_SECRET` son secretos. Nunca las compartas, pegues en `config.js` ni confirmes en Git.

## Voz WebRTC
- Supabase → Realtime → Settings: desactiva `Allow public access` para exigir canales privados.
- El cliente crea como privados los tópicos de amigos, bandeja, notificaciones, conversaciones, canales y voz. La migración crea políticas RLS de pertenencia para cada tema y para `nexus-voice:<channel-uuid>`.
- El cliente utiliza P2P mesh de hasta 6 participantes con STUN público por defecto. Esto no garantiza conexión en todas las redes. Para redes con NAT estricta se necesita un servidor TURN; usa credenciales TURN temporales proporcionadas por un backend, nunca credenciales permanentes en GitHub Pages.
- La voz necesita HTTPS, permiso de micrófono y una conexión de red compatible.

## Stickers y emojis
- La migración crea el bucket privado `nexus-assets` y valida el ámbito de los recursos.
- Los usuarios pueden subir PNG/JPG/WebP/GIF de hasta 5 MB.
- Los recursos personales solo se comparten con un chat después de usarlos en un mensaje; los recursos de conversación/megagrupo se limitan a sus miembros.

## Workshop
- Las valoraciones permiten una puntuación de 1–5 por persona y preset. No se puede valorar el propio preset.
- Los presets de megagrupo solo se aplican cuando eres propietario del megagrupo seleccionado.

## Prueba recomendada
Con dos cuentas, probar subir un emoji y un sticker personal, compartir un sticker de grupo, buscar y enviar un GIF, valorar un preset, activar push en dos navegadores, y conectar/desconectar en un canal de voz. No marques la versión como producción hasta probar esas acciones contra tu Supabase real.
