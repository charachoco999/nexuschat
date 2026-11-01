# Nexus v0.3 — actualización

## Novedades

- Manejo comprensible del error de Supabase Auth `email rate limit exceeded`.
- Integración opcional de Cloudflare Turnstile en inicio de sesión, registro y recuperación de contraseña; requiere activar CAPTCHA en Supabase y añadir solo la Site Key pública en `config.js`.
- Editor de canales con nombre, tipo, descripción y posición.
- Actualización y eliminación de canales desde la barra lateral.
- Los canales multimedia rechazan mensajes de texto y encuestas desde la interfaz y también mediante RLS. Los canales de voz no aceptan mensajes de chat mientras no exista transporte de voz.
- Los canales de anuncios requieren el permiso `post_announcements`, comprobado por RLS.
- Los ajustes de megagrupo ahora admiten URL HTTPS para icono, banner y fondo, color de nombre y CSS visual restringido al área del megagrupo.
- La interfaz de canal de voz indica claramente que el transporte de audio WebRTC aún no está integrado.

## Actualizar una instalación v0.2

1. Haz una copia de seguridad de tu repositorio y de la base de datos.
2. Si todavía no aplicaste las migraciones de v0.2, ejecuta primero `supabase/migrations/20261031_fix_chat_media_rls.sql` y `supabase/migrations/20261031_harden_community_badges.sql`. Si ya las ejecutaste, no hace falta repetirlas.
3. En Supabase SQL Editor ejecuta `supabase/migrations/20261101_channel_permissions.sql`.
4. Sube el contenido del directorio `nexus-chat` de este paquete a la raíz del repositorio de GitHub Pages, sobrescribiendo los archivos correspondientes.
5. Conserva tu `assets/js/config.js` actual. No lo reemplaces por el archivo de ejemplo del paquete completo.
6. Recarga Nexus con Ctrl+F5 y prueba los cuatro tipos de canal.

## Importante

- El SMTP personalizado se configura en el panel de Supabase y el proveedor de correo, no desde GitHub Pages. Consulta `SUPABASE-AUTH-EMAILS.md`.
- No desactives la confirmación de correo en una aplicación con registros públicos.
- Los canales de voz siguen siendo visuales: WebRTC requiere una fase posterior con señalización y servidores TURN.
- El CSS de megagrupo se filtra y se limita a propiedades de presentación y selectores concretos. No es un sandbox universal para CSS arbitrario.
- Haz pruebas con una cuenta no administradora para verificar que la política de `post_announcements` funciona.

## Archivos

- `supabase/migrations/20261101_channel_permissions.sql`: migración que aplica las reglas de publicación por tipo de canal.
- `assets/js/app.js`: interfaz y validaciones de canal/Auth.
- `assets/css/app.css`: estilos del editor y ajustes.
- `index.html`: diálogos de edición.
