# Nexus v0.12.1 — hotfix de localización

Esta entrega corrige un problema visual en el que el contenido de mensajes del sistema podía aparecer como texto sin formato en la parte superior de la interfaz.

## Cambios

- Los mensajes de Nexus (App) se cargan exclusivamente en la cola de diálogos emergentes descartables; ya no se insertan como texto permanente en el documento.
- Se añade la clase accesible `.sr-only` para que las regiones `aria-live` permanezcan disponibles para lectores de pantalla sin ocupar espacio visual.
- Se actualizan las versiones de caché de `app.css` y `app.js` para evitar reutilizar recursos antiguos.
- Se mantiene el catálogo de traducciones de v0.12.0 sin cambios.

No se modifica la base de datos y no requiere SQL.
