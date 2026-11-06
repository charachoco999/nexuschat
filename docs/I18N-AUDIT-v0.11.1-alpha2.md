# Auditoría de localización · Nexus v0.11.1-alpha2

## Resultado

La localización actual es parcial. El selector ofrece 15 variantes contando español y la variante de Julio Verne, pero el catálogo no representa toda la interfaz.

| Área | Resultado |
|---|---:|
| Claves fuente en el catálogo | 101 |
| Idiomas destino | 14 |
| Traducciones existentes en el catálogo | 1.414 |
| Textos únicos visibles detectados en `index.html` | 658 |
| Textos HTML que no tienen una clave exacta en el catálogo | 577 |
| Asignaciones de texto dinámico inspeccionadas en `assets/js/app.js` | 389 |
| Candidatos dinámicos distintos encontrados | 366 |

La auditoría dinámica es una extracción por patrones, no una enumeración exhaustiva de todas las cadenas del proyecto. No cuenta textos construidos mediante datos del servidor ni todos los fragmentos de plantillas. Las cadenas heredadas detectadas se guardan en `scripts/i18n-alpha2-untranslated-baseline.json`: CI permite temporalmente ese legado, pero falla cuando se añade una nueva cadena visible fuera del catálogo. Las cifras sirven para dimensionar el trabajo, no para certificar un porcentaje de traducción total.

## Qué debe cubrir v0.11.2 en español

- Inventariar y normalizar los textos estáticos de todas las secciones.
- Revisar todos los textos que se generan desde JavaScript: errores, toasts, confirmaciones, menús contextuales, estados vacíos, permisos, cargas, llamadas y multimedia.
- Unificar terminología: conversación, MD, canal, megagrupo, aliado, identidad alternativa, insignia y permisos.
- Evitar frases concatenadas que no permitan cambiar el orden de palabras por idioma.
- Diferenciar mensajes de la interfaz del contenido escrito por usuarios, que nunca debe traducirse.
- Marcar como intencional el contenido técnico que no se traduce: código, URLs, claves, comandos y nombres elegidos por usuarios.

## Qué debe cumplir v0.12.0 antes de publicarse

- Todas las cadenas de interfaz visibles tienen clave fuente española.
- Cada clave dispone de traducción para inglés, esloveno, italiano, francés, japonés, chino simplificado, alemán, portugués europeo, guaraní, catalán, gallego, euskera, latín y español Julio Verne.
- El selector, la detección de idioma, los placeholders, los tooltips, los errores y las notificaciones usan el mismo locale.
- Se ha revisado la interfaz en escritorio y móvil para cada idioma, en particular el ajuste de textos largos y las fuentes CJK.
- Se ha ejecutado `node scripts/check-i18n.mjs --require-complete`.
- Guaraní y latín siguen identificados como beta hasta una revisión humana competente. La variante Julio Verne es únicamente un easter egg.
- Los documentos legales traducidos mantienen una advertencia de que la versión española es la fuente oficial mientras las demás no hayan recibido revisión jurídica.

## Exclusiones necesarias

No se deben traducir mensajes de usuario, nombres de usuario, biografías, texto de perfil elegido por sus titulares, mensajes adjuntos, bloques de código ni contenido Markdown de los usuarios. Una cobertura completa de la interfaz no significa traducir conversaciones privadas.
