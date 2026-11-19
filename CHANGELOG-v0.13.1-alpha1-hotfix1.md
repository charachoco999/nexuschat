# Nexus v0.13.1-alpha1-hotfix1

## Corrección de subidas multimedia a Cloudflare R2

- Se corrige el error `Provided readable stream must have a known length` al subir imágenes, documentos, audio y otros adjuntos.
- El cliente envía el tamaño conocido del `File`/`Blob` como parámetro `size`; no establece manualmente `Content-Length` desde el navegador.
- El Worker valida el tamaño y canaliza el cuerpo a R2 mediante `FixedLengthStream`, sin cargar el archivo entero en memoria.
- Se rechazan cuerpos cuyo tamaño real no coincide con el declarado.
- `/health` identifica esta compilación como `0.13.1-alpha1-hotfix1`.

No requiere migración SQL ni cambios en las vinculaciones R2/Durable Objects.
