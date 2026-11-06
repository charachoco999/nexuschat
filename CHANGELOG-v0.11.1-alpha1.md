# Nexus v0.11.1-alpha1 — cambios

Entrega centrada en privacidad, moderación y controles de acceso. Continúa la rama web/móvil 0.11; no modifica Nexus Desktop.

## Condiciones de uso y privacidad
- Nuevo documento versionado en `legal/terms-of-service-v0.11.1.html`.
- Pantalla obligatoria para aceptar la versión actual tanto en cuentas existentes como nuevas.
- La aceptación guarda versión, SHA-256 y hora del servidor; no guarda IP ni agente de usuario.
- Las políticas RLS principales de perfiles, conversaciones, mensajes, comunidades, canales y amistades exigen aceptar la versión vigente.

## Bloqueos
- Botón Bloquear/Desbloquear en el perfil público.
- Los bloqueos impiden nuevos mensajes en MDs directos y solicitudes de amistad mientras estén activos.
- No borran el historial existente ni impiden mensajes en canales compartidos.

## Reportes de mensajes
- Botón Reportar en mensajes de otras cuentas.
- El servidor recopila el mensaje seleccionado y hasta cinco mensajes anteriores del mismo MD/canal.
- Se informa al denunciante del alcance antes de enviar.
- Los adjuntos disponibles se copian a `nexus-report-evidence`, un bucket privado antes de eliminar los mensajes del chat.
- Panel de plataforma para revisar contexto, evidencia, estado y nota interna.
- Si falla la copia de evidencia, el reporte no se finaliza y los mensajes no se eliminan.

## Seguridad y transparencia
- Políticas RLS adicionales para exigir aceptación de ToS en las superficies principales de datos.
- No se añade un sistema propio para almacenar IPs. Los metadatos de Auth/Sessions siguen gestionados por Supabase.
- Las contraseñas siguen gestionadas por Supabase Auth; Nexus no las almacena en texto claro ni las puede recuperar.
- Se añade `SECURITY-CHECKLIST-v0.11.1.md`.

## Limitaciones conocidas y funciones no incluidas
- **E2EE no está implementado.** Los MDs no tienen cifrado de extremo a extremo. HTTPS/TLS y el cifrado de almacenamiento del proveedor no equivalen a E2EE. El proyecto incluye `E2EE-STATUS-v0.11.1.md` con el plan y requisitos para una integración real.
- No se implementa la codificación alfabética de IPs propuesta; es reversible y no es un hash seguro. La aplicación no recoge IPs propias.
- Los archivos originales que quedan huérfanos en el bucket de chats pueden requerir una política de limpieza/retención adicional; la evidencia privada copiada tiene una política de acceso separada.
- El texto legal contiene campos del responsable/contacto y retención pendientes de completar y revisión profesional antes de publicación estable.
- La migración SQL y los flujos de Storage necesitan probarse en el proyecto Supabase real.
