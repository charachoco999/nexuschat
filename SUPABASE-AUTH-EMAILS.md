# Nexus: solucionar el límite de correos de registro

La captura «email rate limit exceeded» procede de Supabase Auth. No es un error de contraseña ni de la subida de archivos.

## Por qué ocurre

En proyectos alojados que todavía usan el servidor SMTP de prueba de Supabase, el límite actual es de **2 correos por hora para todo el proyecto**. Además, ese servicio de prueba solo entrega a direcciones autorizadas del equipo de la organización. El límite se comparte entre confirmaciones de registro, recuperación de contraseña y otros correos de Auth.

## Solución para registros públicos

1. Elige un proveedor de correo transaccional que admita SMTP y revisa sus requisitos de edad, uso y posibles costes. Si requiere contratar un servicio o introducir datos de facturación, hazlo con ayuda de tu madre, padre o tutor.
2. Configura y verifica un dominio/remitente en el proveedor. Sigue sus instrucciones DNS de SPF y DKIM.
3. En Supabase abre **Authentication → Emails → SMTP Settings** (el nombre exacto puede variar ligeramente en el panel), activa SMTP personalizado e introduce host, puerto, usuario, contraseña SMTP y dirección remitente.
4. Guarda las credenciales solo en Supabase. **No** las pegues en `assets/js/config.js`, en GitHub Pages ni en ningún archivo público.
5. Mantén activada la confirmación de correo y prueba un registro con una dirección que puedas consultar.
6. Revisa **Authentication → Rate Limits**. Supabase aplica inicialmente un límite conservador al SMTP personalizado; la documentación actual indica 30 correos por hora y permite ajustarlo según el proveedor y el proyecto.
7. Configura CAPTCHA en Supabase Auth (Cloudflare Turnstile o hCaptcha). Para Turnstile, pon únicamente la **Site Key pública** en `TURNSTILE_SITE_KEY` de `assets/js/config.js`; Nexus muestra el widget en inicio de sesión, registro y recuperación y envía el token a Supabase Auth. Pon la **Secret Key** únicamente en el panel de Supabase. No desactives la confirmación para esquivar el límite.

Guía SMTP oficial: https://supabase.com/docs/guides/auth/auth-smtp
Guía CAPTCHA oficial: https://supabase.com/docs/guides/auth/auth-captcha
Límites oficiales: https://supabase.com/docs/guides/auth/rate-limits
Pruebas de Auth: https://supabase.com/docs/guides/auth/testing-auth-flows

## Qué hacer con el usuario que ya lo intentó

1. En Supabase entra en **Authentication → Users** y busca el correo desde el panel privado.
2. Comprueba si Supabase llegó a crear el usuario y si aparece confirmado.
3. Después de configurar SMTP, utiliza la opción de reenviar confirmación si está disponible. Evita pedirle que pruebe una y otra vez antes de resolver el SMTP: solo se vuelve a golpear el mismo límite.

## Mensaje de error en Nexus v0.3

Nexus ahora traduce los errores `over_email_send_rate_limit` / `email rate limit exceeded` a un aviso comprensible para el usuario, sin mostrar una traza técnica ni sugerir que cambie su contraseña.
