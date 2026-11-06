# Nexus v0.11.1-alpha1-hotfix1

## Correcciones críticas de inicio de sesión

- Reemplaza la lectura directa de `tos_acceptances` por `nexus_terms_acceptance_status()`, que devuelve un objeto JSON explícito incluso cuando el usuario todavía no tiene una fila de aceptación.
- Cambia `accept_nexus_terms()` a un contrato JSON verificable (`accepted`, versión, hash y fecha).
- Elimina la carrera de inicio doble producida por `onAuthStateChange` y `getSession()`, que podía abrir dos flujos de ToS y sobrescribir el callback pendiente.
- Sustituye la consulta de perfil `.single()` por `nexus_ensure_current_profile()`, que solo devuelve el perfil público del usuario autenticado y repara un perfil ausente tras la aceptación.
- Añade una política RLS de lectura limitada al propio perfil para evitar que la pantalla de aceptación quede atrapada por una política que exige aceptación previa.
- Ante errores de arranque, vuelve a la pantalla de inicio de sesión en lugar de dejar una shell autenticada vacía.

## Privacidad

- No se marcan cuentas como aceptadas automáticamente.
- Los usuarios sin fila de aceptación reciben la pantalla de ToS y deben aceptarla explícitamente.
- No se recopilan IPs ni user-agent en esta reparación.

## Migración

Ejecutar una sola vez `supabase/migrations/20261106_nexus_v0111_tos_login_hotfix.sql` después de la migración original v0.11.1. Es idempotente salvo las funciones que actualiza deliberadamente; puede repetirse de forma segura.
