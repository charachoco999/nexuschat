# Nexus v0.7.1 — hotfix de fuentes

- Fuerza `font/woff`, `font/woff2` y `font/ttf` según la extensión validada.
- Envuelve las fuentes en un `Blob` con MIME explícito para evitar `application/octet-stream`.
- Reaplica la lista permitida del bucket `profile-media` mediante una migración idempotente.
- Versiona la URL de `app.js` para evitar que el navegador reutilice el JavaScript anterior en caché.
- No permite `application/octet-stream` en el bucket.
