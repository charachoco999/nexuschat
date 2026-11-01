# Notificaciones Nexus v0.6

## Sonido

Nexus genera un tono breve usando Web Audio, sin descargar ningún archivo de sonido. El navegador suele bloquear audio automático hasta que la persona interactúa con la página; por eso el primer clic/tecla desbloquea el sonido. El ajuste «Reproducir sonido al recibir mensajes» está en Configuración.

El sonido funciona para mensajes nuevos en MDs y grupos. También funciona para canales de megagrupo cuando el usuario tiene acceso al mensaje. No suena para mensajes enviados por la propia cuenta.

## Origen e iconos

El panel de notificaciones utiliza el avatar del otro participante para un MD, el icono del grupo si existe, o un símbolo propio de Nexus si no hay imagen. Para un canal muestra el icono del megagrupo y el nombre del canal. Las menciones se resaltan aparte.

## Avisos del sistema

El botón «Activar avisos de escritorio» solicita permiso al navegador. Con permiso concedido, Nexus puede mostrar una notificación cuando la página está abierta pero la pestaña está en segundo plano. El sonido y la bandeja interna también requieren que Nexus siga abierto.

**No hay notificaciones push con el navegador completamente cerrado.** Para eso haría falta un service worker, suscripciones Push, claves VAPID y una función de servidor que envíe los avisos. GitHub Pages por sí solo no puede enviar esos avisos.

## Privacidad

Las notificaciones no se guardan en una tabla: la bandeja actual es temporal y se reinicia al recargar o cerrar sesión. Los mensajes siguen sujetos a las políticas RLS de Supabase. No se envían notificaciones a la persona que escribió el mensaje.
