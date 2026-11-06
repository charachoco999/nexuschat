# Idiomas de Nexus v0.11.1-alpha2

## Variantes disponibles

| Código | Idioma | Estado |
|---|---|---|
| `es` | Español | Predeterminado |
| `en` | Inglés | Catálogo principal |
| `sl` | Esloveno | Catálogo principal |
| `it` | Italiano | Catálogo principal |
| `fr` | Francés | Catálogo principal |
| `ja` | Japonés | Catálogo principal |
| `zh-CN` | Chino simplificado | Catálogo principal |
| `de` | Alemán | Catálogo principal |
| `pt-PT` | Portugués | Catálogo principal |
| `gn` | Guaraní / Avañe’ẽ | Beta |
| `ca` | Catalán | Catálogo principal |
| `gl` | Gallego | Catálogo principal |
| `eu` | Euskera | Catálogo principal |
| `la` | Latín | Beta |
| `es-jv` | Español (Julio Verne) | Easter egg original |

## Dónde se selecciona
- Pantalla de acceso, antes de iniciar sesión.
- Configuración, con sincronización en el perfil al guardar.
- Pantalla de aceptación de condiciones, para que el usuario pueda cambiar la interfaz sin abandonar el diálogo.

## Cobertura real de esta alpha

El catálogo local contiene 101 cadenas traducidas a las 14 variantes adicionales. Cubre frases de acceso, navegación, ajustes principales, preferencias de idioma, diálogos de ToS y novedades, y varios mensajes comunes. La interfaz tiene más de 500 cadenas estáticas y mensajes generados dinámicamente; por tanto, esta alpha **no equivale todavía a una traducción completa**. Las cadenas ausentes permanecen en español.

No se envía texto de mensajes, perfiles ni contenido escrito por usuarios a servicios de traducción. El traductor local ignora áreas de contenido generado por usuarios. La fecha y hora usan `Intl` cuando el locale está disponible; Guaraní y Latín usan un locale de formato de respaldo.

Guaraní y Latín están marcados como beta y requieren revisión de hablantes/conocedores. `es-jv` usa frases originales de aventura y exploración inspiradas en la literatura de viajes del siglo XIX; no altera permisos, avisos legales ni textos de seguridad.

## Cómo añadir traducciones

1. Edita `assets/i18n/i18n.js`.
2. Añade la frase original en español como clave de `CATALOG`.
3. Añade su traducción para los códigos de locale definidos en `LOCALES`.
4. No traduzcas ni alteres contenido de usuario, código, nombres de usuario, IDs, URLs, datos técnicos ni entradas de configuración.
5. Prueba cambio de idioma antes y después de iniciar sesión, Configuración, popup de ToS y popup de novedades.
6. Mantén español como fallback para claves que todavía no tengan traducción.

La versión legal aceptada se sirve en español como documento autoritativo en esta alpha. No se presenta una traducción de interfaz como traducción jurídica equivalente.
