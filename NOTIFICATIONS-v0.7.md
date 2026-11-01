# Web Push y sonidos en Nexus v0.7

El sonido Web Audio y las notificaciones de escritorio de la app abierta siguen funcionando. Web Push permite notificar con la pestaña oculta o el navegador cerrado si el navegador y el sistema operativo mantienen el servicio push activo. Requiere HTTPS, service worker, permisos del usuario, VAPID y un webhook de Supabase.

Sigue `UPGRADE-v0.7.md`, sección Web Push. El usuario debe pulsar el botón de activación dentro de Nexus; no se solicita permiso automáticamente. El webhook debe quedar configurado con un secreto propio. Cada navegador almacena una suscripción independiente y el cierre de sesión elimina la suscripción de ese dispositivo.
