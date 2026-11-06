# Actualizar Nexus v0.11.0-alpha1-hotfix3 → v0.11.1-alpha1

Esta entrega continúa la rama web/móvil 0.11. No modifica Nexus Desktop.

## Antes de empezar
1. Haz copia del repositorio y respaldo de Supabase.
2. Comprueba que el hotfix3 de la 0.11.0 y las migraciones anteriores ya están aplicadas.
3. Conserva `assets/js/config.js`; no está incluido en el paquete.
4. Antes de desplegar públicamente, completa los campos `[EMAIL DE PRIVACIDAD/CONTACTO]` y los demás pendientes en el documento legal. La aceptación se liga al SHA-256 exacto del documento; si modificas el HTML de condiciones, tendrás que generar una nueva versión/hash coherentes en el HTML, JS y migración, y solicitar aceptación nueva.

## Migración SQL
Ejecuta una sola vez en Supabase → SQL Editor:

`supabase/migrations/20261106_nexus_v0111_terms_privacy_blocks_reports.sql`

La migración crea:
- `tos_acceptances` y RPC `accept_nexus_terms`.
- Función `nexus_has_current_terms()` y políticas RLS principales que exigen aceptación.
- `user_blocks` y triggers para bloquear mensajes en MDs directos/solicitudes de amistad.
- `nexus_message_reports`, RPCs para crear/finalizar/cancelar reportes y el bucket privado `nexus-report-evidence`.
- Policies de Storage: el denunciante puede cargar/retirar evidencias solo mientras su reporte esté pendiente; solo admins de plataforma pueden leer evidencia finalizada.

No vuelvas a ejecutar las migraciones anteriores de 0.11.0 si ya se aplicaron. Si la migración se interrumpe, no despliegues el frontend hasta confirmar en Supabase qué objetos se crearon y si la transacción revirtió por completo.

## Publicar la web
1. Descomprime `nexus-chat-v0.11.1-alpha1-upgrade.zip`.
2. Copia el contenido de `nexus-chat/` a la raíz del repositorio de GitHub Pages y acepta sustituir los archivos.
3. Conserva `assets/js/config.js`.
4. Fuerza recarga en escritorio (`Ctrl + F5`); en móvil cierra y vuelve a abrir Nexus.

## Verificaciones
1. Una cuenta existente debe ver la pantalla de ToS antes de cargar su perfil; después de aceptar una vez no debe repetirse para esta versión.
2. Prueba una cuenta nueva: no debe acceder al chat antes de aceptar.
3. Llama a la API de mensajes con una cuenta que no haya aceptado; la lectura/escritura de mensajes debe quedar bloqueada por RLS.
4. Bloquea dos cuentas y prueba nuevos MDs/solicitudes; después desbloquea.
5. Reporta un mensaje con y sin adjuntos. Comprueba que se copian las evidencias antes de retirar el mensaje y hasta cinco anteriores.
6. Simula un fallo de Storage: el reporte no debe finalizar y los mensajes deben seguir en el chat.
7. En el panel de administración, comprueba que solo una cuenta `is_platform_admin()` puede ver reportes y descargar evidencias.

## Privacidad y E2EE
Los MDs **no** tienen cifrado de extremo a extremo en esta alpha. No anunciar E2EE. Supabase Auth gestiona las contraseñas y puede mantener metadatos de sesión/IP; Nexus no crea una copia ni aplica un esquema casero a esos datos. Revisa `E2EE-STATUS-v0.11.1.md`, `SECURITY-CHECKLIST-v0.11.1.md` y completa/revisa el ToS antes de una publicación estable.
