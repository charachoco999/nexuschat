# Nexus Edge Worker

Este Worker gestiona R2, enlaces firmados y WebSockets de Nexus. Consulta la guía raíz `CLOUDFLARE-EDGE-MIGRATION-v0.13.1-alpha1.md` para la configuración completa.

## Local

1. Copia `.dev.vars.example` como `.dev.vars` y completa los valores privados.
2. Sustituye el placeholder `SUPABASE_URL` de `wrangler.toml`.
3. Crea el bucket `nexus-edge-media` en R2.
4. Ejecuta `npm install` y `npm run dev`.

## Deploy

```bash
npm install
npx wrangler login
npx wrangler r2 bucket create nexus-edge-media
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put MEDIA_SIGNING_SECRET
npx wrangler secret put EDGE_WEBHOOK_SECRET
npx wrangler secret put EDGE_INTERNAL_SECRET
npx wrangler deploy
```

`wrangler.toml` configura `api.nexuscollective.app` como Custom Domain y registra el Durable Object `NexusRoomHub`. Wrangler debe desplegar la migración inicial SQLite del Durable Object la primera vez.
