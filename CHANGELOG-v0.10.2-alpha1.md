# Nexus v0.10.2-alpha1 — mensajería, administración e identidad

Entrega alpha de la rama 0.10. No actualiza Nexus Desktop ni declara la plataforma lista para producción.

## Mensajería y archivos
- Acción **Reenviar** en cada mensaje, con destino entre MDs/grupos y canales de texto.
- Los mensajes reenviados conservan adjuntos cuando los permisos y el límite de 50 MB lo permiten y muestran la etiqueta «Reenviado».
- El selector permite elegir varios archivos. El texto del compositor se adjunta como descripción del primer archivo del lote; los demás se publican consecutivamente.
- Reproductor de vídeo integrado, controles nativos, inline en móvil, pantalla completa y descarga.
- Separadores por día, independientes de la opción de agrupar mensajes.

## Markdown y ayuda
- Página ampliada de Markdown con ejemplos correctos/incorrectos, límites, seguridad, tablas, NexCSS, InputSync y referencias APA.

## Panel de administración
- Panel separado reservado a `is_platform_admin()`.
- Búsqueda por username o nickname, fecha de creación, última actividad, estado de ban y silencio.
- Revisión de sugerencias/bugs y asignación opcional de medalla al resolver.
- Ban temporal o permanente, desban, silencio temporal y advertencias vía buzón `Nexus (App)`.

## Perfiles, emojis y stickers
- Perfil por megagrupo con personalización propia, widgets y fuentes separadas; Quick-Alt se mantiene global.
- Mejor visualización de mensajes compuestos solo por emojis y control de visibilidad de emojis personales.
- Sticker Workshop para publicar, buscar, instalar, enviar y retirar stickers.

## Optimización
- Megacompactación BETA, requiere activar Compactar paneles y avisa de su posible impacto en dispositivos de gama baja.

## Compatibilidad y límites
- Se conservan WAV PCM mono a 16 kHz para notas de voz, búsqueda de emojis, sugerencias `:emoji:`, cancelación de eco/ruido del navegador y diseño compacto móvil.
- Máximo de 50 MB por archivo.
- Última actividad aproximada; no es una medición continua.
- La selección múltiple publica un mensaje por archivo y solo añade la descripción al primero.

## Validación
Comprobaciones estáticas de JavaScript, HTML, CSS, estructura de archivos, referencias y ZIP. No se han realizado pruebas reales contra el Supabase del usuario ni en una matriz física Android/iOS/escritorio; esta entrega sigue siendo alpha.
