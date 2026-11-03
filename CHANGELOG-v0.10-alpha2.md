# Nexus v0.10.0-alpha.2 — cambios

Esta actualización es un parche de experiencia de chat para web y móvil. Continúa sobre v0.10.0-alpha.1; no modifica Nexus Desktop.

## Mensajes agrupados

- Los mensajes consecutivos de una misma cuenta se muestran dentro de una sola caja visual cuando se envían con menos de cinco minutos de separación.
- La caja se adapta al contenido y a los adjuntos, mantiene el avatar y la identidad al inicio del bloque y evita repetirlos en cada mensaje.
- Las reacciones permanecen dentro del bloque y no interrumpen la agrupación.
- La agrupación se puede desactivar desde Configuración → Optimizaciones.
- La agrupación se reconstruye al recibir mensajes, cargar historial anterior, editar o eliminar mensajes.

## Colores de interfaz

- Nuevos controles para fondo principal, paneles, superficies, texto principal, texto secundario, bordes y fondo de las cajas de mensajes agrupados.
- Se conserva el selector de color de acento y el fondo personalizado por URL.
- Los colores son preferencias individuales de cada cuenta; no alteran el tema de otros usuarios ni el diseño del megagrupo.

## Emojis y reacciones

- Selector ampliado con más de 1.000 entradas de emoji estándar, incluyendo caras, gestos, animales, comida, actividades, objetos, símbolos y banderas.
- Se puede reaccionar con cualquiera de los emojis estándar.
- Se puede reaccionar con emojis personalizados personales, de conversación o del megagrupo, siempre que sean visibles en el contexto.
- Las reacciones personalizadas se muestran como imagen y conservan su identificador incluso si el nombre del recurso cambia.

## Migración

Ejecuta `supabase/migrations/20261103_nexus_v0102_grouped_messages_theme_emoji_reactions.sql` una vez. Amplía el límite del campo `message_reactions.emoji` de 16 a 80 caracteres para permitir el formato `custom:<uuid>`. También amplía las políticas RLS de `custom_assets` y el permiso de lectura del bucket privado para que los miembros de una conversación o megagrupo puedan ver un emoji personal cuando alguien lo haya usado en una reacción a un mensaje que pueden consultar. Los archivos siguen privados y el acceso continúa limitado a miembros del contexto. Un trigger del servidor también valida el ámbito del emoji al insertar una reacción, para impedir que se compartan recursos privados simplemente adivinando su UUID. No borra ni modifica reacciones existentes, mensajes, perfiles ni archivos.

Las preferencias de color y agrupación se guardan en `profiles.settings`; no requieren columnas adicionales.

## Limitaciones y pruebas

- La agrupación usa una ventana fija de cinco minutos; no combina mensajes de autores o identidades alternativas diferentes.
- Los emojis que un dispositivo no tenga disponibles como fuente del sistema pueden verse como un glifo de sustitución, aunque sigan siendo seleccionables.
- Las reacciones con emoji personalizado necesitan que el recurso siga siendo accesible para los miembros del contexto y que el bucket privado permita generar su URL firmada.
- Esta alpha requiere pruebas de interfaz reales en escritorio y móvil, y una prueba de reacciones personalizadas en Supabase antes de desplegar a todos los usuarios.
