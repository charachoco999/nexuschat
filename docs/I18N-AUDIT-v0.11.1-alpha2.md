<<<<<<< HEAD
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
=======
# Auditoría de localización de Nexus

## Arquitectura

La interfaz utiliza un catálogo español como fuente y un conjunto de catálogos de destino. El runtime carga `assets/i18n/i18n.js` y, a continuación, `assets/i18n/catalog-extra-v0.12.js`.

La comprobación automática lee ambos catálogos combinados. Esto es importante: analizar solo el catálogo original produce falsos positivos porque el navegador carga también el catálogo ampliado.

## Criterios

- Toda clave incorporada al catálogo debe tener una cadena no vacía en los 14 idiomas destino.
- Los mensajes escritos por usuarios, los nombres elegidos por usuarios, el contenido de perfil, el código, los ejemplos Markdown, las URLs y los adjuntos no se traducen.
- Las cadenas de interfaz heredadas que todavía no estén inventariadas pueden mostrarse en español como fallback. No se debe confundir cobertura completa de claves con cobertura completa de todas las pantallas.
- Las cadenas nuevas deben usar `NexusI18n.t()` o los atributos `data-i18n*` documentados.
- Guaraní y latín están en beta; Julio Verne es una variante lúdica.
- Los Términos y Condiciones en español continúan siendo la referencia jurídica hasta que las traducciones se revisen por separado.

## Verificación automatizada

El workflow `.github/workflows/i18n-check.yml` ejecuta `node scripts/check-i18n.mjs` en cada push a `main` y en las solicitudes de cambios. El mismo workflow crea el ZIP de actualización y lo publica como artefacto de GitHub Actions.

Para una declaración de localización completa todavía hace falta:
1. Ejecutar el workflow y confirmar que termina correctamente.
2. Completar la auditoría de las cadenas heredadas de HTML y JavaScript que no están en el catálogo.
3. Revisar visualmente las pantallas en escritorio y móvil, incluidas las escrituras CJK y los textos largos.
4. Hacer revisión humana de Guaraní y Latín.
5. Encargar la revisión separada de las traducciones jurídicas antes de ofrecerlas como oficiales.
>>>>>>> 6e48341df433dfa91df0459abb5436cf46312e4f
