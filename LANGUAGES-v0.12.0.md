# Idiomas de Nexus v0.12.0

## Idiomas disponibles

| Código | Idioma | Estado |
|---|---|---|
| `es` | Español | Fuente y predeterminado |
| `en` | Inglés | Disponible |
| `sl` | Esloveno | Disponible |
| `it` | Italiano | Disponible |
| `fr` | Francés | Disponible |
| `ja` | Japonés | Disponible |
| `zh-CN` | Chino simplificado | Disponible |
| `de` | Alemán | Disponible |
| `pt-PT` | Portugués europeo | Disponible |
| `gn` | Guaraní / Avañe’ẽ | Beta; requiere revisión humana |
| `ca` | Catalán | Disponible |
| `gl` | Gallego | Disponible |
| `eu` | Euskera | Disponible |
| `la` | Latín | Beta; requiere revisión humana |
| `es-jv` | Español Julio Verne | Variante lúdica, no traducción formal |

## Cobertura auditada

El catálogo contiene traducciones para las 893 claves fuente que forman el inventario de la interfaz de esta versión y para las 14 variantes distintas del español. El comprobador valida 12.502 valores de destino y una auditoría estática de HTML y puntos de inserción de texto de JavaScript. La auditoría detecta 23 excepciones deliberadas (marca, nombres de funciones, ejemplos de código y datos ficticios) y no encuentra nuevas cadenas de interfaz sin traducir.

La interfaz se traduce en el navegador con catálogos incluidos en el propio proyecto. No se envían mensajes, perfiles ni contenido de usuarios a servicios externos de traducción. Los mensajes, nombres, biografías, adjuntos y contenido escrito por usuarios permanecen en el idioma original.

Guaraní y latín siguen en beta. La auditoría estática no sustituye una revisión visual completa en móviles y escritorio, y se recomienda revisión de hablantes competentes antes de retirar la marca beta.

## Documento legal

El documento legal autoritativo continúa en español. El selector cambia el idioma de la interfaz, pero no cambia el texto legal que la persona usuaria acepta. Cualquier traducción legal deberá revisarse por separado antes de presentarse como equivalente oficial.

## Para añadir una cadena nueva

Añade la clave fuente en español y un valor no vacío para cada locale en `assets/i18n/catalog-extra-v0.12.js` (o en el catálogo principal, cuando corresponda). Ejecuta `node scripts/check-i18n.mjs` y actualiza las traducciones antes de integrar nuevas funciones.
