# Actualizar Nexus v0.12.1 → v0.13.0-alpha1

1. Haz copia del repositorio y backup de Supabase.
2. Despliega Pages en `chat.nexuscollective.app` y el Worker en `api.nexuscollective.app` siguiendo `CLOUDFLARE-EDGE-MIGRATION-v0.13.0-alpha1.md`.
3. Conserva `assets/js/config.js`; añade `NEXUS_EDGE_URL`, `EDGE_MEDIA_ENABLED` y `EDGE_REALTIME_ENABLED` con ambos booleanos en `false`.
4. Confirma que la migración de Channels+ `20261104_nexus_v0110_forums_channels_plus_announcements_badges.sql` ya está aplicada y ejecuta una vez `supabase/migrations/20261117_nexus_v013_edge_authorization_and_recipients.sql`.
5. Crea el Database Webhook para INSERT/UPDATE/DELETE de `public.messages`.
6. Prueba el sitio y el Worker. Activa primero `EDGE_MEDIA_ENABLED`; después de probarlo, activa `EDGE_REALTIME_ENABLED`.
7. Solo cuando los eventos de mensajes funcionen de forma estable, ejecuta `supabase/migrations/20261117_nexus_v013_cutover_messages_from_realtime.sql`.
8. Conserva los registros DNS de Resend y no cambies el SMTP de Supabase hasta que `mail.nexuscollective.app` aparezca como Verified.
9. No hagas el backfill de archivos antiguos mientras el egress esté excedido. La herramienta `tools/r2-migrate/` es opcional y tiene simulación por defecto.

No migra la base de datos a D1, no cambia Auth ni elimina archivos originales. Consulta la guía completa para DNS, SMTP/Resend, secretos y rollback.
