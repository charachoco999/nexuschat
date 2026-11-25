# Actualización de condiciones de Nexus · 2026-11-25-v3

## Archivos incluidos
- `legal/terms-of-service-v0.11.1.html`: condiciones y privacidad revisadas.
- `assets/js/app.js`: nueva versión legal y huella SHA-256.
- `index.html`: nuevos enlaces, caché y texto de aceptación.
- `supabase/migrations/20261125_nexus_terms_privacy_v3.sql`: actualiza la verificación y el registro de aceptación.

## Orden de aplicación
1. Haz una copia de seguridad de la base de datos y del repositorio.
2. Ejecuta una sola vez `supabase/migrations/20261125_nexus_terms_privacy_v3.sql` en Supabase.
3. Publica los archivos del frontend y el documento legal incluidos en esta rama.
4. Comprueba el inicio de sesión con una cuenta que aceptó la versión anterior y con una cuenta nueva.
5. Confirma que la aceptación registra la versión `2026-11-25-v3`, la huella y la fecha del servidor. La migración no acepta las condiciones en nombre de nadie.

## Identificación
- Versión: `2026-11-25-v3`
- SHA-256: `5c0586b5348797c98bfed9a742d6df0d9e42ff89976d16e24b6152198c47e8e9`

La migración y el frontend deben publicarse juntos. Si solo se actualiza uno, la comprobación rechazará la aceptación por discrepancia.

## Operación de conservación
Los plazos del apartado 7 son compromisos internos. Antes de borrar evidencia o registros, comprueba que no sean necesarios para una apelación, una incidencia de seguridad o una obligación legal.
