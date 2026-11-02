# Recuperación de contraseña — Nexus v0.8

El botón de cambio de contraseña envía un correo mediante Supabase Auth y el SMTP configurado en el proyecto.

El enlace vuelve a la aplicación con `?recovery=1`. Nexus muestra una pantalla de recuperación dedicada, acepta y confirma la nueva contraseña mediante `supabase.auth.updateUser({ password })` y, cuando Supabase confirma el cambio, cierra la sesión de recuperación para que el usuario vuelva a iniciar sesión con la contraseña nueva.

No hay que crear Edge Functions adicionales ni ejecutar una migración aparte para este flujo. La entrega de los correos depende del SMTP de Supabase.

Si el enlace expira, solicita otro desde la pantalla de inicio de sesión. No compartas los enlaces de recuperación ni los tokens con nadie.
