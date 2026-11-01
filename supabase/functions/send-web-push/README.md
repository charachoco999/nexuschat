# send-web-push

Invoked by a Supabase Database Webhook on `public.notifications` INSERT. It is not a browser endpoint.

Required Edge Function secrets:

- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` (server-side secret; never expose either in the browser)
- `PUSH_WEBHOOK_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (for example `mailto:contact@example.com`)

Deploy with `supabase functions deploy send-web-push`. Set `verify_jwt = false` for this function only and require the custom `x-nexus-webhook-secret` header configured on the Database Webhook. Never expose the private VAPID key, webhook secret, service-role key, or secret key in the website.
