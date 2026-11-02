# Nexus Desktop · 0.9.0-alpha.3

Aplicación de escritorio de Nexus construida con Tauri 2. Esta versión incorpora el centro de actualizaciones firmado de Tauri. La primera versión con actualizador debe instalarse manualmente encima de Alpha 2; a partir de Alpha 3 las siguientes versiones podrán descargarse desde el propio programa.

## Qué aporta Alpha 3

- Comprobación automática de nuevas versiones al iniciar y comprobación manual desde el botón de actualizaciones.
- Panel visual con versión instalada, versión disponible y notas de la versión.
- Descarga con progreso, verificación criptográfica de la firma e instalación mediante el mecanismo nativo de Tauri.
- Publicación de versiones desde GitHub Releases, sin servidor ni dominio de actualizaciones propio.
- La clave privada de firma no se distribuye ni se guarda en el repositorio.

## Configuración obligatoria de firma (una sola vez)

Tauri exige una firma válida para todas las actualizaciones. No se puede desactivar esta verificación. La clave privada es permanente: guárdala en un gestor seguro y conserva una copia de seguridad. Si se pierde, las instalaciones existentes no podrán aceptar actualizaciones firmadas con una clave distinta.

1. En tu equipo de desarrollo, abre una terminal dentro de `desktop/` y ejecuta:

   ```powershell
   npm install
   npm run tauri signer generate -- -w "$env:USERPROFILE\.tauri\nexus-desktop.key"
   ```

2. El comando muestra la clave pública. Copia únicamente la clave pública en `src-tauri/tauri.conf.json`, sustituyendo `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY` en `plugins.updater.pubkey`.
3. Guarda el contenido completo del archivo privado como secreto de GitHub:
   - Repositorio → Settings → Secrets and variables → Actions → New repository secret.
   - Nombre: `TAURI_SIGNING_PRIVATE_KEY`.
   - Valor: el contenido completo de `nexus-desktop.key` (no la publiques, no la adjuntes al ZIP y no la pegues en el código).
4. Si generaste la clave con contraseña, crea también el secreto `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Para esta beta puedes dejar la clave sin contraseña y protegerla con el almacén seguro de GitHub y una copia privada.

**Nunca cambies de clave para publicar nuevas versiones.** La clave pública va en la configuración distribuida; la privada solo en GitHub Secrets y en tu copia de seguridad privada.

## Publicación de una versión nueva

1. Sube los cambios del proyecto al repositorio `Charachoco999/nexuschat` (o ajusta el endpoint en `tauri.conf.json` si el repositorio tiene otro nombre).
2. Incrementa la misma versión en `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json` y `desktop/ui/config.js`.
3. Actualiza `desktop/RELEASE_NOTES.md`.
4. Crea y sube una etiqueta Git con formato `desktop-v0.9.0-alpha.4`, igual a la versión de Tauri pero con el prefijo `desktop-v`:

   ```bash
   git tag desktop-v0.9.0-alpha.4
   git push origin desktop-v0.9.0-alpha.4
   ```

5. GitHub Actions compila el instalador y el paquete updater firmado, publica ambos en GitHub Releases y sube `latest.json`. Los clientes consultan `https://github.com/Charachoco999/nexuschat/releases/latest/download/latest.json`.

**Importante:** el workflow publica las versiones beta como Release normal (no marcado como prerelease en GitHub) para que el endpoint `/releases/latest/download/latest.json` siempre apunte a la beta más reciente. El nombre y la versión del producto siguen indicando `alpha`.

El workflow también se puede ejecutar manualmente desde Actions para producir artefactos de prueba. Esa ejecución manual no publica un Release ni cambia el manifiesto `latest.json`.

## Primera actualización: Alpha 2 → Alpha 3

La Alpha 2 no incluye el plugin ni el código de actualizaciones. Por ello no puede actualizarse a sí misma desde la aplicación. Todos los usuarios Alpha 2 deberán instalar una vez el instalador de Alpha 3 manualmente. Después, las nuevas versiones serán automáticas.

## Uso del centro de actualizaciones

- La app comprueba actualizaciones unos segundos después de arrancar.
- Si hay una versión disponible, aparece un punto en el botón de actualización de la barra superior.
- El usuario abre el centro, revisa las notas y pulsa «Descargar e instalar».
- La aplicación descarga el paquete, verifica su firma y aplica la actualización. En Windows el instalador gestiona el cierre requerido para reemplazar los archivos; Tauri vuelve a iniciar la aplicación.

## Plataformas cubiertas actualmente

El manifiesto automático de esta primera implementación publica únicamente `windows-x86_64`, que es el instalador NSIS que estamos distribuyendo ahora. Linux y macOS necesitarán sus propios paquetes firmados y entradas en `latest.json` antes de habilitar actualizaciones en esas plataformas.

## Herramientas requeridas para compilar (no para los betatesters)

- Windows 10/11 de 64 bits, Node.js 22, Rust estable (1.90 o superior), Microsoft C++ Build Tools y NSIS.
- Los betatesters solo necesitan Windows y el instalador publicado.

## Seguridad

- El verificador de firma no se desactiva.
- `pubkey` es la clave pública y puede distribuirse.
- `TAURI_SIGNING_PRIVATE_KEY` nunca debe estar en el proyecto ni en el instalador.
- Los instaladores y las actualizaciones se sirven desde HTTPS en GitHub Releases.
- No subas `nexus-desktop.key` al repositorio, a un ZIP compartido ni a un issue.
