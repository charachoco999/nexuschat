# Nexus v0.13.1-alpha1 · Cloudflare Edge

## Novedades

- Preparación de publicación de la web en Cloudflare Pages mediante `chat.nexuscollective.app`.
- Worker Edge en `api.nexuscollective.app` con autenticación de peticiones mediante las sesiones actuales de Supabase.
- Integración con R2 para nuevas subidas de `chat-media`, `nexus-assets` y `profile-media`.
- URLs temporales firmadas para objetos privados y URLs públicas para `profile-media`.
- Reutilización de las funciones de autorización de Supabase mediante una RPC nueva; no se desactiva RLS ni se exponen buckets privados.
- Durable Objects/WebSockets para eventos INSERT/UPDATE/DELETE de `messages`.
- Distribución de notificaciones a destinatarios autorizados, mediante una RPC server-only compacta.
- Backfill opcional e idempotente para copiar medios existentes a R2 y migrar URLs públicas de perfil.
- SQL opcional separado para retirar únicamente `public.messages` de `supabase_realtime` después de validar Edge.
- Se conserva el sistema de traducciones de v0.12.0 y el hotfix v0.12.1.

## Sin cambios en esta fase

- Supabase Auth, PostgreSQL, historial, RLS y el resto de tablas.
- Reacciones, encuestas, lecturas, presencia, typing y señalización de voz en Supabase Realtime.
- Web Push y la infraestructura de voz/WebRTC.
- Los objetos originales de Supabase no se eliminan automáticamente.

## Importante

Los interruptores `EDGE_MEDIA_ENABLED` y `EDGE_REALTIME_ENABLED` vienen desactivados en `config.js.example`. Configura Cloudflare, ejecuta la migración SQL y crea el Database Webhook antes de activarlos. Sigue `CLOUDFLARE-EDGE-MIGRATION-v0.13.1-alpha1.md`.

Esta es una versión alpha: validación estática, pendiente de prueba contra las cuentas reales del proyecto.
