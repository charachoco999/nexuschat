# Actualizar Nexus v0.11.1-alpha1-hotfix2 → v0.11.1-alpha2

## Antes de empezar
1. Haz una copia de seguridad del repositorio y de Supabase.
2. Conserva `assets/js/config.js`; el paquete no incluye credenciales.
3. Comprueba que la migración inicial de ToS y la reparación `v0.11.1-alpha1-hotfix1` ya están aplicadas.

## Migración SQL obligatoria
Ejecuta una sola vez, antes de publicar el frontend:

`supabase/migrations/20261106_nexus_v0111_i18n_terms_update_status.sql`

Esta migración cambia la versión legal vigente a `2026-11-06-v2` y su SHA-256 a:

`f0f2322c78f8a4daf53335bf64017f60c74de4230f57d6df9b49a8184fccd8dd`

Actualiza las funciones `accept_nexus_terms`, `nexus_terms_acceptance_status` y `nexus_has_current_terms`. No inserta aceptaciones. Las personas que solo aceptaron v1 verán el popup de actualización y deberán revisar y aceptar v2. Las cuentas sin registro verán el popup de primer acceso.

No ejecutes otra vez las migraciones originales de ToS ni la reparación de inicio de sesión. Esta migración alpha2 sustituye las funciones de estado/aceptación para la nueva huella.

## Publicar frontend
1. Descomprime `nexus-chat-v0.11.1-alpha2-upgrade.zip`.
2. Sube el contenido de `nexus-chat/` a la raíz de GitHub Pages, sustituyendo los archivos existentes.
3. Conserva `assets/js/config.js`.
4. Haz recarga forzada (`Ctrl+F5`) en escritorio; en móvil cierra y vuelve a abrir Nexus.

## Idiomas
- Hay 15 variantes seleccionables desde la pantalla de acceso, Configuración y pantalla de ToS.
- La preferencia elegida antes de iniciar sesión se guarda localmente y tiene prioridad durante ese acceso.
- Al guardar Configuración, el idioma se guarda también en `profiles.settings.language` para sincronizarlo entre dispositivos.
- Guaraní y Latín están en beta. El catálogo cubre las cadenas principales, no todos los rincones de la interfaz; lo no traducido aparece en español.
- El texto legal oficial se mantiene en español. La selección de idioma no debe interpretarse como una traducción jurídica certificada.

## E2EE
Esta entrega no activa E2EE. Los MDs continúan sin cifrado de extremo a extremo. Lee `E2EE-SIGNAL-ROADMAP-v0.11.1-alpha2.md`; no cambies la interpretación de seguridad de Nexus hasta completar la implementación y auditoría.
