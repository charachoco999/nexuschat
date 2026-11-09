# Política de idiomas e internacionalización de Nexus

## Fuente y publicación

El español es el idioma fuente. Nexus v0.12.0 completa el inventario estático de la interfaz heredada de v0.11.1-alpha2 y ofrece catálogos locales para 14 variantes adicionales. Cada función nueva debe incorporar sus claves y traducciones en la misma entrega.

## Idiomas

Español (fuente), inglés, esloveno, italiano, francés, japonés, chino simplificado, alemán, portugués europeo, guaraní (beta), catalán, gallego, euskera, latín (beta) y español Julio Verne (variante lúdica). La variante Julio Verne es un easter egg, no un idioma de soporte formal.

Guaraní y latín conservarán la marca beta hasta que personas con competencia lingüística revisen sus textos.

## Reglas para interfaz nueva

### HTML estático

Usar claves explícitas y mantener como clave el texto fuente español:

```html
<h2 data-i18n="Configuración">Configuración</h2>
<input data-i18n-placeholder="Buscar usuarios" placeholder="Buscar usuarios" aria-label="Buscar usuarios" />
```

Para atributos se admiten `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria-label`, `data-i18n-alt` y `data-i18n-value`. Este último se limita a valores iniciales escritos en el código, nunca a texto introducido por una persona.

### JavaScript dinámico

Usar `window.NexusI18n.t()` con frases completas y variables:

```js
const title = window.NexusI18n.t('Configuración');
const notice = window.NexusI18n.t('Hola, {{username}}', { username });
```

Cada clave nueva debe incluir valores no vacíos para todos los locales distintos del español. No concatenar fragmentos cuando el orden gramatical pueda variar.

## Contenido que no se traduce automáticamente

No traducir mensajes, nombres de usuario, nombres propios elegidos por usuarios, biografías, código, fragmentos Markdown, enlaces, URLs, claves técnicas ni adjuntos. El sistema conserva ese contenido en el idioma original. Las traducciones se sirven desde archivos locales; no se envían mensajes ni datos de perfil a servicios externos de traducción.

Fechas y horas usan los locales de `NexusI18n.intlLocale()` cuando el código de la función los contempla.

## Documento legal

El documento legal autoritativo continúa en español. El cambio de idioma de la interfaz no altera el documento que acepta la persona usuaria. Las traducciones legales deberán revisarse por separado antes de publicarse como equivalentes oficiales.

## Revisión de calidad

1. No aceptar traducciones vacías ni claves duplicadas.
2. Ejecutar `node scripts/check-i18n.mjs` en cada cambio.
3. Revisar visualmente la interfaz en escritorio y móvil, incluidos tooltips, errores, estados vacíos y textos largos.
4. Revisar desbordamientos y tipografías CJK.
5. Solicitar revisión humana para guaraní, latín y textos legales.

## Estado auditado en v0.12.0

El catálogo contiene 893 claves fuente y 14 locales de destino: 12.502 valores de traducción no vacíos. La auditoría estática de HTML y puntos de inserción de texto de JavaScript analiza 1.005 cadenas candidatas, registra 23 excepciones deliberadas (marcas, identificadores de funciones, ejemplos de código y datos de muestra) y no detecta nuevas cadenas de interfaz sin traducir.

La auditoría estática no sustituye una revisión manual de cada pantalla ni una prueba con datos reales.
