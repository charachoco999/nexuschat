# Actualizar Nexus v0.1 → v0.2

Esta guía es para un repositorio y un proyecto Supabase que ya están funcionando.

## 1. Corregir la subida de imágenes y archivos

1. Abre el proyecto Supabase que usa Nexus.
2. Entra en **SQL Editor** y crea una consulta nueva.
3. Copia y ejecuta todo `supabase/fix-chat-media-rls.sql`.
4. No hagas público el bucket `chat-media` ni desactives RLS.
5. Recarga Nexus con `Ctrl + F5` y prueba una imagen en un MD y otra en un canal del megagrupo.

El parche mantiene los archivos privados. Solo permite subir a una conversación si perteneces a ella, o a un canal si perteneces al megagrupo y tienes `send_messages`.

## 2. Actualizar la aplicación de GitHub Pages

1. Descomprime `nexus-chat-v0.2-upgrade.zip`.
2. Sube/sustituye los archivos de la carpeta `nexus-chat/` en la raíz del repositorio, conservando sus rutas (`assets/`, `supabase/`, `index.html`).
3. **No borres ni sustituyas `assets/js/config.js`**: conserva el archivo que ya contiene la URL y la clave pública de tu proyecto Supabase.
4. Espera a que GitHub Pages publique los cambios y recarga con `Ctrl + F5`.

El paquete de actualización omite intencionadamente `assets/js/config.js` para no borrar tu configuración.

## 3. Aplicar la mejora de permisos de medallas

En Supabase SQL Editor, ejecuta también `supabase/migrations/20261031_harden_community_badges.sql`. Esto limita las asignaciones de medallas de megagrupo a miembros de esa misma comunidad y a cuentas autorizadas a gestionarlas.

## 4. Qué aparece en v0.2

- Panel para crear, editar y eliminar roles, asignar colores y configurar permisos.
- Panel para asignar y retirar roles a los miembros.
- Panel para crear medallas con emoji o URL HTTPS y asignarlas/retirarlas a miembros.
- Los colores de los roles y las medallas se muestran junto al nombre en los mensajes del megagrupo.
- Errores de RLS al subir adjuntos muestran una indicación concreta sobre el parche de Storage.

No incluye todavía voz real, buscador externo de GIFs, ni los editores completos de Quick-Alt, stickers/emojis y personalización avanzada.
