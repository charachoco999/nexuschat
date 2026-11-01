# Nexus v0.6 — registro de cambios

## Identidad
- Quick-Alt conectado a los mensajes mediante `alt_profile_id`, con verificación de propiedad en SQL.
- Efectos de nombre, avatar y placa en mensajes, fichas públicas y listas de usuarios/conversaciones.
- Fuentes WOFF/WOFF2/TTF con límite de 8 MB y eliminación de archivos propios al reemplazarlos/retirarlos.
- Opacidad de placa ajustable y guardada por perfil.
- Presets compartibles de perfil y cliente en Workshop.

## Mensajería y notificaciones
- Autocompletado de menciones a miembros y roles.
- Validación de IDs mencionados en trigger de mensajes y edición atómica de texto + menciones.
- Sonido generado por Web Audio para mensajes recibidos.
- Panel de notificaciones con avatar/icono de MD, grupo o megagrupo/canal, vista previa y resaltado de menciones.
- Avisos de escritorio opcionales con permiso del navegador.

## Invitaciones
- Botón directo sin un segundo diálogo que pudiera interceptar el flujo.
- Enlace visible y botón de copiar; enlace válido 7 días y usos ilimitados.
- Permiso `create_invites` expuesto en modo solo invitaciones a miembros autorizados.
- Código preservado durante el registro y la confirmación de correo.
- RPC seguras con validación de permiso, caducidad y límite de usos.

## Seguridad y mantenimiento
- MIME de Storage para fuentes limitado a WOFF/WOFF2/TTF; se evita permitir `application/octet-stream` de forma general.
- Limpieza de assets antiguos solo si están en la carpeta propia del usuario.
- Se mantienen las claves secretas fuera del frontend.
