# Actualizar Nexus v0.11.0-alpha1 → v0.11.0-alpha1-hotfix1

Este hotfix corrige la disposición visual de Megacompactación. No cambia el esquema de Supabase ni requiere SQL.

## Antes de publicar

1. Haz una copia del repositorio actual.
2. Conserva `assets/js/config.js`; el paquete incremental no lo incluye.
3. No ejecutes de nuevo las migraciones de la 0.11.0-alpha1.

## Publicar la actualización

1. Descomprime `nexus-chat-v0.11.0-alpha1-hotfix1-upgrade.zip`.
2. Sube el contenido de `nexus-chat/` a la raíz del repositorio de GitHub Pages y acepta sustituir los archivos existentes.
3. Comprueba que se han actualizado `index.html`, `assets/css/app.css`, `assets/js/app.js` y `README.md`, además del registro de este hotfix.
4. Fuerza la recarga con `Ctrl + F5` en escritorio. En móvil, cierra la pestaña/PWA y vuelve a abrir Nexus.

## Comportamiento esperado

- En escritorio con Compactar paneles + Megacompactación activados, la columna lateral única contiene la barra de Chats / Amigos / Workshop / Stickers arriba y la lista de conversaciones debajo. El panel principal muestra la conversación elegida.
- Al entrar en Amigos, Workshop o Sticker Workshop, se conserva la barra de navegación y la lista de conversaciones vuelve al área de la vista de Chats.
- Al entrar en un canal de megagrupo, Nexus recupera la navegación normal del megagrupo y su lista de canales.
- En pantallas estrechas, la barra se muestra encima de la lista de MDs o de la página activa; la navegación de una sola columna y el botón de volver al chat siguen disponibles.
- Al desactivar Megacompactación, todos los paneles regresan a sus contenedores normales.

## Pruebas recomendadas

1. Activar primero Compactar paneles y después Megacompactación.
2. Verificar la barra y la lista de MDs en una sola columna lateral, sin los botones de navegación antiguos duplicados.
3. Abrir un MD, volver a la lista y cambiar entre Amigos, Workshop y Sticker Workshop.
4. Entrar en un megagrupo y abrir un canal; comprobar que vuelve la navegación de canales.
5. Desactivar Megacompactación y confirmar que la interfaz original se restaura.
6. Repetir en una ventana estrecha y tras cambiar la orientación del dispositivo.
