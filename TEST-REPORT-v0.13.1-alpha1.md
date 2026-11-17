# Nexus v0.13.1-alpha1 — informe de comprobaciones

## Comprobaciones estáticas ejecutadas

- `node --check assets/js/app.js`: correcto.
- `node --check assets/i18n/catalog-feedback-v0.13.1.js`: correcto.
- `node --check cloudflare/worker/src/index.js`: correcto; el Worker conserva la versión 0.13.0-alpha1 porque esta actualización no cambia su lógica.
- HTML de `index.html`: parseado correctamente; 426 IDs y ningún ID duplicado.
- Catálogo complementario v0.13.1: 45 claves, 14 idiomas y 0 traducciones vacías.
- Revisión de la migración SQL y del bootstrap: sintaxis y flujo revisados estáticamente; no se ejecutaron contra el proyecto Supabase real.
- `assets/js/config.js`: omitido deliberadamente para conservar la configuración de cada instalación. El paquete incluye solo `config.js.example`.
- No se incluyen API keys, service_role keys, secretos SMTP ni secretos de Cloudflare.

## No ejecutado en este entorno

- No se ha aplicado la migración en la base de datos real.
- No se ha designado ningún Super Admin automáticamente.
- No se han probado las RPCs con cuentas reales admin/no-admin.
- No se ha realizado una prueba end-to-end en navegadores, dispositivos móviles ni una instancia real de Cloudflare Pages.
- No se han cambiado los estados de las sugerencias existentes ni se han insertado duplicados en `nexus_platform_feedback`.

## Pruebas manuales antes de dar por cerrada la alpha

1. Aplicar la migración y el bootstrap manual.
2. Comprobar el panel con Super Admin, admin normal y cuenta normal.
3. Verificar que admin normal recibe rechazo al ejecutar `set_platform_admin_role`.
4. Probar búsqueda por texto, fechas, archivos, usuario, canal y rol.
5. Probar presencia, tooltips, recibos de lectura y acciones de adjuntos en escritorio y móvil.
6. Guardar el acento rosita pastel, recargar y confirmar que persiste.
