> **Nexus v0.11.0-alpha1-hotfix3:** valida avisos globales antes de insertarlos y elimina del encabezado del canal las antiguas barras de avisos; los avisos importantes de megagrupo deben aparecer como mensajes del canal. Requiere una migración SQL pequeña; consulta `UPGRADE-v0.11.0-alpha1-hotfix3.md`.

> **Nexus v0.11.0-alpha1-hotfix2:** corrige anuncios repetidos, entrega avisos de megagrupo como mensajes reales, mantiene la voz activa al navegar, mejora los tooltips, amplía `glow:` y añade More Sounds y MarkdownUI BETA. Requiere una migración SQL adicional; consulta `UPGRADE-v0.11.0-alpha1-hotfix2.md`.

> **Nexus v0.11.0-alpha1-hotfix1:** corrige la megacompactación real: una barra de categorías y la lista de MDs comparten una única columna lateral; en móviles la barra se adapta a la navegación de una sola columna. La entrega no cambia la base de datos.
>
> **Base funcional:** v0.11.0-alpha1: añade ImageCulling, foros, Channels+, avisos importantes, solicitudes de insignias, popups temáticos y mejoras de carga. Esta entrega es alpha y requiere la nueva migración SQL. Consulta `UPGRADE-v0.11.0-alpha1.md` antes de actualizar.
# Nexus — chat y comunidades

Nexus es una plataforma web en evolución para mensajes y megagrupos. La interfaz se publica como web estática; un backend Supabase proporciona autenticación, PostgreSQL, almacenamiento privado y actualizaciones en tiempo real.

## Nexus v0.11.0-alpha1

Esta versión abre la rama 0.11 para web y móvil. Desktop permanece sin cambios. La entrega es alpha y debe probarse con el proyecto real antes de considerarla estable.

### Añadido en alpha1

- Adjuntos preparados en el compositor, enviados junto al texto en un mismo mensaje y con opción de spoiler.
- Etiquetas de lenguaje en bloques de código mediante `&&lang=true`.
- ImageCulling beta para cargar primero los medios cercanos al final de conversaciones largas.
- Foros de megagrupo con tableros creados por sus miembros y menciones por ruta.
- Channels+: permisos individuales por miembro y por rol, aplicados también mediante RLS.
- Avisos importantes globales y de megagrupo, con recepción configurable por canal.
- Solicitudes de insignias, notificaciones de revisión y estadísticas personales de moderación.
- Popups de sistema, confirmaciones propias y novedades de versión; se pueden sustituir por los diálogos nativos del navegador.
- Hovers+ temáticos, carga inicial con logo animado y barra Megacompactación revisada.
- Revisión de textos y documentación de optimización.

Consulta `UPGRADE-v0.11.0-alpha1.md` para la migración y las pruebas recomendadas.

## Nexus v0.10.2-alpha1

Esta entrega continúa la rama 0.10 para web y móvil. No es una versión 1.0 ni abre la rama 0.11. Nexus Desktop permanece sin cambios. Debe probarse junto con Supabase real antes de considerarla estable.

### Añadido en alpha.3

- Markdown con atributos combinables y anidables (hasta 256 niveles por seguridad), separadores, hover y spoilers locales o para todo el mensaje.
- Citas web/libro con formato APA 7 básico, botones externos, iconos HTTPS e invitaciones en forma de tarjeta.
- InputSync compartido entre miembros autorizados de un mensaje, con estados guardados por clave y actualización en tiempo real.
- NexCSS Beta: el usuario escribe CSS y Nexus muestra una página HTML de prueba automática en un iframe aislado, sin scripts, imports ni recursos externos.
- Tablas HTML simplificadas en texto, con soporte acotado para cabeceras/pie y colspan/rowspan; cada tabla advierte que la sintaxis sigue en beta.
- Bloques de código con botones para copiar y descargar, menciones clicables y bloques de canal globales o del megagrupo actual.
- Vistas previas para adjuntos CSV, TSV, XLS, XLSX y ODS, manteniendo el archivo original descargable.
- Mejoras de rendimiento al cargar InputSync en lote y exclusión de controles/enlaces interactivos del procesador automático de menciones.
- Ajustes de presentación para iconos de medallas globales y cajas agrupadas, con opción de compatibilidad para desactivar el ajuste de ancho/efectos.

### Añadido en alpha.2

- Mensajes consecutivos de la misma persona e identidad alternativa agrupados en una caja visual adaptable, con reacciones dentro del mismo bloque y opción para desactivar el agrupado.
- Personalización individual de los colores de fondo, paneles, superficies, texto, bordes y cajas de mensajes, además del color de acento existente.
- Más de 1.000 emojis estándar en el selector y posibilidad de reaccionar con emojis estándar o personalizados de los ámbitos disponibles.
- Migración para ampliar el campo de reacción y permitir identificadores de emojis personalizados.

Consulta `UPGRADE-v0.10-alpha2.md` para aplicar la migración y desplegar el parche de alpha2.

- Mensajes de audio grabados desde el compositor y reproducidos desde el chat.
- Compartir pantalla en canales de voz mediante WebRTC, cuando el navegador y el dispositivo lo permiten.
- Sonido de notificación personalizado guardado localmente en cada dispositivo.
- Categorías de canales de megagrupo y preferencias de notificación individuales por conversación/canal.
- Ajustes generales de notificación por MD, grupo y megagrupo, incluido el modo de solo menciones para megagrupos.
- Control de mensajes cargados inicialmente (25, 50, 75 o 100).
- Resaltado de sintaxis para bloques de código, tarjetas ligeras de vista previa de enlaces y fuente de mensajes independiente de la fuente del nombre.
- Markdown personalizado: `{red:text}`, `{color:#ff8800:text}`, `{size:24:text}`, `{font:serif:text}` y `{glow:blue:text}`.
- BoxGlow para mensajes y tarjetas de perfil.
- Medallas universales gestionadas exclusivamente por administradores de plataforma; cada usuario puede ocultar las suyas.
- Indicadores de dispositivo móvil/escritorio en presencia.

**Limitaciones de esta alpha:** la vista previa de enlaces muestra favicon, texto y dominio, no una tarjeta Open Graph completa con imagen y descripción. El sonido personalizado es local al dispositivo. Compartir pantalla depende de `getDisplayMedia`, HTTPS y compatibilidad del navegador; algunos navegadores móviles no lo ofrecen. La voz sigue utilizando P2P y STUN como en versiones anteriores, por lo que algunas redes pueden requerir TURN. Las notas de voz grabadas desde el compositor se generan como WAV PCM mono a 16 kHz mediante Web Audio, evitando diferencias de contenedor WebM/MP4 entre móviles. Los audios que el usuario adjunte como archivos conservan su formato original.

Consulta `UPGRADE-v0.10-alpha1.md` para aplicar la migración y desplegar.

> **Estado:** v0.10.0-alpha.3 continúa la versión web y móvil a partir de alpha.2. Desktop se mantiene sin cambios en su rama 0.9. No se requiere dominio ni servicio externo de pago para las funciones Markdown descritas.

## 1. Qué incluye esta versión

### Añadido en v0.5

- Ocultar/archivar conversaciones de forma individual y restaurarlas más tarde.
- Salir de conversaciones o grupos desde la bandeja sin borrar el historial para los demás participantes.
- Permite crear varias conversaciones independientes con la misma persona.
- Encuestas creadas mediante una función SQL transaccional: el mensaje y la encuesta se confirman juntos para evitar que Realtime muestre una tarjeta duplicada/incompleta.
- El fondo visual de un megagrupo también se aplica a canales de texto y de voz. Desde v0.7, los canales de voz permiten audio P2P WebRTC; su fiabilidad depende de la red y puede requerir TURN.
- Fichas públicas de perfil, aliases, nickname por megagrupo y hasta 32 widgets.
- Invitaciones compartibles con vencimiento y límites de uso.
- AutoAlly: solicitudes por ID de megagrupos privados y acceso a comunidades con alianza aceptada.
- Mensajes fijados y confirmaciones de lectura en conversaciones privadas y grupales.
- Permisos SQL de edición limitados a las columnas de perfil visual que necesita cada usuario.

Consulta `UPGRADE-v0.5.md` para la migración y las pruebas recomendadas.


### Añadido en v0.6

- Quick-Alt: crear, activar, eliminar y usar identidades alternativas vinculadas a la misma cuenta autenticada. Los mensajes muestran una marca ALT; la alt no tiene contraseña ni permisos propios.
- Importar fuente propia en WOFF, WOFF2 o TTF, con límite de 8 MB.
- Efecto GIF/imagen sobre el nombre, superposición visual del avatar y efecto de placa con opacidad ajustable. La placa aparece en mensajes, lista de MDs, lista de amigos, solicitudes y tarjetas de miembros.
- Workshop: publicar y aplicar presets de perfil o cliente. Los presets solo incluyen campos visuales permitidos, no credenciales ni datos privados.
- Autocompletado de menciones `@usuario` en MDs/grupos y `@usuario`/`@rol` en canales de megagrupo. La base de datos valida que las personas y roles mencionados pertenezcan al contexto.
- Notificaciones dentro de Nexus con sonido, icono de origen de MD/grupo/canal y resaltado de menciones. Los avisos de escritorio son opcionales cuando la pestaña está en segundo plano y el navegador concede permiso.
- Creación de invitaciones desde la ventana de configuración, con enlace visible y botón para copiar. La función permite al propietario o a los roles con `create_invites` generar links de 7 días y usos ilimitados.
- Conservación de códigos de invitación durante el registro y la confirmación del correo.
- Soporte de MIME limitado para las fuentes personalizadas en `profile-media`, sin aceptar `application/octet-stream` de forma genérica.

Consulta `UPGRADE-v0.6.md` para aplicar la migración y ejecutar las pruebas.

### Añadido en v0.7

- Bucket privado `nexus-assets` y selector de stickers/emojis personales, de conversación y de megagrupo.
- Emojis personalizados insertados mediante `:nombre:` y stickers como mensajes multimedia.
- Buscador GIPHY con clasificación `pg`, atribución visible y eventos de analítica de visualización, clic y envío. Requiere una clave beta en `GIPHY_API_KEY` de `config.js`.
- Valoraciones de Workshop de 1 a 5 estrellas, una por usuario y preset; el autor no puede valorar su propio preset.
- Service worker y Web Push opcional mediante VAPID y webhook de Supabase para avisos con Nexus cerrado.
- Salas de voz reales mediante WebRTC P2P y señalización privada de Supabase Realtime, con malla de hasta seis participantes.
- Canales Realtime privados para amigos, bandeja, notificaciones, conversaciones, megagrupos y voz, con políticas de pertenencia.

Consulta `UPGRADE-v0.7.md` para añadir la clave GIPHY, activar push y desplegar los servicios del servidor.

### Añadido en v0.8

- Historial paginado: 50 mensajes al entrar y carga progresiva de mensajes anteriores.
- Caché en memoria limitada por conversación, con sincronización incremental al volver a abrir el mismo chat.
- Consultas agrupadas para perfiles, roles, reacciones, encuestas, votos, respuestas, stickers, emojis y adjuntos.
- Presencia global y por conversación/canal mediante Realtime privado; indicadores de usuarios conectados y escritura sin sondeos periódicos.
- Caja de escritura autoexpandible, fuentes de escritura configurables y estado personalizado.
- Marcos de perfil con una máscara circular que deja visible el avatar por debajo.
- Recuperación de contraseña mediante pantalla dedicada: después de establecer la nueva contraseña, la sesión temporal se cierra y el usuario vuelve al login.
- Más selectores y propiedades CSS para personalizar los canales y paneles de un megagrupo sin afectar a MDs ni a otras comunidades.

Consulta `UPGRADE-v0.8.md` y `MEGAGROUP-CSS-v0.8.md` para la migración, instalación y selectores admitidos.


### Añadido en v0.9

- Interfaz adaptable a móvil con menú lateral, navegación de una sola columna y botón de volver entre la bandeja y el chat.
- Preferencia **Compactar paneles** para mostrar la navegación personal en MDs o los canales al trabajar dentro de un megagrupo.
- Botón **X en línea** que abre tarjetas de participantes con avatar, marco y estado.
- Contadores de mensajes pendientes junto a conversaciones y canales, con seguimiento de lectura de canales mediante `channel_reads`.
- Tarjetas de participantes en canales de voz con avatar, marco y placa de perfil; se pueden sustituir por una lista compacta desde **Configuración → Optimizaciones**.
- Selector conjunto de emojis estándar, emojis personalizados y stickers.
- Nuevo widget de enlace externo con URL HTTPS, texto opcional y favicon automático. El máximo de widgets de perfil pasa de 10 a 32.

Consulta `UPGRADE-v0.9.md` para ejecutar la migración y desplegar la actualización.

### Funciona al configurar Supabase

- Registro con correo, contraseña y nombre de usuario; inicio y cierre de sesión.
- Recuperación de contraseña por correo.
- Perfiles básicos: nickname, pronombres, biografía, color de nombre, avatar y banner.
- Búsqueda de usuarios por nombre, solicitudes de amistad y aceptación.
- MDs y conversaciones grupales entre amigos aceptados.
- Creación de megagrupos con un canal `#general` inicial.
- Creación de canales de texto, anuncios, voz y multimedia. Los canales de voz permiten conexión P2P mediante WebRTC cuando las redes de los participantes lo permiten.
- Mensajes con actualizaciones en tiempo real, respuestas con cita, edición de texto propio y reacciones con emojis.
- Solicitudes de amistad y orden de la bandeja actualizados en tiempo real, sin recargar manualmente.
- Adjuntos de imagen, vídeo y archivos permitidos por el bucket privado, con límite inicial de 50 MB.
- Markdown y HTML visual saneado mediante DOMPurify. El contenido no puede ejecutar scripts arbitrarios.
- Encuestas básicas con opciones y votación.
- Workshop para publicar y aplicar presets de perfil, cliente y megagrupo; incluye valoraciones comunitarias.
- Funciones de moderación en base de datos para banear y desbanear usuarios.
- Gestión visual de roles de megagrupo: nombre, color, permisos y asignación múltiple a miembros.
- Gestión de medallas de megagrupo: crear medallas con emoji o URL HTTPS, asignarlas y retirarlas.
- Los roles y medallas asignados se muestran junto al nombre en los mensajes de los canales del megagrupo.
- Notificaciones Realtime de mensajes y menciones; sonidos, avisos de escritorio y Web Push configurable para pestañas ocultas o navegador cerrado.
- Función Edge opcional para que un administrador envíe un correo de recuperación a otra cuenta.

### Preparado parcialmente / pendiente de completar

- Notificaciones push: el código de cliente y servidor está preparado, pero cada proyecto debe configurar claves VAPID, una función Edge y un Database Webhook.
- Voz: el audio P2P ya funciona en redes compatibles; para mejorar conexiones detrás de NAT restrictiva puede hacer falta TURN.
- CSS personalizado de megagrupo: está disponible con un conjunto de selectores y propiedades limitado por seguridad.

### Necesita un servicio o una fase adicional

- **Voz:** WebRTC P2P ya está implementado; TURN es un servicio adicional para mejorar la conectividad en redes difíciles.
- **Buscador de GIFs:** usa una clave beta GIPHY pública, con cuota limitada y atribución obligatoria. La documentación de GIPHY requiere que Search/Trending se llamen desde el cliente.
- **Fuentes y efectos importados:** ya incluye carga y aplicación visual de fuentes WOFF/WOFF2/TTF y efectos de nombre/avatar/placa. Quedan por ampliar más efectos y controles de animación.
- **Vídeo avanzado:** controles propios para velocidad, reversa, recorte y otros efectos.
- **Workshop:** v0.7 incorpora presets de megagrupo y valoraciones. Quedan pendientes herramientas de moderación comunitaria, versiones e importación/exportación avanzadas.
- **Quick-Alt:** la identidad alternativa ya se adjunta a los mensajes mediante `alt_profile_id`; sigue usando la sesión, permisos y sanciones de la cuenta principal.
- **Moderación avanzada:** paneles adicionales para administrar alianzas, canales y flujos completos de sanciones; los paneles de roles y medallas sí están incluidos en v0.2.

Los mensajes tienen un máximo inicial de 12.000 caracteres y los archivos un límite inicial de 50 MB. Los límites reales de almacenamiento y tráfico dependen del plan y la configuración del proveedor; ningún servicio puede ofrecer almacenamiento literalmente infinito.

---

## 2. Crear el backend en Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. Abre **SQL Editor** en el panel del proyecto.
3. Copia y ejecuta todo el contenido de `supabase/schema.sql`. En instalaciones nuevas, esto incluye todas las correcciones de v0.2.
4. Si ya tenías Nexus v0.1 instalado, ejecuta también `supabase/fix-chat-media-rls.sql` y `supabase/migrations/20261031_harden_community_badges.sql` en SQL Editor. Estos parches actualizan las políticas sin borrar los datos.
5. En **Authentication → Providers**, comprueba que Email está habilitado.
6. En **Authentication → URL Configuration**, establece:
   - **Site URL:** la URL de GitHub Pages que usarás.
   - **Redirect URLs:** añade esa URL exacta y, si vas a probar localmente, `http://localhost:5500/`.
7. En **Project Settings → API**, copia la URL del proyecto y la clave pública (publishable/anon).
8. Abre `assets/js/config.js` y sustituye los dos valores de ejemplo:

```js
window.NEXUS_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU-CLAVE-PUBLICA",
  APP_NAME: "Nexus",
  GIPHY_API_KEY: "TU-CLAVE-BETA-GIPHY"
};
```

La clave pública de Supabase y la clave beta de GIPHY se utilizan desde el cliente. GIPHY requiere que Search/Trending se invoquen desde el navegador, por lo que su clave beta estará visible en el código y tiene una cuota de 100 llamadas por hora. **No pongas nunca `service_role`, una secret key, una contraseña ni claves privadas dentro de `config.js` o de un repositorio público.** La seguridad de los datos depende de las políticas RLS instaladas por el SQL.

### Crear el primer administrador

1. Registra tu propia cuenta desde Nexus.
2. En Supabase abre **Authentication → Users** y copia el UUID de tu usuario.
3. En SQL Editor ejecuta, sustituyendo el UUID:

```sql
insert into public.user_roles(user_id, role)
values ('UUID-DE-TU-CUENTA', 'admin');
```

No existe un botón para hacerse administrador desde la web. La concesión inicial debe hacerse desde el panel del propietario del proyecto.

## 2.1. Actualizar desde v0.1

Para una instalación que ya está publicada, sigue `UPGRADE-v0.2.md`. Ejecuta `supabase/fix-chat-media-rls.sql` en Supabase SQL Editor para corregir la subida de archivos y conserva tu `assets/js/config.js` al sustituir los archivos del frontend. La actualización también incorpora los paneles de roles y medallas; ejecuta `supabase/migrations/20261031_harden_community_badges.sql` para aplicar la política reforzada de asignación de medallas.

## 2.2. Actualizar desde v0.3 a v0.4

Sigue `UPGRADE-v0.4.md`. Ejecuta `supabase/migrations/20261101_realtime_chat_enhancements.sql` en SQL Editor y actualiza los archivos del frontend. La migración habilita actualizaciones en tiempo real para solicitudes, bandeja y reacciones, además de crear las reglas seguras para responder, editar y reaccionar.

## 2.3. Actualizar desde v0.8 a v0.9

Sigue `UPGRADE-v0.9.md`. Ejecuta `supabase/migrations/20261106_nexus_v09_mobile_unread_widgets.sql` en Supabase SQL Editor antes de publicar los archivos del frontend. Conserva `assets/js/config.js`.


---

## 3. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube el contenido de esta carpeta, conservando las rutas `assets/` y `supabase/`.
3. En el repositorio abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Selecciona la rama `main` y la carpeta `/ (root)`.
6. Guarda y espera a que GitHub Pages publique `index.html`.
7. Copia la URL publicada y añádela a las URLs permitidas de Supabase Auth, como se explica arriba.

También puedes probarlo localmente con un servidor estático (por ejemplo, Live Server de VS Code). Evita abrir `index.html` directamente como `file://`, porque el comportamiento de autenticación y las rutas puede variar.

---

## 5. Activar recuperación de contraseña por parte de administradores

La recuperación propia funciona con Supabase Auth. La acción desde el panel de administración utiliza una Edge Function y un proveedor de correo externo.

Esta función usa Resend como ejemplo de proveedor de correo:

1. Configura una cuenta de correo de envío y verifica el dominio/remitente que usarás.
2. Instala y autentica Supabase CLI en tu ordenador.
3. Vincula la carpeta a tu proyecto:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
```

4. Configura los secretos desde la terminal. No los escribas en archivos públicos:

```bash
supabase secrets set RESEND_API_KEY=TU_CLAVE_RESEND
supabase secrets set MAIL_FROM="Nexus <noreply@tu-dominio.com>"
supabase secrets set APP_URL="https://TU-USUARIO.github.io/TU-REPOSITORIO/"
```

5. Publica la función:

```bash
supabase functions deploy admin-send-reset
```

La función usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y una clave secreta de servidor. Añade `SUPABASE_SECRET_KEY` como secreto de la función (puedes usar la clave `service_role` heredada con el nombre `SUPABASE_SERVICE_ROLE_KEY` si tu proyecto aún trabaja con ese formato). **Nunca publiques esa clave en GitHub ni la pongas en `config.js`.** Los métodos `auth.admin` requieren una clave secreta y deben ejecutarse exclusivamente en un entorno de servidor. <https://supabase.com/docs/reference/javascript/admin-api>

El enlace enviado permite al usuario elegir una contraseña nueva. Los administradores no pueden ver la contraseña anterior ni establecer una contraseña secreta para otra persona.

---

## 6. Estructura del proyecto

```text
nexus-chat/
├── index.html
├── README.md
├── .nojekyll
├── assets/
│   ├── css/app.css
│   └── js/
│       ├── config.js
│       └── app.js
└── supabase/
    ├── config.toml
    ├── schema.sql
    └── functions/
        └── admin-send-reset/
            └── index.ts
```

## 7. Seguridad y mantenimiento

- Mantén RLS activado. No elimines políticas para “hacer que funcione” una consulta.
- Nunca subas claves privadas de Supabase ni del proveedor de correo a GitHub.
- Los mensajes aceptan Markdown y HTML saneado. No añadas `innerHTML` con contenido de usuarios sin sanearlo primero.
- Revisa los tipos MIME, límites de tamaño y cuotas de Storage antes de abrir el registro al público.
- Los permisos del megagrupo se evalúan en la base de datos. La interfaz no debe ser la única barrera.
- Configura límites de Auth, protección contra spam, confirmación de correo y copias de seguridad antes de usarlo con mucha gente.
- Las bibliotecas de frontend se cargan desde CDN. Para una instalación de producción conviene fijar versiones, revisar actualizaciones y, si crece el proyecto, usar un proceso de compilación.

## 8. Próxima evolución recomendada

Las siguientes fases pueden ampliar la moderación comunitaria del Workshop, añadir más herramientas de multimedia, presets avanzados y voz con TURN para redes restrictivas. Stickers/emojis, GIFs GIPHY, Web Push y voz P2P ya tienen una primera implementación en v0.7; requieren la configuración externa descrita en sus guías.


## Registro público y correo de confirmación

Los proyectos alojados de Supabase que usan el servicio SMTP integrado tienen un límite de prueba de 2 correos por hora para todo el proyecto. Para aceptar registros de personas externas, configura un proveedor SMTP personalizado en Supabase y mantén la confirmación de correo activada. Consulta `SUPABASE-AUTH-EMAILS.md`.

Nexus v0.3 muestra un mensaje claro cuando se alcanza ese límite. La limitación se resuelve en la configuración de Auth, no cambiando contraseñas ni haciendo público el bucket de archivos.

## Actualización v0.3

Consulta `UPGRADE-v0.3.md`. Si aún no se aplicaron, ejecuta primero las migraciones de v0.2 para Storage y medallas; después ejecuta `supabase/migrations/20261101_channel_permissions.sql` para habilitar las reglas RLS por tipo de canal. La actualización también incorpora soporte opcional para Cloudflare Turnstile en el registro y la recuperación.


## Actualizar desde v0.4

Ejecuta `supabase/migrations/20261101_nexus_v05_features.sql` en Supabase SQL Editor y después publica el contenido del paquete `nexus-chat-v0.5-upgrade.zip` en la raíz del repositorio. Conserva tu `assets/js/config.js`. Consulta `UPGRADE-v0.5.md` antes de desplegar.


## Actualizar desde v0.5 a v0.6

Sigue `UPGRADE-v0.6.md`. Ejecuta `supabase/migrations/20261102_nexus_v06_identity_mentions_notifications_invites.sql` una vez después de las migraciones v0.2–v0.5; después publica el contenido del ZIP Upgrade en GitHub Pages y conserva `assets/js/config.js`.

## Notificaciones y límites del navegador

Consulta `NOTIFICATIONS-v0.7.md`. El sonido se reproduce mientras Nexus está abierto después de la primera interacción con la página. Los avisos de escritorio requieren permiso. Web Push puede funcionar con la pestaña oculta o el navegador cerrado, pero necesita VAPID, un service worker, el webhook y permiso explícito del usuario en cada navegador.


## v0.7 — medios, Workshop, push y voz

La actualización v0.7 añade stickers/emojis privados, GIFs de GIPHY (clave beta pública en `GIPHY_API_KEY`, atribución `Powered by GIPHY`), valoraciones del Workshop, Web Push mediante VAPID y voz P2P WebRTC de hasta seis participantes. Consulta [UPGRADE-v0.7.md](UPGRADE-v0.7.md), [VOICE-v0.7.md](VOICE-v0.7.md) y [NOTIFICATIONS-v0.7.md](NOTIFICATIONS-v0.7.md).


## Hotfix v0.7.2

Las cargas de imágenes y fuentes validan la firma binaria y envían un MIME explícito, sin confiar en `File.type`. Ejecuta `supabase/migrations/20261101_nexus_v072_profile_asset_mime.sql` al actualizar.


## Nexus v0.8

Consulta `UPGRADE-v0.8.md` para actualizar una instalación v0.7.2, `MEGAGROUP-CSS-v0.8.md` para la personalización CSS de megagrupos y `PASSWORD-RECOVERY-v0.8.md` para el flujo de recuperación. La actualización usa una migración incremental; no vuelvas a ejecutar `schema.sql` sobre un proyecto existente.

## Nexus v0.9

Consulta `CHANGELOG-v0.9.md` para las funciones nuevas y `UPGRADE-v0.9.md` para el procedimiento de actualización desde v0.8.


## Actualizar a Nexus v0.10.0-alpha.1

Antes de desplegar, sigue `UPGRADE-v0.10-alpha1.md`. Ejecuta `supabase/migrations/20261102_nexus_v010_features.sql` en Supabase SQL Editor y después publica los archivos del proyecto, conservando `assets/js/config.js`.

## Nexus v0.10.1-alpha3 (beta hotfix)

Este hotfix restaura los fondos de megagrupo en los canales de conversación e incorpora una guía completa de personalización accesible desde la barra superior y desde Configuración. La guía también está disponible como [`GUIA-PERSONALIZACION.md`](GUIA-PERSONALIZACION.md).

Consulta [`UPGRADE-v0.10.1-alpha3.md`](UPGRADE-v0.10.1-alpha3.md) para aplicar el parche desde v0.10.0-alpha3. No requiere migración SQL. Conserva tu `assets/js/config.js`.


## Nexus v0.10.1-alpha3 hotfix 2

Este segundo hotfix de la beta refuerza la reconstrucción de mensajes para evitar saltos de scroll cuando llegan eventos Realtime a la vez, conserva la placa y BoxGlow originales dentro de los bloques agrupados y evita animaciones de scroll inesperadas. En móvil vertical, la preferencia Compactar paneles vuelve a usar una sola columna y la navegación lateral habitual.

Se mantienen la búsqueda de emojis, las sugerencias `:alias:`, la cancelación básica de eco/ruido en VC y las notas de voz WAV PCM mono a 16 kHz, con aliases de emojis en español añadidos al selector y al compositor. No requiere migración SQL.

Consulta `UPGRADE-v0.10.1-alpha3-hotfix2.md` para actualizar desde el hotfix anterior. Conserva `assets/js/config.js`.


## Estado de versión

La versión web más reciente de esta rama es **Nexus v0.10.2-alpha1**. Consulta `CHANGELOG-v0.10.2-alpha1.md` y `UPGRADE-v0.10.2-alpha1.md` antes de actualizar. Nexus Desktop permanece en una rama separada y no se modifica con esta entrega.
