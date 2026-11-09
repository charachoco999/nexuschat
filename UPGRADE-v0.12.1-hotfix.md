# Actualizar Nexus v0.12.0 → v0.12.1 hotfix

Este parche corrige la visualización accidental de texto de avisos del sistema en la parte superior de la interfaz. Está pensado para instalaciones que ya han aplicado la actualización de localización v0.12.0.

## Instalación

1. Haz una copia de seguridad del repositorio.
2. Descomprime este ZIP.
3. Sube el contenido de `nexus-chat/` a la raíz del repositorio de GitHub Pages y acepta sustituir los archivos indicados.
4. Conserva `assets/js/config.js` y cualquier archivo propio. El paquete no contiene credenciales ni configuración privada.
5. Publica los cambios y fuerza una recarga con `Ctrl + F5`. En la aplicación instalada, ciérrala por completo y vuelve a abrirla.

## Archivos incluidos

- `index.html`
- `assets/css/app.css`
- `assets/js/app.js`
- Documentación del hotfix

No requiere ejecutar SQL ni modificar Supabase. No sustituye los archivos de traducción de v0.12.0.
