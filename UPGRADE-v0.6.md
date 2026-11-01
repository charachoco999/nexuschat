# Nexus v0.6 — actualización

Esta actualización está pensada para una instalación que ya funciona con Nexus v0.5. No sustituye las migraciones anteriores.

## Antes de empezar

1. Haz una copia de seguridad de Supabase y del repositorio de GitHub.
2. Confirma que ya aplicaste las migraciones de v0.2, v0.3, v0.4 y v0.5. Si falta alguna, aplícalas en orden antes de v0.6.
3. Conserva tu `assets/js/config.js`; el ZIP Upgrade no contiene tus credenciales.

## 1. Migración de Supabase

En **Supabase → SQL Editor**, ejecuta una sola vez:

`supabase/migrations/20261102_nexus_v06_identity_mentions_notifications_invites.sql`

La migración:

- Añade `alt_profile_id` a mensajes y valida en el servidor que la identidad alternativa pertenece al remitente autenticado.
- Valida menciones de miembros y roles para impedir mencionar identidades ajenas al MD, grupo o megagrupo. Añade `edit_message_with_mentions` para editar el texto y sus menciones en una sola transacción.
- Habilita MIME de fuentes WOFF, WOFF2 y TTF en el bucket `profile-media`, manteniendo imágenes y el límite de 8 MB.
- Reemplaza las RPC de creación/aceptación de invitaciones con comprobaciones de permisos, caducidad y límite de usos; vuelve a conceder `EXECUTE` a `authenticated`.
- Asegura que `messages` esté incluido en `supabase_realtime`.

La migración no elimina mensajes ni perfiles. Haz una copia igualmente; hay pocas cosas más desagradables que descubrir que las copias de seguridad eran una buena idea después de necesitarlas.

## 2. Publicar GitHub Pages

1. Descomprime `nexus-chat-v0.6-upgrade.zip`.
2. Entra en la carpeta `nexus-chat` del ZIP.
3. Sube su contenido a la raíz del repositorio, aceptando reemplazar los archivos antiguos.
4. Conserva tu `assets/js/config.js`. Usa `config.js.example` solo como referencia.
5. Espera a que GitHub Pages termine el despliegue y recarga con `Ctrl + F5`.

## 3. Funciones nuevas

### Quick-Alt

Desde **Tu perfil → Quick-Alt** puedes crear, activar, volver a la identidad principal y eliminar identidades alternativas. Una alt no tiene contraseña ni sesión independiente: sus mensajes siguen perteneciendo a tu cuenta principal y heredan sus permisos, roles, amistades y sanciones. La marca ALT se muestra en los mensajes.

### Fuentes, GIFs y placas

Desde **Tu perfil → Efectos de identidad** puedes subir efectos de nombre, avatar y placa en PNG/JPG/WebP/GIF, y fuentes WOFF/WOFF2/TTF. Los archivos tienen un máximo de 8 MB. La placa tiene un control de opacidad de 0 a 60 % y aparece en mensajes, MDs, amigos, solicitudes y miembros.

El bucket `profile-media` es público para que los demás usuarios puedan cargar estos efectos. No subas archivos privados ni documentos personales. Cuando reemplazas o retiras un archivo almacenado por Nexus, el cliente intenta borrar el objeto anterior de tu propia carpeta para ahorrar espacio.

### Workshop

Puedes publicar un preset de tipo `perfil` o `cliente`. Los presets de perfil comparten color, fuente, efectos y placa; los de cliente comparten color de acento, densidad y fondo. La aplicación de presets usa una lista de campos permitidos y no importa scripts ni CSS arbitrario.

### Menciones

En conversaciones escribe `@` y selecciona a un participante. En canales de megagrupo también aparecen roles. Los mensajes muestran el nombre legible después de enviarse. En la base de datos se valida que el ID mencionado corresponda a un miembro del contexto; una mención inventada no pasa el trigger.

La lista de sugerencias se carga por contexto y se mantiene en memoria durante la sesión. Si cambian roles o miembros mientras escribes, vuelve a abrir el chat para refrescar sugerencias.

### Notificaciones

El botón de notificaciones de la barra superior muestra el origen, el nombre del MD/grupo/canal y una vista previa. El sonido se genera en el navegador y puede activarse/desactivarse en Configuración. Los avisos de escritorio son opcionales mediante el botón de permiso de notificaciones. Revisa `NOTIFICATIONS-v0.6.md` para conocer sus límites.

### Invitaciones

En **Administrar megagrupo → Invitar miembros → Crear enlace de invitación** se genera un enlace válido durante 7 días y sin límite de usos. El botón enseña el enlace en pantalla e intenta copiarlo; si el navegador bloquea el portapapeles, puedes copiarlo manualmente.

El propietario siempre puede crear invitaciones. Los miembros también pueden abrir la ventana de administración en modo solo invitaciones cuando su rol tenga el permiso `create_invites`. Los campos para modificar los datos del megagrupo siguen reservados al propietario.

Si un invitado no tiene cuenta, el código se conserva al registrarse y se añade al `emailRedirectTo` de Supabase para que siga presente después de confirmar el correo. Añade la URL de GitHub Pages a **Authentication → URL Configuration → Redirect URLs** de Supabase (por ejemplo, `https://charachoco999.github.io/nexuschat/**`). El código va incluido en `emailRedirectTo`; si el usuario confirma el correo desde otro navegador, el enlace de confirmación debe abrir esa URL permitida para que Nexus recupere la invitación.

## 4. Pruebas recomendadas

Prueba con dos cuentas diferentes, preferiblemente en dos navegadores o perfiles de navegador:

1. Crea una alt en una cuenta y envía un mensaje en un MD y en un canal. Comprueba la marca ALT y confirma que la segunda cuenta ve el alias.
2. Sube un GIF como efecto de avatar y nombre. Abre la ficha pública y comprueba los mensajes y listas de amigos.
3. Sube una fuente WOFF2 o TTF; confirma que el nombre cambia sin recargar y que sigue cambiado después de iniciar sesión de nuevo.
4. Sube una placa y mueve la opacidad entre 0 y 60 %. Revisa mensaje, amigo y MD.
5. Publica un preset de perfil y aplícalo desde otra cuenta. Haz lo mismo con un preset de cliente.
6. En un MD escribe `@` y menciona a tu amigo. Comprueba que queda resaltado después de enviarlo.
7. En un canal menciona un miembro y un rol. Comprueba que la persona mencionada y los miembros del rol reciben la indicación correspondiente.
8. Activa el sonido y prueba un mensaje en un chat diferente mientras Nexus está visible. Repite con la pestaña en segundo plano.
9. Concede permiso de notificación de escritorio y comprueba que aparece al dejar la pestaña en segundo plano.
10. Crea un enlace de invitación como propietario. Ábrelo en una sesión nueva e inicia sesión; comprueba que se incorpora al megagrupo.
11. Repite la creación desde una cuenta con rol `create_invites` y comprueba que solo ve el panel de invitaciones, no los campos de edición del megagrupo.

## 5. Límites

- El sonido requiere que Nexus esté abierto y que el navegador haya permitido iniciar audio tras una interacción del usuario.
- Los avisos de escritorio requieren permiso del navegador y la pestaña abierta/oculta. No hay push cuando el navegador está cerrado.
- Quick-Alt no crea usuarios de autenticación separados: cada alt comparte la cuenta principal.
- La voz continúa pendiente de WebRTC y TURN.
- Los GIFs se cargan como archivos estáticos; todavía no existe un buscador de GIFs externo.
