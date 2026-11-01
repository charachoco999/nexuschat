# Nexus v0.4 — actualización

Esta actualización se apoya en la interfaz v0.3 y añade mejoras del flujo diario de mensajería.

## Novedades

- Las solicitudes de amistad se actualizan en tiempo real cuando otra persona las envía o acepta.
- La bandeja de conversaciones se actualiza al crear conversaciones y se ordena por actividad reciente.
- Respuestas a mensajes con una cita compacta; al pulsar la cita, Nexus intenta localizar el mensaje original en el chat.
- Edición de mensajes de texto propios, con indicador «editado» y actualización en los clientes conectados.
- Reacciones con un conjunto de emojis y sincronización en tiempo real.
- La migración habilita Postgres Changes para `friends`, `conversation_members`, `conversations` y `message_reactions`.
- Las respuestas solo pueden citar mensajes del mismo DM/grupo/canal. La edición se realiza mediante un RPC restringido y las reacciones tienen RLS.

## Actualizar desde v0.3

1. Haz una copia de seguridad de tu repositorio y una copia de seguridad de la base de datos.
2. En Supabase abre **SQL Editor** y ejecuta una sola vez `supabase/migrations/20261101_realtime_chat_enhancements.sql`.
3. Sube a la raíz de tu repositorio los archivos de esta actualización, conservando las rutas `assets/`, `supabase/` e `index.html`.
4. Conserva tu `assets/js/config.js`. Este archivo no se incluye en el paquete Upgrade para evitar sobrescribir las credenciales de tu proyecto.
5. Recarga Nexus con `Ctrl + F5` en dos sesiones distintas y realiza las pruebas de abajo.

La migración es idempotente para las tablas, columnas, políticas y triggers que crea. Aun así, realiza copia de seguridad antes de ejecutarla.

## Pruebas recomendadas

### Amistades y bandeja

1. Inicia sesión con dos cuentas diferentes, A y B.
2. Desde A envía una solicitud a B. La sección de solicitudes de B debe actualizarse sin recargar la página.
3. Desde B acepta la solicitud. A debe ver el cambio automáticamente.
4. Crea un MD y envía mensajes desde ambas cuentas. La conversación debe aparecer y ordenarse por su actividad reciente.

### Mensajes

1. Responde a un mensaje. La cita debe aparecer encima del contenido y mostrar quién escribió el mensaje original.
2. Pulsa la cita: si el mensaje original sigue en los últimos 100 mensajes cargados, Nexus debe desplazarse hasta él.
3. Edita un mensaje de texto propio. Debe aparecer el indicador «editado» y la otra sesión debe recibir el cambio.
4. Añade una reacción, y después vuelve a pulsarla para retirarla. La otra sesión debe ver el recuento actualizado.
5. Comprueba que no puedes editar mensajes de otras personas ni responder a mensajes de otra conversación.

## Notas

- La edición solo está habilitada para mensajes de texto. No cambia adjuntos, encuestas ni mensajes multimedia.
- Las reacciones disponibles actualmente son un conjunto pequeño de emojis habituales; el selector completo de emojis personalizados queda para otra fase.
- La vista de conversaciones no incluye todavía indicadores de mensajes no leídos ni confirmaciones de lectura.
- Supabase Realtime debe estar habilitado en el proyecto. La migración añade las tablas a la publicación `supabase_realtime` cuando esa publicación existe.
- No desactives RLS ni hagas públicas las tablas para resolver problemas de tiempo real.
