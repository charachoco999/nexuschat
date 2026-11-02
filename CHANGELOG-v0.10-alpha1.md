# Nexus v0.10.0-alpha.1 — cambios

Esta es una entrega alpha centrada en la web y el cliente móvil. No es una versión 1.0.

## Comunicación

- Grabación y envío de mensajes de audio desde el compositor.
- Reproducción de adjuntos de audio dentro de los mensajes.
- Compartición de pantalla en canales de voz mediante una pista de vídeo WebRTC; controles para iniciar y detener la compartición.
- Indicador de dispositivo móvil o escritorio en la presencia.

## Canales y notificaciones

- Categorías de canales de megagrupo, editables por usuarios con permiso para gestionar canales.
- Preferencia individual por MD, grupo o canal: predeterminada, todos los mensajes, solo menciones o silenciado.
- Ajustes generales para notificaciones de MD, grupos y megagrupos y modo de solo menciones en megagrupos.
- Sonido personalizado almacenado en IndexedDB local, con límite de 1 MB.

## Rendimiento y presentación

- Límite configurable de 25, 50, 75 o 100 mensajes cargados por página.
- Coloreado de sintaxis con highlight.js en bloques de código.
- Vista previa ligera de enlaces HTTPS con favicon, texto del enlace y dominio.
- Tipografía de mensajes independiente de la tipografía del nombre de usuario.
- Markdown personalizado: colores, color hexadecimal, tamaño limitado, familia de fuente permitida y resplandor de color.
- Guía de Markdown en Configuración y en el compositor.
- BoxGlow para mensajes y tarjetas públicas de perfil, con color, intensidad y textura HTTPS opcional.

## Medallas universales

- Tablas y políticas RLS para las medallas globales.
- Gestión exclusiva de cuentas con `user_roles.role = 'admin'`; los moderadores de plataforma y administradores de megagrupo no obtienen este permiso automáticamente.
- Los usuarios pueden ocultar individualmente las medallas globales asignadas a su cuenta.

## Migración

`supabase/migrations/20261102_nexus_v010_features.sql` añade la categoría del canal, el campo `message_font_url`, MIME de audio en el bucket privado `chat-media` y las tablas/políticas para medallas universales. Las preferencias de notificación, BoxGlow, sonido local y número de mensajes se guardan en ajustes de perfil o almacenamiento local; no requieren tablas adicionales.

## Limitaciones conocidas

- La vista previa de enlaces no obtiene metadatos Open Graph del sitio remoto; muestra favicon, texto y dominio.
- El sonido personalizado se guarda por dispositivo/navegador y no se sincroniza con la cuenta.
- Compartir pantalla solo funciona en navegadores con `getDisplayMedia`, sobre un origen seguro (HTTPS); algunas plataformas móviles no lo soportan.
- La voz utiliza señalización Realtime y conexiones P2P/STUN existentes. Puede fallar en redes restrictivas sin TURN.
- La grabación de audio requiere permiso del micrófono y soporte de `MediaRecorder`; el formato depende del navegador.
- No se ha ejecutado una prueba real contra el proyecto Supabase del usuario ni una llamada WebRTC con dos cuentas.
