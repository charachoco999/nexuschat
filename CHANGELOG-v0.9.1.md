# Nexus v0.9.1 — hotfix de medios, voz y desplazamiento

Este parche se aplica sobre Nexus v0.9. No añade tablas ni requiere una migración nueva de Supabase.

## Cambios

- **Voz persistente al cambiar de canal:** cambiar entre canales de texto, anuncios y multimedia dentro del mismo megagrupo ya no abandona automáticamente la sala de voz. El audio remoto permanece en un host persistente fuera del panel que se reemplaza al navegar. Se muestra una barra de llamada con controles para silenciar/reactivar el micrófono y salir.
- **Pegar imágenes y vídeos:** Ctrl+V en el compositor admite imágenes PNG, JPG, WebP y GIF, además de vídeos MP4 y WebM cuando el portapapeles del sistema los expone como archivos.
- **Visor de imágenes:** pulsar una imagen adjunta, un sticker o un GIF abre un visor modal adaptable a escritorio y móvil. Incluye acceso al original.
- **Archivos ZIP:** se normalizan los MIME `application/x-zip-compressed` y `application/octet-stream` de archivos `.zip` a `application/zip`, después de comprobar la firma ZIP. Se mantiene el límite actual de 50 MB.
- **Estados de carga:** se añaden esqueletos para la bandeja y el historial de mensajes. Los cambios de altura al cargar imágenes o metadatos de vídeo mantienen el scroll al final solo si el usuario ya estaba cerca del final.
- **Mensajes adaptables:** los bloques de mensaje ocupan el ancho disponible del panel, en lugar de quedarse limitados a 900 px.
- Se versionan las referencias CSS/JS para evitar que el navegador reutilice el frontend anterior en caché.

## Límites y comportamiento deliberado

- La sesión de voz se conserva al cambiar entre canales del mismo megagrupo. Cambiar a MDs, a otra sección principal, a otro megagrupo o a otra sala de voz sí abandona la sala actual.
- El pegado de vídeos depende de que el sistema operativo y el navegador/WebView entreguen el vídeo como un archivo en el evento `paste`.
- Los ZIP siguen sujetos al límite de 50 MB del bucket `chat-media`.
