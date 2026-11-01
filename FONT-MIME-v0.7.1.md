# Nexus v0.7.1 — reparar la subida de fuentes

El error `mime type application/octet-stream is not supported` significa que Storage recibió un tipo genérico en vez del MIME de la fuente. Esta versión fuerza el tipo según la extensión (`.woff`, `.woff2` o `.ttf`) y vuelve a configurar el bucket `profile-media`.

## Pasos

1. Haz una copia de seguridad del repositorio y de Supabase.
2. En Supabase → SQL Editor, ejecuta una vez `supabase/migrations/20261104_nexus_v071_font_mime.sql`.
3. Sube el contenido de este paquete a la raíz del repositorio, sustituyendo los archivos anteriores. Conserva `assets/js/config.js`.
4. Espera a que GitHub Pages publique la actualización.
5. Cierra las pestañas de Nexus y vuelve a abrir `https://charachoco999.github.io/nexuschat/`. La nueva URL de `app.js` contiene `?v=0.7.1-font-mime-fix`, por lo que no debería reutilizar la versión anterior.
6. Prueba primero con una fuente `.ttf` pequeña.

## Si sigue fallando

En Supabase → Storage → Buckets → `profile-media`, comprueba que el bucket sea público para lectura y que Allowed MIME types incluya `font/ttf`, `font/woff` y `font/woff2`, además de los cuatro MIME de imagen. El límite de archivo debe ser 8 MB. No añadas `application/octet-stream`, porque permitiría subir cualquier tipo de archivo bajo un MIME genérico.

Si la consola sigue mostrando `application/octet-stream`, es probable que todavía se esté cargando un `app.js` antiguo. Comprueba en DevTools → Network que la petición termina en `app.js?v=0.7.1-font-mime-fix`.
