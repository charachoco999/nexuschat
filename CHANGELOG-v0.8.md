# Nexus v0.8 — rendimiento, presencia e identidad

- Historial de chat paginado en grupos de 50 mensajes, con botón para cargar anteriores.
- Caché en memoria limitada a 200 mensajes por contexto y 12 contextos; al volver a entrar se consulta solo el delta reciente.
- Respuestas, encuestas, votos, reacciones, stickers, emojis y URL firmadas de adjuntos se resuelven por lotes al renderizar páginas, reduciendo consultas N+1.
- Sincronización incremental con cursor compuesto y páginas de 100 mensajes nuevos; el cursor de paginación no retrocede cuando la caché recorta entradas antiguas.
- Actualización individual de mensajes, encuestas y votos sin reconstruir toda la conversación.
- Evita forzar el scroll al final si el usuario está leyendo mensajes antiguos.
- Presencia global para mostrar amigos conectados y estado en los MDs; el encabezado del chat lista los miembros presentes con avatar y acceso a perfil.
- Presencia por contexto y eventos broadcast efímeros para mostrar miembros en línea y escritura en tiempo real.
- Caja de escritura autoexpandible, limitada a 180 px.
- Fuente de escritura personalizable y estado personalizado de hasta 60 caracteres.
- Marcos de perfil con perforación central circular mediante máscara CSS; no se requiere editar el archivo original.
- Recuperación de contraseña con pantalla dedicada y cierre de la sesión de recuperación después de guardar.
- Motor CSS de megagrupo ampliado con selectores y propiedades visuales adicionales, manteniendo el aislamiento. Ahora también permite personalizar el chat de los canales del megagrupo sin afectar a MDs ni a otras comunidades.
- Añade `profiles.profile_frame_url`, índices para consultas paginadas y autorización para el tema Realtime privado `nexus-online`.
- Al seleccionar de nuevo el mismo MD o canal ya abierto, Nexus evita reconstruir el panel y sincroniza únicamente los mensajes nuevos. Los eventos Realtime de inserción usan el renderizador agrupado.
