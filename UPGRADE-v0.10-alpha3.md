# Actualizar Nexus v0.10.0-alpha.2 → v0.10.0-alpha.3

Este parche amplía el Markdown personalizado, añade previsualización de hojas de cálculo y corrige detalles de presentación/rendimiento. Continúa dentro de la rama 0.10. No modifica Nexus Desktop ni introduce la versión 0.11.

## Antes de empezar

1. Haz una copia del repositorio de GitHub y una copia de seguridad de Supabase.
2. Comprueba que estás en v0.10.0-alpha.2 y que ya aplicaste la migración de alpha2 `20261103_nexus_v0102_grouped_messages_theme_emoji_reactions.sql`.
3. Conserva `assets/js/config.js`. No está incluido en el paquete incremental.
4. Comprueba que tu bucket privado `chat-media` sigue siendo privado.

## 1. Migración de InputSync y hojas de cálculo

En Supabase → SQL Editor, ejecuta una sola vez:

`supabase/migrations/20261103_nexus_v0103_markdown_inputs_sync_spreadsheets.sql`

Ejecuta esta migración si no la habías aplicado anteriormente. Es idempotente. Crea `nexus_input_sync_states` con políticas RLS que limitan lectura y escritura a miembros autenticados del contexto del mensaje, incorpora la tabla a Realtime y amplía los MIME permitidos del bucket privado `chat-media` para CSV, TSV, XLS, XLSX y ODS. No elimina mensajes, archivos ni conversaciones.

Si ya ejecutaste exactamente esta migración en una alpha anterior, no hace falta repetirla.

## 2. Publicar la web

1. Descomprime `nexus-chat-v0.10-alpha3-upgrade.zip`.
2. Sube el contenido de la carpeta `nexus-chat/` a la raíz del repositorio de GitHub Pages y acepta sustituir los archivos existentes.
3. Conserva `assets/js/config.js` y cualquier configuración propia. No copies `config.js.example` sobre tu configuración real.
4. Espera al despliegue de GitHub Pages y fuerza una recarga completa (`Ctrl + F5`). En móvil, cierra la pestaña o la aplicación instalada y vuelve a abrirla.
5. Comprueba que `index.html` carga los recursos con el identificador `v=0.10.0-alpha.3`.

## 3. Pruebas recomendadas

1. Apila varios estilos, por ejemplo `{red:{size:24:{glow:blue:Texto}}}`, y comprueba que conserva todos los atributos.
2. Prueba `{src:web:Nombre de la fuente:https://ejemplo.com}` y `{src:book:Autor o título:https://ejemplo.com/libro#page=12}`. Revisa manualmente los datos bibliográficos antes de citar académicamente.
3. Prueba `{dinbreak}`, botones con y sin URL, `{icon:https://...}`, tarjetas `{invite:...}`, hover y los dos tipos de spoiler.
4. Publica un mensaje con dos controles InputSync, abre el mismo chat con otra cuenta autorizada y cambia casillas, texto y radios. Comprueba que el estado llega en tiempo real.
5. Prueba menciones `@usuario`, `#canal` en el megagrupo actual y `{community_uuid:category:channel}` para un canal de otro megagrupo donde tengas acceso.
6. Prueba un bloque de código con `&&buttons=true`, y comprueba copiar y descargar.
7. Publica NexCSS con una regla visual y prueba las pestañas HTML de prueba/CSS. Intenta añadir un `@import` o `url(...)`: deben eliminarse y no cargar recursos externos.
8. Prueba la tabla Beta con `colspan` y `rowspan`; confirma el aviso rojo bajo la tabla.
9. Prueba `{delay:Texto}` y `{delay:2500:Texto}`. Desactiva los retrasos en Configuración → Optimizaciones y comprueba que el contenido aparece inmediatamente.
10. Adjunta CSV, TSV, XLS, XLSX y ODS desde escritorio y móvil. Comprueba la vista previa y que el original se puede descargar.
11. Comprueba que los iconos de medallas globales mantienen el tamaño esperado en la lista de miembros y que las cajas agrupadas conservan ancho, BoxGlow y placa. Prueba también la opción de compatibilidad que desactiva ese ajuste.

## 4. Límites y seguridad

- Los bloques externos solo aceptan enlaces HTTPS. Los botones y tarjetas usan `target="_blank"` con `rel="noopener noreferrer"`.
- NexCSS no ejecuta JavaScript, imports, URLs ni recursos remotos. Es un bloque Beta de CSS sobre una muestra HTML generada por Nexus.
- Las tablas son Beta y el contenido de sus celdas se representa como texto; no se ejecuta HTML arbitrario.
- InputSync solo comparte estado entre personas con acceso al mensaje y se protege mediante RLS. No expongas la tabla ni el bucket de almacenamiento como públicos.
- Las referencias APA son básicas y utilizan `(s. f.)` si no se suministra fecha. Nexus no recupera autor, fecha ni metadatos editoriales.
- Las hojas de cálculo se previsualizan parcialmente (máximo 16 filas y 12 columnas); para ver o editar el documento entero hay que descargarlo.
- Esta alpha ha pasado comprobaciones estáticas, pero necesita pruebas reales en Supabase con dos cuentas y en varios dispositivos antes de considerarse estable.
