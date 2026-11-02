# Nexus Desktop · Centro de actualizaciones Alpha 3

Este parche incorpora el actualizador de Tauri firmado. La Alpha 3 es una versión puente: Alpha 2 no contiene el código necesario para actualizarse automáticamente y se debe instalar Alpha 3 manualmente una sola vez.

Antes de publicar builds firmadas:

1. Genera una pareja de claves con `npm run tauri signer generate -- -w "$env:USERPROFILE\.tauri\nexus-desktop.key"` desde `desktop/`.
2. Copia la clave pública que imprime el comando a `desktop/src-tauri/tauri.conf.json` en `plugins.updater.pubkey`.
3. Guarda el contenido completo del archivo privado en GitHub Actions Secrets con el nombre `TAURI_SIGNING_PRIVATE_KEY`.
4. No publiques ni compartas el archivo privado. Conserva una copia segura: perderlo impide actualizar las instalaciones existentes.
5. Ajusta el repositorio del endpoint de `plugins.updater.endpoints` si no es `Charachoco999/nexuschat`.

Para publicar Alpha 4 o posterior, incrementa la versión en `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json` y `desktop/ui/config.js`, edita `desktop/RELEASE_NOTES.md`, crea una etiqueta `desktop-v<version>` y súbela. GitHub Actions compilará artefactos firmados y publicará `latest.json` en el Release.

No hay migración SQL ni cambios en Supabase para esta función.
