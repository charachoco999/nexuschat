# Cambios de Nexus v0.5

- Archivado por usuario y salida de conversaciones sin borrar el historial del resto.
- Conserva la posibilidad de abrir varias conversaciones con el mismo usuario.
- Encuestas creadas con una RPC transaccional para evitar el renderizado intermedio duplicado.
- Fondo de megagrupo aplicado a canales de texto y a la vista de canales de voz.
- Fichas de perfil públicas, aliases, widgets (máximo 10) y nickname específico de megagrupo.
- Invitaciones compartibles con vencimiento y límite de usos.
- AutoAlly con solicitudes por ID incluso para comunidades privadas y entrada segura a comunidades aliadas.
- Mensajes fijados en conversaciones y canales, con permisos de moderación para canales.
- Confirmaciones de lectura para MDs y chats grupales.
- Restricción de privilegios UPDATE en `conversation_members` y `community_members` para proteger roles y metadatos.

Pendiente: audio WebRTC real, stickers, emojis personalizados, GIF search, Quick-Alt completo, efectos/fuentes de perfil y recibos de lectura en canales.
