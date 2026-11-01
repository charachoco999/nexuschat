# Voz WebRTC en Nexus v0.7

La voz es P2P de navegador a navegador; Supabase Realtime solo transmite señalización y presencia, no el audio. Para entrar se necesita permiso de micrófono. Se establece una malla de hasta seis participantes. El servidor STUN público de configuración sirve en bastantes redes, pero no todas. Una red con NAT restrictiva puede requerir TURN. Las credenciales TURN permanentes no se deben distribuir en `config.js`; configura un servidor para emitir credenciales efímeras desde una función Edge si necesitas mayor fiabilidad.

En Supabase Realtime, desactiva `Allow public access` y ejecuta la migración. Nexus utiliza canales privados también para amigos, bandeja, notificaciones, MDs y canales; las políticas comprueban la cuenta o membresía antes de autorizar cada tópico.
