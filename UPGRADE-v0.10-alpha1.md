# Actualizar Nexus v0.9.1 → v0.10.0-alpha.1

Esta actualización amplía la aplicación web y móvil. No modifica ni actualiza el proyecto de Nexus Desktop; la rama Desktop y su actualizador automático quedan aparcados.

## Antes de empezar

1. Haz una copia del repositorio de GitHub.
2. Crea una copia de seguridad de la base de datos en Supabase.
3. Comprueba que estás actualizando desde v0.9.1. No omitas las migraciones anteriores de v0.2 a v0.9.
4. Conserva tu `assets/js/config.js`. El paquete de actualización no incluye credenciales.

## 1. Migración de Supabase

En Supabase → SQL Editor, ejecuta una sola vez:

`supabase/migrations/20261102_nexus_v010_features.sql`

La migración: 

- Añade `channels.category`, asignando `General` a los canales existentes.
- Añade `profiles.message_font_url`, independiente de `name_font_url`.
- Amplía la lista MIME del bucket privado `chat-media` para admitir notas de voz (`audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, `audio/wav` y `audio/x-wav`), conservando imágenes, vídeos, PDF, texto y ZIP. Mantiene el límite de 50 MB y no cambia las políticas RLS del bucket.
- Crea `global_badges` y `global_badge_assignments`, con políticas que permiten gestión solo a cuentas con `user_roles.role = 'admin'`.

No borra mensajes, conversaciones, miembros ni perfiles. Las preferencias de sonido, notificaciones, BoxGlow y paginación viven en `profiles.settings`; el archivo de sonido se guarda localmente en IndexedDB.

## 2. Publicar la web

1. Descomprime `nexus-chat-v0.10-alpha1-upgrade.zip`.
2. Sube el contenido de la carpeta `nexus-chat/` a la raíz del repositorio de GitHub Pages y acepta sustituir los archivos existentes.
3. Conserva `assets/js/config.js`; no lo reemplaces por `config.js.example`.
4. Espera a que GitHub Pages termine el despliegue y fuerza la recarga con `Ctrl + F5` en escritorio. En móvil, cierra la pestaña o aplicación instalada y vuelve a abrirla.

## 3. Pruebas recomendadas

1. Graba y envía una nota de voz en un MD y en un canal; comprueba la reproducción desde otra cuenta.
2. Entra a un canal de voz con dos cuentas desde navegadores compatibles, inicia y detén la compartición de pantalla y comprueba el vídeo remoto.
3. Cambia la categoría de un canal, crea otra categoría y comprueba que los canales existentes siguen agrupados en `General`.
4. Configura un megagrupo en solo menciones, luego cambia un canal concreto a `Todos los mensajes`; comprueba que prevalece el ajuste individual.
5. Cambia la paginación a 25 y a 100 mensajes y comprueba la carga de mensajes anteriores.
6. Envía un bloque de código con lenguaje (por ejemplo `js`) y enlaces HTTPS.
7. Prueba Markdown personalizado y la fuente de mensajes con dos cuentas; confirma que la fuente se muestra al receptor.
8. Activa BoxGlow y revisa mensajes y ficha pública.
9. Como administrador de plataforma, crea y asigna una medalla universal; comprueba que un usuario puede ocultarla en Configuración. Comprueba que un administrador de megagrupo sin rol global `admin` no puede gestionar medallas universales.

## 4. Limitaciones

- Compartir pantalla necesita HTTPS y soporte de `navigator.mediaDevices.getDisplayMedia`. En navegadores móviles sin esta API, el botón se desactiva.
- La grabación de audio necesita permiso del micrófono y `MediaRecorder`. Algunos navegadores usan `audio/mp4` y otros `audio/webm` o `audio/ogg`.
- La vista previa de enlaces es ligera (favicon, texto y dominio), no extrae Open Graph.
- El sonido personalizado es local a cada instalación/navegador.
- La voz sigue siendo P2P/STUN; redes restrictivas pueden necesitar un servidor TURN.
- Esta alpha ha pasado comprobaciones estáticas, pero necesita pruebas reales contra Supabase y entre dos dispositivos.
