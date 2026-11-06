# Estado del cifrado de extremo a extremo (E2EE) — Nexus v0.11.1-alpha2

## Estado actual: NO IMPLEMENTADO

Los mensajes directos de Nexus **no están cifrados de extremo a extremo** en esta versión. El contenido viaja por HTTPS/TLS y se almacena usando la infraestructura y los permisos del proyecto Supabase, pero eso no impide que el operador del proyecto o una persona con acceso administrativo suficiente al backend pueda acceder técnicamente a esos datos.

No presentes Nexus como un servicio E2EE y no introduzcas información cuya confidencialidad dependa de E2EE.

## Arquitectura elegida

Se ha elegido investigar la ruta B: Signal Protocol en los dispositivos, con Supabase como transporte y almacenamiento de ciphertext/prekeys públicas. No se añadirá un homeserver Matrix.

La implementación oficial `signalapp/libsignal` presenta obstáculos antes de su integración: declara que el uso fuera de Signal no está soportado, las APIs pueden cambiar, su paquete Node utiliza bindings nativos `.node` y su licencia es AGPL-3.0-only. Debe evaluarse la compatibilidad legal y técnica de cualquier adaptación a navegador/WASM antes de incorporarla.

## Bloqueos técnicos

- Identidad criptográfica por dispositivo y verificación de claves.
- PQXDH y Double Ratchet mediante una implementación mantenida; no escribir algoritmos propios.
- Gestión de prekeys en Supabase con operaciones atómicas y protección contra abuso.
- Rotación, alta, transferencia, revocación y pérdida de dispositivos.
- Cifrado del texto, Markdown, menciones, adjuntos, previews y miniaturas.
- Copia de seguridad cifrada y recuperación sin que el servidor pueda obtener las claves.
- Reportes voluntarios cifrados para claves de moderación.
- Notificaciones sin contenido de mensajes.
- Protección contra XSS y cadena de publicación confiable: un cliente web comprometido puede capturar texto antes de cifrarlo o después de descifrarlo.

## Criterios de activación

No habilitar E2EE hasta disponer de una build browser/WASM mantenible, revisión de licencia, pruebas de interoperabilidad, pruebas de mensajes duplicados/perdidos/reordenados/replay, pruebas multi-dispositivo, verificación y revocación de claves, cifrado de archivos y una revisión criptográfica independiente.

Plan detallado: `E2EE-SIGNAL-ROADMAP-v0.11.1-alpha2.md`.

Referencias técnicas: https://github.com/signalapp/libsignal · https://signal.org/docs/specifications/pqxdh/ · https://signal.org/docs/specifications/doubleratchet/.
