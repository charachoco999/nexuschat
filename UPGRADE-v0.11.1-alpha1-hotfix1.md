# Actualizar Nexus v0.11.1-alpha1 → v0.11.1-alpha1-hotfix1

Esta reparación corrige el bloqueo de cuentas durante el arranque y la aceptación obligatoria de ToS. No cambia la versión legal ni acepta condiciones en nombre de los usuarios.

## Pasos

1. Haz una copia de seguridad del repositorio y de Supabase.
2. En Supabase → SQL Editor, ejecuta una sola vez `supabase/migrations/20261106_nexus_v0111_tos_login_hotfix.sql`.
3. Despliega el contenido de `nexus-chat/` del paquete incremental, sobrescribiendo archivos.
4. Conserva `assets/js/config.js`.
5. Fuerza la recarga en escritorio (`Ctrl + F5`) o cierra y vuelve a abrir Nexus en móvil.

## Comportamiento esperado

- Si la cuenta ya aceptó la versión actual y el hash coincide, entra normalmente.
- Si todavía no tiene registro, se muestra la pantalla de aceptación obligatoria.
- Si el registro es de otra versión/hash, se solicita una nueva aceptación.
- La aceptación solo se registra cuando el usuario pulsa el botón tras marcar la casilla.
- No se hace backfill automático de aceptaciones.

## Pruebas recomendadas

1. Cuenta existente sin fila en `tos_acceptances`: debe aparecer la pantalla de ToS, no un error de objeto único.
2. Aceptar las condiciones: debe entrar a Nexus y crearse una fila para la versión/hash actuales.
3. Recargar con esa misma cuenta: debe entrar directamente.
4. Cuenta con ToS anterior: debe volver a pedir aceptación.
5. Comprobar que dos arranques simultáneos no abren dos diálogos.
6. Comprobar que el RPC `nexus_ensure_current_profile()` solo devuelve el perfil de `auth.uid()`.
