# Auditoría de localización de Nexus v0.12.0

## Arquitectura

La interfaz utiliza un catálogo español como fuente y catálogos de destino locales. El runtime `assets/i18n/i18n.js` se carga antes de `catalog-extra-v0.12.js` y de `assets/js/app.js`. La traducción funciona en el navegador, sin servicios externos.

## Cobertura

- 893 claves fuente.
- 14 locales de destino.
- 12.502 valores de traducción esperados.
- 0 valores de destino vacíos.
- Auditoría estática: 1.005 cadenas candidatas, 23 excepciones intencionales y 0 nuevas cadenas de interfaz sin traducir.

El contenido generado por usuarios (mensajes, perfiles, nombres, adjuntos, código y Markdown) se excluye deliberadamente. Las 23 excepciones son marca, identificadores de funciones, ejemplos de código o datos de demostración.

## Límites

La auditoría es estática; no prueba todas las combinaciones de pantallas ni los textos que llegan desde servicios externos. La revisión visual completa en escritorio y móvil está pendiente. Guaraní y latín siguen en beta y requieren revisión humana. El documento legal autoritativo continúa en español hasta que sus traducciones reciban una revisión jurídica independiente.

## Comprobación

Desde la raíz del proyecto, ejecutar `node scripts/check-i18n.mjs`. El comprobador valida los catálogos y compara el HTML y los puntos de inserción de texto de JavaScript con las excepciones documentadas.
