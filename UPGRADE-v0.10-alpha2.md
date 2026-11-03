# Actualizar Nexus v0.10.0-alpha.1 → v0.10.0-alpha.2

Este parche añade agrupación visual de mensajes, más controles de color y emojis personalizados como reacciones. Sigue siendo una versión alpha. No modifica Nexus Desktop.

## Antes de empezar

1. Haz una copia del repositorio de GitHub.
2. Crea una copia de seguridad de Supabase.
3. Comprueba que ya estás ejecutando Nexus v0.10.0-alpha.1 y que se aplicaron sus migraciones anteriores.
4. Conserva `assets/js/config.js`; no está incluido en el paquete de actualización.

## 1. Migración SQL

En Supabase → SQL Editor, ejecuta una sola vez:

`supabase/migrations/20261103_nexus_v0102_grouped_messages_theme_emoji_reactions.sql`

La migración amplía el límite del texto de reacción a 80 caracteres para guardar identificadores `custom:<uuid>`. También actualiza la política RLS de `custom_assets` y la función de lectura del bucket privado: los miembros de un chat solo pueden leer un emoji personal cuando se ha usado en una reacción a un mensaje visible para ellos. Un trigger también valida en el servidor que el emoji pertenece al usuario o está disponible en el ámbito de ese chat; así no basta con enviar manualmente un UUID ajeno. No elimina reacciones, archivos ni mensajes.

## 2. Publicar la web

1. Descomprime `nexus-chat-v0.10-alpha2-upgrade.zip`.
2. Sube el contenido de `nexus-chat/` a la raíz del repositorio de GitHub Pages y acepta sustituir los archivos.
3. Conserva el archivo `assets/js/config.js` existente. No lo sustituyas por `config.js.example`.
4. Espera a que GitHub Pages termine el despliegue y fuerza una recarga completa. En móvil, cierra y vuelve a abrir la web instalada o la pestaña.

## 3. Pruebas recomendadas

1. Envía varios mensajes seguidos desde la misma cuenta y comprueba que se muestran en una caja; envía después desde otra cuenta y comprueba que empieza otro bloque.
2. Prueba mensajes con respuesta, imagen, audio, vídeo, sticker y reacciones dentro de un bloque agrupado.
3. Carga mensajes antiguos, edita uno y elimina otro; comprueba que las cajas se reconstruyen y que no se pierde el orden.
4. Desactiva la agrupación en Configuración → Optimizaciones; los mensajes deben volver al diseño individual. Actívala de nuevo y comprueba que se agrupan otra vez.
5. Cambia cada color de interfaz, guarda y recarga la página. Comprueba también la legibilidad en móvil.
6. Abre el selector de emojis, comprueba que la lista estándar se desplaza y envía emojis de varias categorías.
7. Añade una reacción con emoji estándar y otra con un emoji personalizado personal.
8. Prueba una reacción con emoji personalizado de conversación y otra de megagrupo desde dos cuentas con acceso al recurso.
9. Retira una reacción, vuelve a añadirla y comprueba que el recuento y el estado seleccionado se actualizan en ambas cuentas.

## 4. Notas de compatibilidad

- La agrupación se basa en mensajes consecutivos de la misma cuenta e identidad alternativa y en una diferencia máxima de cinco minutos.
- La agrupación es una preferencia local a la cuenta, guardada en `profiles.settings`.
- Los colores de interfaz también son preferencias individuales guardadas en `profiles.settings`.
- Los emojis personalizados se representan en `message_reactions.emoji` como `custom:<uuid>`; por eso la migración SQL es necesaria antes de usar esta función.
- No se requiere cambiar claves, buckets, Edge Functions ni credenciales.
- La alpha no se debe marcar como estable hasta probarla contra el proyecto Supabase real y en varios navegadores/dispositivos.
