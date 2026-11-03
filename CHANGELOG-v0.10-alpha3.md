# Nexus v0.10.0-alpha.3 — cambios

Esta entrega amplía el Markdown de Nexus en la rama 0.10 para web y móvil. No abre la rama 0.11 y no modifica Nexus Desktop. Continúa siendo una versión alpha.

## Markdown personalizado

- Atributos visuales combinables y anidables: colores predefinidos o hexadecimales, tamaño, familia tipográfica y glow. El parser admite hasta 256 niveles de anidación como límite defensivo frente a mensajes patológicos.
- Citas de fuentes web y libros mediante `{src:web:...}` y `{src:book:...}`. Genera una referencia APA 7 básica con los datos proporcionados y `(s. f.)` cuando no se aporta fecha. No extrae autor o fecha automáticamente de la web ni inventa metadatos.
- Separador `{dinbreak}`.
- Botones externos `{button:color:texto:url}`; la URL es opcional y los enlaces se abren en otra pestaña.
- Tarjetas de invitación `{invite:título:descripción:"banner":"url"}`. El banner admite una URL HTTPS o un color hexadecimal.
- Controles InputSync para texto, búsqueda, correo, teléfono, URL, casilla, radio, número, rango, fecha, hora, mes, semana y color. Comparten su estado entre miembros autorizados que pueden leer el mensaje. Las radios con la misma clave dentro del mensaje forman un grupo mutuamente excluyente.
- Bloques de código con copiar/descargar usando `&&buttons=true` en la cabecera de la valla de código.
- Menciones de usuario clicables cuando están reconocidas en los metadatos del mensaje; menciones `#canal` en el megagrupo actual y referencias globales `{community_uuid:category:channel}`.
- NexCSS Beta con pestañas para la página HTML de prueba automática y el CSS escrito por el usuario. El CSS se muestra en un iframe aislado con sandbox y CSP estricta. Se eliminan imports, URLs, expresiones y recursos externos; no se ejecuta JavaScript.
- Tablas Beta con secciones head/body/footer y celdas con `colspan` y `rowspan`. El contenido de las celdas se representa como texto, con límites de filas/columnas y un aviso rojo de sintaxis beta.
- Retrasos `{delay:contenido}` (1.200 ms por defecto) o `{delay:milisegundos:contenido}`, con máximo de 30.000 ms y opción para desactivarlos desde Optimizaciones.
- Iconos inline HTTPS, hover básico y spoilers con `||contenido||`, `{spoiler:contenido}` o `{SPOILER=true}` para ocultar el mensaje entero.
- El parser de menciones evita insertar botones dentro de otros enlaces, controles y bloques interactivos.

## Adjuntos y rendimiento

- Vista previa limitada de CSV, TSV, XLS, XLSX y ODS, con descarga del archivo original. La previsualización muestra como máximo 16 filas y 12 columnas.
- Se amplía el selector de archivos del compositor para que las hojas de cálculo también se puedan elegir desde móvil.
- Los estados InputSync se cargan en una consulta por lote al renderizar páginas de mensajes; los mensajes nuevos que llegan individualmente conservan la carga puntual.
- Se conserva la corrección de tamaño de iconos de medallas globales en listas de miembros.
- Se conserva el ajuste de ancho, BoxGlow y placa visual de las cajas de mensajes agrupados, con opción de compatibilidad para desactivarlo en Configuración → Optimizaciones.

## Migración

La funcionalidad InputSync y la lista MIME para hojas de cálculo necesitan `supabase/migrations/20261103_nexus_v0103_markdown_inputs_sync_spreadsheets.sql`. Es idempotente y puede ejecutarse una sola vez si aún no se había aplicado. No hace falta una migración nueva para el resto del Markdown alpha3.

## Limitaciones conocidas

- Las referencias APA son plantillas básicas. El usuario debe proporcionar un nombre de fuente fiable y completar autor, fecha, título editorial y demás datos que exija su institución; Nexus no consulta metadatos bibliográficos remotos.
- NexCSS sigue siendo Beta. Su vista de prueba es una muestra generada por Nexus, no un editor HTML arbitrario. No admite imports, URLs ni JavaScript.
- La sintaxis de tablas sigue siendo Beta y no pretende aceptar cualquier HTML.
- InputSync está acotado al mensaje y al contexto que las políticas RLS permiten leer; no es un sistema de formularios globales.
- Las previsualizaciones de hojas de cálculo son parciales, no editables y no sustituyen a una aplicación de hojas de cálculo.
- Se requiere probar InputSync entre dos cuentas, las vistas de adjuntos desde móviles y los bloques Markdown en navegadores distintos contra la instancia Supabase real antes de declarar estable esta alpha.
