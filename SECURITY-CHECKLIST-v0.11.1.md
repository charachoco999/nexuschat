# Lista de seguridad — Nexus v0.11.1-alpha1

Este documento registra controles previstos y tareas que todavía requieren validación. No es una certificación ni garantiza el cumplimiento del RGPD.

## Controles incorporados en esta entrega

- Aceptación de condiciones versionada y vinculada al SHA-256 exacto del documento mostrado.
- Pantalla bloqueante para cuentas existentes y nuevas antes de cargar sus perfiles y conversaciones.
- RLS en la tabla de aceptación: cada cuenta solo puede consultar su propio registro; la escritura se realiza mediante una RPC que fija versión y hash.
- Políticas RLS principales de perfiles, conversaciones, membresías, mensajes, comunidades, canales y amistades condicionadas a la aceptación vigente.
- Bloqueos privados por cuenta; bloquean nuevos MDs directos y solicitudes de amistad entre las dos cuentas. No borran el historial ni afectan por sí solos a canales compartidos.
- Reportes limitados por usuario, con el mensaje seleccionado y hasta cinco mensajes anteriores reunidos en el servidor.
- Antes de eliminar esos mensajes, el cliente copia adjuntos accesibles a un bucket privado de evidencias. Si la copia falla, el reporte no se finaliza y los mensajes permanecen.
- Los reportes y los objetos de evidencia solo son legibles por administradores de plataforma mediante RLS/políticas de Storage.
- No se registra IP ni agente de usuario desde la aplicación en la tabla de aceptación.
- Las contraseñas siguen siendo responsabilidad de Supabase Auth; Nexus no las lee ni guarda en texto claro.

## IP, sesiones y contraseñas

Nexus no captura ni conserva direcciones IP propias. Supabase Auth puede mantener metadatos de sesión y registros de seguridad que incluyan IP. Esos esquemas gestionados (`auth.*`) no deben modificarse para sustituir valores ni para aplicar una codificación reversible.

El esquema de letras propuesto no es un hash criptográfico. Si una necesidad real exigiera correlacionar IPs en el futuro, debe revisarse primero si es necesario conservar ese dato. La opción preferible es no recogerlo. Para una finalidad justificada, usar un HMAC-SHA-256 con una clave secreta en backend, separada por entorno y con rotación; aun así sería un dato seudonimizado, no anónimo.

Supabase Auth utiliza hashing de contraseñas (bcrypt con sal aleatoria), no cifrado reversible. No se debe solicitar ni consultar la contraseña original.

## E2EE: no activo

Los MDs no tienen cifrado de extremo a extremo en v0.11.1-alpha1. HTTPS/TLS y el cifrado de almacenamiento del proveedor no son E2EE. Consulta `E2EE-STATUS-v0.11.1.md`. No anunciar la aplicación como E2EE.

## Obligatorio antes de producción

1. Completar en `legal/terms-of-service-v0.11.1.html` la identidad del responsable, dirección/contacto de privacidad y plazos de conservación. Revisar edad mínima, base jurídica por finalidad y procedimiento de derechos con asesoría jurídica.
2. Verificar región del proyecto Supabase, acuerdo de tratamiento (DPA), subencargados, transferencias internacionales y política de backups.
3. Revisar RLS de **todas** las tablas expuestas y las políticas de todos los buckets; aplicar principio de mínimo privilegio. Revisar también funciones `SECURITY DEFINER`, `search_path`, `EXECUTE` y grants.
4. Mantener `service_role`/secret keys solo en Edge Functions o backend; nunca en HTML, JS, repositorios, logs o builds públicos. Rotar cualquier clave que se haya expuesto.
5. Activar MFA para administradores, proteger cuentas de correo, imponer contraseñas robustas y limitar altas/sesiones con los controles de Auth apropiados.
6. Configurar CAPTCHA/anti-bot, límites de peticiones, alertas de abuso y protección de recuperación de contraseña.
7. Configurar Content Security Policy, Trusted Types cuando sea viable, revisión de DOMPurify/marked/highlight.js, dependencias fijadas y actualización de librerías.
8. Ejecutar pruebas RLS con cuentas de usuario, moderador y administrador; comprobar que un usuario no puede consultar reportes/evidencias de otros ni cambiar su rol.
9. Probar bloqueo, reportes, copias de evidencia, borrado y limpieza de archivos huérfanos. Definir plazo de retención, revisión de reportes y apelaciones.
10. Realizar una revisión de seguridad externa antes de manejar comunicaciones sensibles o presentar una garantía de seguridad.
11. Preparar un procedimiento de respuesta a incidentes y notificación de brechas.
12. Hacer copias de seguridad y probar restauración; definir eliminación de datos y tratamiento de backups.

## Pruebas manuales mínimas de esta alpha

- Cuenta A inicia sesión y acepta ToS; cuenta B también. A cuenta que no acepta no debe poder leer perfil/chat ni insertar mensajes a través de la API.
- Reportar un mensaje sin adjuntos: el panel de administración debe mostrar contexto y motivo; los seis mensajes deben desaparecer del chat.
- Reportar un mensaje con imagen/vídeo/archivo en un MD y en canal: evidencia accesible a plataforma y no al denunciante/terceros después del envío.
- Simular fallo de descarga/subida de adjunto: reporte no finalizado y mensajes conservados.
- Bloquear y desbloquear entre dos cuentas: impedir nuevos MDs y solicitudes de amistad durante el bloqueo.
- Probar RLS llamando directamente a la API, no solo desde la interfaz.

**Limitación de validación:** esta entrega ha pasado revisiones estáticas en el árbol de archivos. No se ha ejecutado la migración en el proyecto Supabase real ni se ha realizado una auditoría externa.
