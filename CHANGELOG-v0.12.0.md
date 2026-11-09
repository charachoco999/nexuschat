# Nexus v0.12.0 — Localización ampliada

## Interfaz

- Se completa el inventario de textos de interfaz de v0.11.1-alpha2 y se añaden las traducciones locales para 14 variantes de idioma.
- Se amplía el catálogo desde el estado inicial de 101 cadenas hasta 893 claves de origen, con 12.502 valores de traducción comprobados.
- El runtime traduce los textos y atributos visibles en el navegador y también los elementos que aparecen dinámicamente.
- Se conserva el idioma original de mensajes, perfiles y contenido creado por usuarios.
- El paquete y los catálogos funcionan sin servicios externos de traducción.
- Guaraní y latín se mantienen marcados como beta.

## Actualización

- La ventana de novedades identifica v0.12.0 y aparece una vez por cuenta tras actualizar.
- No cambia el esquema de Supabase y no se necesita SQL.
- No se modifica `assets/js/config.js`.
- La versión legal oficial sigue en español y no se ha cambiado la aceptación de ToS.

## Verificación

- 893 claves fuente × 14 variantes de destino = 12.502 traducciones no vacías.
- Auditoría estática de HTML y puntos de inserción de JavaScript: 0 nuevas cadenas de interfaz sin traducir; 23 excepciones deliberadas documentadas.
- Comprobación de sintaxis JavaScript y del paquete ZIP.
- No equivale a una prueba visual manual completa en todos los dispositivos.
