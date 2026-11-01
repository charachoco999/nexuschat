# Nexus — chat y comunidades

Nexus es una plataforma web en evolución para mensajes y megagrupos. La interfaz se publica como web estática y Supabase proporciona autenticación, PostgreSQL, almacenamiento privado y actualizaciones en tiempo real.

> **Estado:** v0.4 añade bandeja y solicitudes de amistad en tiempo real, respuestas, edición de mensajes propios y reacciones sincronizadas. Incluye los módulos anteriores de roles, permisos, medallas, canales y apariencia de megagrupo. No es todavía una alternativa completa a Discord; las funciones que necesitan servicios externos o módulos posteriores se indican más abajo.

## 1. Qué incluye esta versión

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
- Workshop básico para publicar y aplicar presets de color y densidad.
- Funciones de moderación en base de datos para banear y desbanear usuarios.
- Gestión visual de roles de megagrupo: nombre, color, permisos y asignación múltiple a miembros.
- Gestión de medallas de megagrupo: crear medallas con emoji o URL HTTPS, asignarlas y retirarlas.
- Los roles y medallas asignados se muestran junto al nombre en los mensajes de los canales del megagrupo.
- Función Edge opcional para que un administrador envíe un correo de recuperación a otra cuenta.

### Preparado en la base de datos, pendiente de interfaz completa

- Solicitudes y relaciones de alianza (`alliance_requests`).
- Stickers y emojis personalizados, personales, de conversación o de comunidad (`custom_assets`).
- Perfiles alternativos (`alt_profiles`).
- Campos de perfil para aliases, widgets, fuentes, efectos y placas.
- Configuración visual y CSS personalizado por megagrupo.

### Necesita un servicio o una fase adicional

- **Voz:** WebRTC y un sistema de señalización; para conexiones robustas también puede hacer falta TURN.
- **Buscador de GIFs:** API de un proveedor y una Edge Function que proteja la clave.
- **Fuentes y efectos importados:** editor de archivos, validación y almacenamiento.
- **Vídeo avanzado:** controles propios para velocidad, reversa, recorte y otros efectos.
- **Workshop completo:** revisión, permisos, versiones, importación y exportación segura de presets.
- **Quick-Alt completo:** cambiar la identidad que se muestra en cada mensaje y aplicar su medalla requiere conectar `alt_profiles` al sistema de mensajes.
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

La siguiente evolución puede centrarse en confirmaciones de lectura y mensajes no leídos, panel de miembros, personalización detallada de perfil/cliente y alianza con flujo completo. Después conviene completar Quick-Alt, stickers/emojis y GIFs, y finalmente añadir voz con WebRTC/TURN. Así cada módulo puede probarse sin convertir la aplicación en una torre de piezas que nadie sabe depurar.


## Registro público y correo de confirmación

Los proyectos alojados de Supabase que usan el servicio SMTP integrado tienen un límite de prueba de 2 correos por hora para todo el proyecto. Para aceptar registros de personas externas, configura un proveedor SMTP personalizado en Supabase y mantén la confirmación de correo activada. Consulta `SUPABASE-AUTH-EMAILS.md`.

Nexus v0.3 muestra un mensaje claro cuando se alcanza ese límite. La limitación se resuelve en la configuración de Auth, no cambiando contraseñas ni haciendo público el bucket de archivos.

## Actualización v0.3

Consulta `UPGRADE-v0.3.md`. Si aún no se aplicaron, ejecuta primero las migraciones de v0.2 para Storage y medallas; después ejecuta `supabase/migrations/20261101_channel_permissions.sql` para habilitar las reglas RLS por tipo de canal. La actualización también incorpora soporte opcional para Cloudflare Turnstile en el registro y la recuperación.
