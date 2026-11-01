# Nexus — chat y comunidades

Nexus es una plataforma web en evolución para mensajes y megagrupos. La interfaz se publica como web estática y Supabase proporciona autenticación, PostgreSQL, almacenamiento privado y actualizaciones en tiempo real.

> **Estado:** v0.6 añade identidades Quick-Alt, fuentes y efectos visuales de perfil, opacidad de placas, presets compartibles de perfil/cliente, menciones de miembros y roles, bandeja de notificaciones con sonido e iconos de origen, y un flujo de invitaciones reparado. Mantiene las funciones sociales y de megagrupo de versiones anteriores. No es todavía una alternativa completa a Discord; las limitaciones y servicios externos se indican más abajo.

## 1. Qué incluye esta versión

### Añadido en v0.5

- Ocultar/archivar conversaciones de forma individual y restaurarlas más tarde.
- Salir de conversaciones o grupos desde la bandeja sin borrar el historial para los demás participantes.
- Permite crear varias conversaciones independientes con la misma persona.
- Encuestas creadas mediante una función SQL transaccional: el mensaje y la encuesta se confirman juntos para evitar que Realtime muestre una tarjeta duplicada/incompleta.
- El fondo visual de un megagrupo también se aplica a canales de texto y a la vista de canales de voz. El audio de voz aún no está implementado.
- Fichas públicas de perfil, aliases, nickname por megagrupo y hasta 10 widgets.
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

### Funciona al configurar Supabase

- Registro con correo, contraseña y nombre de usuario; inicio y cierre de sesión.
- Recuperación de contraseña por correo.
- Perfiles básicos: nickname, pronombres, biografía, color de nombre, avatar y banner.
- Búsqueda de usuarios por nombre, solicitudes de amistad y aceptación.
- MDs y conversaciones grupales entre amigos aceptados.
- Creación de megagrupos con un canal `#general` inicial.
- Creación de canales de texto, anuncios, voz y multimedia. En esta versión, los canales de voz muestran el punto de integración, pero todavía no conectan audio.
- Mensajes con actualizaciones en tiempo real, respuestas con cita, edición de texto propio y reacciones con emojis.
- Solicitudes de amistad y orden de la bandeja actualizados en tiempo real, sin recargar manualmente.
- Adjuntos de imagen, vídeo y archivos permitidos por el bucket privado, con límite inicial de 50 MB.
- Markdown y HTML visual saneado mediante DOMPurify. El contenido no puede ejecutar scripts arbitrarios.
- Encuestas básicas con opciones y votación.
- Workshop básico para publicar y aplicar presets de perfil y cliente (efectos, fuentes, color, densidad y fondo).
- Funciones de moderación en base de datos para banear y desbanear usuarios.
- Gestión visual de roles de megagrupo: nombre, color, permisos y asignación múltiple a miembros.
- Gestión de medallas de megagrupo: crear medallas con emoji o URL HTTPS, asignarlas y retirarlas.
- Los roles y medallas asignados se muestran junto al nombre en los mensajes de los canales del megagrupo.
- Notificaciones Realtime de mensajes y menciones; sonido mientras la aplicación está abierta y avisos de escritorio opcionales en segundo plano.
- Función Edge opcional para que un administrador envíe un correo de recuperación a otra cuenta.

### Preparado parcialmente / pendiente de completar

- Stickers y emojis personalizados, personales, de conversación o de comunidad (`custom_assets`): la tabla de recursos está preparada, pero falta el editor y el selector en el compositor.
- Las notificaciones push cuando el navegador está completamente cerrado requieren un service worker, suscripción Push y un servicio de envío desde servidor. La v0.6 solo avisa mientras Nexus está abierto o con la pestaña en segundo plano.
- CSS personalizado de megagrupo: está disponible con un conjunto de selectores y propiedades limitado por seguridad.

### Necesita un servicio o una fase adicional

- **Voz:** WebRTC y un sistema de señalización; para conexiones robustas también puede hacer falta TURN.
- **Buscador de GIFs:** API de un proveedor y una Edge Function que proteja la clave.
- **Fuentes y efectos importados:** ya incluye carga y aplicación visual de fuentes WOFF/WOFF2/TTF y efectos de nombre/avatar/placa. Quedan por ampliar más efectos y controles de animación.
- **Vídeo avanzado:** controles propios para velocidad, reversa, recorte y otros efectos.
- **Workshop completo:** la v0.6 permite compartir y aplicar presets de perfil/cliente; faltan revisión comunitaria, versiones, importación/exportación y presets de megagrupo.
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
  APP_NAME: "Nexus"
};
```

La clave pública está diseñada para aparecer en el cliente. **No pongas nunca `service_role`, una secret key, una contraseña ni claves privadas dentro de `config.js` o de un repositorio público.** La seguridad de los datos depende de las políticas RLS instaladas por el SQL.

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

La siguiente fase puede ampliar Workshop con moderación comunitaria y presets de megagrupo, añadir stickers y emojis personalizados, buscador de GIFs y voz real con WebRTC/TURN. También conviene añadir notificaciones push para cuando el navegador está completamente cerrado y continuar reforzando los controles de moderación. Quick-Alt, fuentes importadas, efectos de nombre/avatar/placa, menciones e invitaciones ya tienen una primera implementación en v0.6.


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

Consulta `NOTIFICATIONS-v0.6.md`. El sonido se reproduce mientras Nexus está abierto después de la primera interacción con la página. Los avisos de escritorio requieren permiso y pueden aparecer con la pestaña oculta. No hay notificaciones push cuando el navegador está completamente cerrado.
