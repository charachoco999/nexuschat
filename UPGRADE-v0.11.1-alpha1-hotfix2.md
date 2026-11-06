# Actualizar Nexus v0.11.1-alpha1-hotfix1 → hotfix2

Este hotfix corrige el desplazamiento de las Condiciones de uso en móvil. No requiere migración SQL y no modifica el hash de los ToS.

## Instalación
1. Haz una copia del repositorio.
2. Descomprime `nexus-chat-v0.11.1-alpha1-hotfix2-upgrade.zip`.
3. Sube el contenido de `nexus-chat/` a la raíz del repositorio y acepta sustituir los archivos.
4. Conserva `assets/js/config.js`.
5. Recarga Nexus. Si sigue apareciendo la versión anterior, cierra completamente la pestaña/app y vuelve a abrirla; el documento legal usa una nueva URL versionada para evitar caché.

## Archivos incluidos
- `index.html`: activa el scroll del iframe y cambia su versión de caché.
- `legal/terms-of-service-v0.11.1.html`: restaura el scroll vertical solo en la página legal y respeta el área segura del móvil.
- `CHANGELOG-v0.11.1-alpha1-hotfix2.md`.
- `UPGRADE-v0.11.1-alpha1-hotfix2.md`.

No ejecutes SQL: esta actualización es exclusivamente de interfaz.
