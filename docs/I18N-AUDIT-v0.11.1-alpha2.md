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
