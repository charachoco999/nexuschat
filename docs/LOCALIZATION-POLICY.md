# Política de idiomas e internacionalización de Nexus

## Decisión de publicación

Nexus mantendrá el español como idioma fuente y publicará las traducciones completas en una entrega posterior, en lugar de presentar como terminada una interfaz que todavía mezcla idiomas.

- **v0.11.2 · base española:** estabilizar y cerrar el inventario de los textos visibles, mensajes de sistema, diálogos, notificaciones, errores, formularios, accesibilidad y documentación.
- **v0.12.0 · localización:** publicar las traducciones revisadas y completar el selector de idioma para toda la interfaz.
- **Versiones siguientes:** cada nueva función se escribe primero en español, pero no se considera lista para publicar hasta que incluya las claves y traducciones de todos los idiomas activos.

## Idiomas

Español (fuente), inglés, esloveno, italiano, francés, japonés, chino simplificado, alemán, portugués europeo, guaraní (beta), catalán, gallego, euskera, latín (beta) y español Julio Verne (variante lúdica).

Guaraní y latín conservarán la marca beta hasta que personas con competencia lingüística puedan revisar los textos. La variante Julio Verne es un easter egg, no un idioma de soporte ni una traducción formal.

## Reglas para escribir interfaz nueva

### HTML estático

Usar claves explícitas y mantener como clave el texto fuente español:

```html
<h2 data-i18n="Configuración">Configuración</h2>
<input
  data-i18n-placeholder="Buscar usuarios"
  placeholder="Buscar usuarios"
  aria-label="Buscar usuarios"
/>
```

Para atributos se admiten:
- `data-i18n-placeholder`
- `data-i18n-title`
- `data-i18n-aria-label`
- `data-i18n-alt`
- `data-i18n-value` (solo para valores iniciales de controles escritos en el código; no para texto introducido por una persona)

### JavaScript dinámico

Usar la API del catálogo, no construir frases traducibles mediante concatenación:

```js
const title = window.NexusI18n.t('Configuración');
const notice = window.NexusI18n.t('Hola, {{username}}', { username });
```

Cada clave nueva debe incluir un valor para todos los idiomas de `NexusI18n.locales`, salvo el español fuente. Las frases deben traducirse como unidades completas para que el orden gramatical pueda cambiar por idioma.

### Contenido que no se traduce automáticamente

No traducir mensajes escritos por usuarios, nombres de usuario, nombres propios elegidos por usuarios, biografías, código, fragmentos Markdown, enlaces, URLs, claves técnicas ni contenido adjunto. El sistema debe preservar esos datos exactamente.

Fechas, horas y números deben formatearse mediante `Intl.DateTimeFormat`, `Intl.NumberFormat` y el locale devuelto por `NexusI18n.intlLocale()`.

## Revisión de calidad

1. No aceptar traducciones vacías ni claves duplicadas.
2. Revisar la interfaz completa en escritorio y móvil, incluidos errores, estados vacíos, tooltips y accesibilidad.
3. Comprobar desbordamientos por textos más largos y tipografías CJK.
4. Mantener los códigos de idioma y los nombres de idioma en su forma nativa.
5. Pedir revisión humana para guaraní y latín beta y para textos legales.
6. Ejecutar `node scripts/check-i18n.mjs` en cada cambio del catálogo. El control CI conserva una lista base de las cadenas heredadas de alpha2 y falla si una modificación introduce una nueva cadena visible sin clave traducible.
7. Durante la fase de inventario, revisar los textos HTML y JavaScript sin catalogar. Antes de publicar v0.12.0, ejecutar `node scripts/check-i18n.mjs --require-complete` y eliminar las omisiones justificadas una por una.

## Estado de partida auditado

La revisión de alpha2 encontró 101 claves en el catálogo actual y 14 idiomas destino. El HTML principal contiene bastantes más textos fijos que no aparecen en el catálogo; además, buena parte de los textos creados desde JavaScript se genera dinámicamente en `assets/js/app.js`. Por tanto, tener los 15 idiomas en el selector no equivale a tener la web traducida.

El documento legal español sigue siendo la fuente oficial. Las traducciones legales serán informativas hasta que se revisen de forma competente; no deben presentarse como asesoramiento ni como equivalentes jurídicos oficiales.
