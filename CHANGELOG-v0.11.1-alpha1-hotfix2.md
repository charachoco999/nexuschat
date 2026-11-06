# Nexus v0.11.1-alpha1-hotfix2 — ToS móvil

## Corregido
- Restaurado el desplazamiento vertical táctil dentro del documento de Condiciones de uso cuando se muestra en el iframe de aceptación.
- Sobrescrita únicamente en el documento legal la regla móvil global `html, body { overflow: hidden; }` de la aplicación.
- Añadida compatibilidad de scroll táctil y respeto por el área segura inferior en móviles.
- Añadido cache-busting al iframe, al enlace de apertura y a la hoja CSS del documento legal.
- No se modifican los términos, el hash de aceptación, la lógica de autenticación ni las migraciones SQL.

## Validación
- Revisión estática de los selectores CSS y las referencias del iframe.
- Pendiente prueba física en Safari iOS y Chrome Android.
