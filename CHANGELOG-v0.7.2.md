# Nexus v0.7.2

- Corrige subidas de avatar, banner, efectos de imagen y fuentes cuando el navegador/Linux informa `application/octet-stream`.
- Comprueba firmas binarias reales de PNG, JPEG, GIF, WebP, WOFF, WOFF2 y TTF.
- Fuerza `Content-Type` mediante `Blob` para todos los recursos del perfil.
- Versiona la URL de `app.js` para evitar caché antigua.
- Añade migración idempotente para reestablecer la allowlist MIME de `profile-media`, sin abrir `application/octet-stream`.
