# Nexus v0.13.0-alpha1 · Cloudflare Edge Migration

Esta entrega prepara Nexus para publicarse en `https://chat.nexuscollective.app` y añade una primera capa Cloudflare para multimedia y distribución de mensajes.

## Objetivo y límites

- Cloudflare Pages sirve la aplicación web.
- Cloudflare Worker se publica en `https://api.nexuscollective.app`.
- Cloudflare R2 almacena los nuevos archivos de chat, recursos personalizados y medios de perfil.
- Durable Objects distribuye por WebSocket los eventos INSERT/UPDATE/DELETE de `public.messages`.
- Supabase sigue siendo la fuente de verdad: Auth, PostgreSQL, RLS, historial, perfiles, permisos, denuncias, reacciones, encuestas y el resto de tablas.
- El resto de los canales Realtime de Supabase continúa activo en esta fase (reacciones, lecturas, encuestas, presencia, typing y voz).

Los interruptores de Edge están desactivados por defecto. No los actives hasta completar los pasos de Cloudflare, SQL y Webhook. El proyecto no se conecta ni despliega automáticamente en las cuentas del propietario; hay que introducir sus credenciales en los paneles indicados.

## 0. Antes de tocar nada

1. Haz una copia de seguridad del repositorio.
2. En Supabase, crea un backup de la base de datos y confirma que las migraciones previas de Nexus están aplicadas.
3. No borres los buckets de Supabase ni desactives RLS.
4. Conserva `assets/js/config.js`. Este archivo personal no se incluye en el ZIP.
5. No publiques ninguna `service_role key`, clave SMTP ni secreto de Cloudflare en GitHub, en `config.js` o en el navegador.

El 104 % de egress ya consumido no desaparece al desplegar esta versión. El propósito es reducir el tráfico futuro. Comprueba en Supabase Usage qué métrica está excedida y las restricciones exactas del plan antes del corte.

## 1. DNS y dominios

Separa los tres usos:

| Hostname | Servicio | Uso |
|---|---|---|
| `nexuscollective.app` | Se conserva | Dominio principal |
| `chat.nexuscollective.app` | Cloudflare Pages | Aplicación Nexus |
| `api.nexuscollective.app` | Cloudflare Worker | API, R2 y WebSockets |
| `mail.nexuscollective.app` | Resend | Envío de correo |

La zona DNS `nexuscollective.app` debe estar activa en Cloudflare y sus nameservers deben estar delegados a Cloudflare. Si el dominio todavía utiliza el DNS de otro proveedor, primero habrá que migrar la gestión DNS sin perder los registros existentes.

### Pages: `chat.nexuscollective.app`

1. En Cloudflare, abre **Workers & Pages → Create → Pages → Connect to Git**.
2. Selecciona el repositorio de Nexus y la rama de producción.
3. Framework preset: **None**.
4. Build command: vacío (la aplicación es estática).
5. Build output directory: `.` si `index.html` está en la raíz del repositorio conectado.
6. Completa el primer despliegue.
7. En el proyecto Pages, abre **Custom domains → Set up a custom domain** y añade `chat.nexuscollective.app`.
8. Si `chat` ya apunta a GitHub Pages, elimina únicamente el registro DNS antiguo de `chat` cuando Pages solicite el cambio. No toques los registros del dominio raíz ni los de `mail`.

Pages debe crear/validar el registro DNS y el certificado. Comprueba que `https://chat.nexuscollective.app` sirve `index.html` y que `assets/js/config.js` sigue existiendo en el despliegue (el fichero real se conserva en el repositorio privado; no se sustituye por el ejemplo).

### Worker: `api.nexuscollective.app`

El archivo `cloudflare/worker/wrangler.toml` ya declara `api.nexuscollective.app` como Custom Domain. Wrangler crea el vínculo DNS y el certificado durante el despliegue. Si hay un registro A/AAAA/CNAME antiguo para `api`, resuélvelo antes de desplegar; no puede existir un conflicto con el Custom Domain.

### Resend: `mail.nexuscollective.app`

Conserva sin cambios los TXT, DKIM, SPF, MX y demás registros que Resend te haya mostrado. No sustituyas un SPF existente: si tienes más de un proveedor de envío, debe existir un solo registro SPF combinado en el hostname correspondiente. No actives el proxy de Cloudflare en registros de correo; déjalos como DNS Only cuando el panel permita elegirlo. Espera a que Resend marque el dominio como **Verified** antes de cambiar el SMTP de Supabase.

## 2. Preparar R2 y desplegar el Worker

Requisitos: Node.js 20 o posterior, npm, cuenta Cloudflare y permisos para crear Workers/R2.

Desde una terminal:

```bash
cd nexus-chat/cloudflare/worker
npm install
npx wrangler login
npx wrangler r2 bucket create nexus-edge-media
```

Si el bucket ya existe, no vuelvas a crearlo. Mantén `nexus-edge-media` privado: no actives el dominio público `r2.dev` ni hagas público el bucket; los objetos se sirven a través del Worker con URL firmada (salvo `profile-media`, que ya es público en la aplicación). Abre `wrangler.toml` y sustituye `REPLACE_WITH_PROJECT_REF` por el identificador del proyecto Supabase. La URL debe tener el formato `https://<project-ref>.supabase.co`.

Añade los secretos al Worker. Ejecuta cada orden y pega el valor cuando Wrangler lo solicite:

```bash
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put MEDIA_SIGNING_SECRET
npx wrangler secret put EDGE_WEBHOOK_SECRET
npx wrangler secret put EDGE_INTERNAL_SECRET
```

- `SUPABASE_ANON_KEY`: clave publicable/anon del proyecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clave privada de servidor. Nunca va al cliente ni al repositorio.
- `MEDIA_SIGNING_SECRET`: secreto aleatorio largo para firmar URLs privadas.
- `EDGE_WEBHOOK_SECRET`: secreto aleatorio largo que también configurarás en el header del Database Webhook.
- `EDGE_INTERNAL_SECRET`: secreto aleatorio largo para las llamadas internas Worker ↔ Durable Object.

Genera tres secretos distintos (por ejemplo, 32 bytes aleatorios cada uno). No reutilices la clave SMTP o la `service_role` como secreto de firma.

Despliega:

```bash
npx wrangler deploy
```

Comprueba:

```bash
curl https://api.nexuscollective.app/health
```

Debe devolver JSON con `ok: true` y `service: "nexus-edge"`. Esto solo comprueba que el Worker responde; todavía no valida permisos, WebSockets ni el webhook. Mantén abierta otra terminal para observar errores:

```bash
npx wrangler tail nexus-edge
```

## 3. SQL de Supabase

Comprueba antes que ya aplicaste la migración de Channels+ `20261104_nexus_v0110_forums_channels_plus_announcements_badges.sql`; la autorización Edge reutiliza `can_access_community_channel`.

En **Supabase → SQL Editor**, ejecuta una sola vez:

`supabase/migrations/20261117_nexus_v013_edge_authorization_and_recipients.sql`

Añade cuatro funciones auxiliares y actualiza tres comprobaciones de permisos existentes para que respeten Channels+:

- `nexus_edge_authorize_media`: utiliza las funciones de permisos existentes para autorizar R2 sin abrir los buckets ni desactivar RLS.
- `nexus_edge_message_recipients`: devuelve los IDs de destinatarios en una única llamada de servidor para las notificaciones de mensajes y respeta los permisos `view_channel` de Channels+.
- `nexus_edge_can_view_channel_for_user`: evalúa el permiso de lectura de canal para un destinatario concreto; solo la función de servidor puede invocarla.
- `nexus_edge_media_owner_lookup`: permite al backfill preservar el propietario original de archivos de chat como metadata privada de R2.

Las tres funciones auxiliares de destinatarios/permisos/propiedad solo se conceden a `service_role`; la RPC de autorización multimedia se concede a `authenticated` y comprueba los permisos de cada usuario. La migración no cambia mensajes, cuentas, contraseñas ni tablas de historial.

No ejecutes todavía `20261117_nexus_v013_cutover_messages_from_realtime.sql`. Es el paso final y opcional cuando el webhook y el cliente Edge estén probados.

## 4. Crear Database Webhook para mensajes

En Supabase abre **Database → Webhooks → Create a new hook** (el nombre de menú puede variar ligeramente):

- Name: `nexus-edge-messages`
- Table: `public.messages`
- Events: `INSERT`, `UPDATE`, `DELETE`
- Type: HTTP Request / POST
- URL: `https://api.nexuscollective.app/api/webhooks/supabase/messages`
- Header: `x-nexus-edge-secret: <el mismo valor de EDGE_WEBHOOK_SECRET>`
- Content-Type: `application/json`

Guarda el webhook. No añadas `SELECT`. El webhook debe enviar los eventos de la tabla `messages` después de los cambios de fila. Las notificaciones de los miembros se distribuyen mediante Durable Objects; el historial sigue leyéndose de PostgreSQL.

Haz una prueba controlada con dos cuentas: inserta un mensaje, edítalo y bórralo en una conversación de prueba. Revisa `wrangler tail` para confirmar que los tres eventos llegan y que el Worker devuelve 200. No elimines todavía `messages` de la publicación Realtime.

## 5. Configuración de la aplicación

En tu copia privada, edita `assets/js/config.js` (no `config.js.example`) y añade estas propiedades dentro de `window.NEXUS_CONFIG`:

```js
NEXUS_EDGE_URL: 'https://api.nexuscollective.app',
EDGE_MEDIA_ENABLED: false,
EDGE_REALTIME_ENABLED: false,
```

Publica primero con los dos interruptores en `false`. Comprueba que la página, el login y las funciones existentes siguen funcionando en `chat.nexuscollective.app`.

Después, activa únicamente multimedia:

```js
EDGE_MEDIA_ENABLED: true,
EDGE_REALTIME_ENABLED: false,
```

Prueba con dos cuentas y un archivo de prueba en cada contexto: MD, grupo, canal de megagrupo y recursos personalizados. Prueba también avatar/foto de perfil y una descarga de vídeo/audio. La URL de los archivos privados debe ser temporal y no debe abrirse desde una sesión sin permisos. Los archivos antiguos todavía se leen desde Supabase cuando no existan en R2.

Una vez superadas esas pruebas y el webhook esté respondiendo, activa mensajería:

```js
EDGE_MEDIA_ENABLED: true,
EDGE_REALTIME_ENABLED: true,
```

Publica los cambios y prueba INSERT, UPDATE y DELETE en MD, grupo y canal. Comprueba que el mensaje del remitente también aparece en su sala; los contadores y el historial deben seguir consultando Supabase.

## 6. Corte de `messages` en Supabase Realtime (solo tras pruebas)

Cuando el cliente Edge y el webhook funcionen de forma estable:

1. Mantén `EDGE_REALTIME_ENABLED: true`.
2. En SQL Editor ejecuta una sola vez `supabase/migrations/20261117_nexus_v013_cutover_messages_from_realtime.sql`.
3. Comprueba que el resto de las funciones Realtime sigue funcionando: reacciones, encuestas, lecturas, presencia y typing.

Este script retira únicamente `public.messages` de `supabase_realtime`. No desactiva la extensión Realtime ni otras tablas. El webhook de base de datos no depende de la publicación `supabase_realtime`.

## 7. Trasladar archivos antiguos (backfill opcional)

Las nuevas subidas se guardan en R2 cuando `EDGE_MEDIA_ENABLED` está activo. Los mensajes antiguos mantienen sus rutas originales y el cliente busca el objeto en R2; si todavía no está copiado, utiliza el archivo de Supabase.

La herramienta `tools/r2-migrate/` copia objetos existentes a R2 y, opcionalmente, reescribe las URLs públicas de perfil. Por defecto requiere credenciales y realiza una simulación; no descarga bytes mientras no se use `--execute`.

```bash
cd nexus-chat/tools/r2-migrate
cp .env.example .env
# Completa .env con Supabase service_role y credenciales S3 de R2.
npm install
node migrate.mjs --buckets=chat-media,nexus-assets,profile-media
```

Cuando tengas margen de egress suficiente (por ejemplo, tras el reinicio del ciclo o al resolver el límite del plan), ejecuta:

```bash
node migrate.mjs --execute --buckets=chat-media,nexus-assets,profile-media --rewrite-profiles
```

La copia usa claves R2 `chat-media/<ruta>`, `nexus-assets/<ruta>` y `profile-media/<ruta>`, conserva la propiedad de los archivos de chat como metadata y no borra los objetos originales de Supabase. `--rewrite-profiles` solo actualiza URLs públicas si el objeto ya existe en R2. El script es idempotente: omite objetos que ya existen.

No ejecutes un backfill completo mientras el egress esté por encima del límite o la base de datos esté bajo una restricción de solo lectura; copiar archivos antiguos provoca una descarga única desde Storage y puede empeorar temporalmente el egress. La fase de migración en caliente de nuevas subidas es distinta y evita seguir enviando los nuevos archivos a Supabase.

## 8. Supabase Auth y correo Resend

En **Authentication → URL Configuration**:

- Site URL: `https://chat.nexuscollective.app`
- Redirect URLs: añade `https://chat.nexuscollective.app/**` y, si el panel lo requiere, también la URL exacta `https://chat.nexuscollective.app/`.

No elimines otros redirects que utilice un entorno de pruebas o la aplicación Desktop; añade el nuevo host de producción.

Cuando Resend marque `mail.nexuscollective.app` como Verified, en **Authentication → SMTP Settings** configura:

- Host: `smtp.resend.com`
- Port: `465` (SSL) o `587` (STARTTLS)
- Username: `resend`
- Password: una API key de Resend con permiso de envío
- Sender email: `no-reply@mail.nexuscollective.app`
- Sender name: `Nexus`

La API key SMTP se introduce en el panel de Supabase, nunca en el JavaScript del navegador ni en este paquete. Conserva los registros DNS de Resend.

## 9. Rollback

### Si falla Edge Messaging

Antes de desactivar `EDGE_REALTIME_ENABLED`:

1. Ejecuta `supabase/rollback/20261117_nexus_v013_cutover_messages_from_realtime.sql` para volver a publicar `messages` en Supabase Realtime (si ejecutaste el corte).
2. Cambia `EDGE_REALTIME_ENABLED: false` en `assets/js/config.js` y publica la web.
3. Comprueba la recepción de mensajes con dos cuentas.

No borres el Worker ni el webhook hasta comprobar que los clientes han vuelto a la ruta antigua.

### Si falla Edge Media

Cambia `EDGE_MEDIA_ENABLED: false` para que las nuevas subidas vuelvan a Supabase. Mantén el Worker y R2 disponibles mientras existan mensajes, assets o perfiles con rutas `edge/` o URLs `api.nexuscollective.app`; esas rutas todavía necesitan el Worker para servirse. No borres objetos R2 ni cambies los registros DNS sin haber restaurado esas rutas.

### Retirar las funciones SQL

No ejecutes `supabase/rollback/20261117_nexus_v013_edge_authorization_and_recipients.sql` como parte de un rollback rápido. Ese fichero restaura las funciones SQL anteriores, pero las rutas nuevas `edge/` y los archivos R2 no vuelven automáticamente a Supabase. Solo úsalo durante una retirada planificada, después de copiar de vuelta a Supabase los objetos R2, normalizar las rutas almacenadas (`messages.attachment.path`, `custom_assets.asset_url` y URLs de perfil), verificar que los clientes antiguos pueden abrirlos y confirmar que ningún cliente usa Edge. Esta alpha no incluye una herramienta automática de copia R2 → Supabase.

## 10. Qué se reduce y qué permanece

- Las nuevas descargas de multimedia migrada salen desde R2, cuyo egress directo no se factura.
- Los eventos de filas `messages` se entregan por un webhook por cambio y WebSockets a salas activas, en vez de distribuir cada cambio mediante Postgres Changes a cada cliente suscrito.
- Auth, consultas de historial, listas, perfiles y otros datos siguen usando Supabase. Esta versión no elimina todo el egress de Database.
- Reacciones, encuestas, lecturas, presencia, typing, otros cambios y voz continúan usando Realtime de Supabase durante esta fase.
- La ruta global de notificaciones de mensajes se entrega solo a clientes activos y miembros autorizados. Las conexiones WebSocket vuelven a validar permisos cada 60 segundos al renovar el ticket; si se revoca la pertenencia, el socket se cierra al renovar. Las notificaciones push con navegador cerrado siguen siendo el sistema Web Push actual.

## Estado de verificación

Esta entrega ha sido revisada estáticamente y los archivos JavaScript se validan con `node --check`. No ha sido desplegada en las cuentas reales de Cloudflare/Resend/Supabase ni probada contra la base de datos real. La aceptación final requiere completar las pruebas del apartado 5 antes de retirar `messages` de Realtime.
