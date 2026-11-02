# Nexus v0.9 — móvil, navegación y experiencia de chat

## Interfaz y móvil

- Navegación adaptable para móvil: barra inferior de comunidades, menú lateral deslizable y vista de una sola columna.
- Al abrir una conversación se muestra el chat a pantalla completa; el botón de volver regresa a los MDs o abre la lista de canales del megagrupo.
- Ajustes de tamaños, formularios, diálogos, herramientas de escritura y áreas desplazables para pantallas estrechas.
- Preferencia opcional **Compactar paneles**: en el contexto personal oculta la navegación de canales y en un megagrupo oculta la navegación personal y la lista de MDs.

## Presencia y notificaciones pendientes

- La antigua fila de miembros conectados se sustituye por el botón **X en línea**.
- El botón abre tarjetas con avatar, marco, nombre y estado personalizado. Al seleccionar a otra persona se abre su perfil público.
- Se muestran contadores de mensajes no leídos junto a las conversaciones y canales.
- Los canales incorporan estado de lectura mediante `channel_reads`; las conversaciones mantienen `conversation_reads`.
- La RPC `get_nexus_unread_counts()` calcula los contadores en una sola consulta para la barra lateral.

## Voz

- Los participantes se presentan como tarjetas con avatar centrado, marco de perfil y placa de fondo.
- **Configuración → Optimizaciones → Desactivar tarjetas visuales en chats de voz** permite volver a la lista compacta de nombres.
- La opción cambia solo la interfaz local; no modifica el audio ni la señalización WebRTC.

## Emojis y stickers

- El selector pasa a reunir emojis estándar, stickers y emojis personalizados en pestañas.
- El selector estándar incluye un conjunto inicial de emojis Unicode habituales; no necesita conexión ni subidas.

## Widgets de perfil

- Nuevo tipo **Enlace externo** con URL HTTPS y texto opcional.
- Si no se indica título se usa el dominio como título visible.
- El icono intenta cargar el favicon del dominio; si no está disponible se muestra un icono genérico.
- Los enlaces se abren en una pestaña nueva con `noopener noreferrer`.
- El máximo de widgets aumenta de 10 a 32 tanto en la aplicación como en la restricción de PostgreSQL.

## Datos y compatibilidad

- La migración v0.9 es incremental. No elimina mensajes, conversaciones, perfiles, recursos ni widgets existentes.
- Las lecturas existentes se conservan; los contextos que todavía no tenían registro de lectura reciben una marca inicial para evitar que el historial antiguo aparezca repentinamente como pendiente.
- `assets/js/config.js` sigue siendo configuración local y no se incluye en los paquetes.
