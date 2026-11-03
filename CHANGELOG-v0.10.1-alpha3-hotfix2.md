# Nexus v0.10.1-alpha3 — Hotfix 2

Esta entrega continúa la rama 0.10. No abre la 0.11 y no modifica Nexus Desktop.

## Correcciones

- Serializa la reconstrucción de mensajes para evitar que eventos Realtime simultáneos deshagan el agrupado o alteren el scroll.
- Conserva la información decorativa de cada mensaje (placa y BoxGlow) aunque se pinte una única caja agrupada.
- Conserva el ancla visual del historial y no fuerza el scroll al fondo si el usuario se ha desplazado durante una carga asíncrona.
- Desactiva el scroll suave implícito en las correcciones de `scrollTop`, manteniendo el desplazamiento explícito a mensajes citados.
- En móviles verticales, Compactar paneles deja de imponer la cuadrícula de escritorio: se restaura una sola columna, la bandeja de chats y el menú lateral.

## Calidad de vida mantenida y ampliada

- Se mantiene el buscador del selector de emojis y el autocompletado `:alias:`.
- Se añaden aliases en español: `:gato:`, `:perro:`, `:sonrisa:`, `:risa:`, `:corazon:`, `:pulgar_arriba:`, `:pulgar_abajo:`, `:fuego:`, `:estrella:`, `:cohete:` y otros.
- Se mantiene la cancelación básica de eco, supresión de ruido y control automático de ganancia en VC, si el navegador los admite.
- Se mantiene la grabación de notas de voz en WAV PCM mono a 16 kHz, en vez de depender de WebM/MP4 elegidos por cada navegador. El máximo de grabación es 15 minutos y el archivo respeta el límite de 50 MB.

## Migración

No requiere migración SQL. La configuración de cancelación de voz está guardada en `profiles.settings`; la grabación WAV utiliza el MIME `audio/wav`, que ya está incluido en las migraciones anteriores de `chat-media`.

## Validación

- `node --check assets/js/app.js`: correcto.
- HTML: 280 atributos `id`, sin duplicados.
- CSS: llaves equilibradas.
- Estructura WAV: cabecera RIFF/WAVE PCM, mono, 16 kHz validada.
- Pruebas de integración contra Supabase y pruebas físicas entre Android/iOS: pendientes; esta compilación sigue siendo beta.
