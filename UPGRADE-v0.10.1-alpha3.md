# Actualizar Nexus v0.10.0-alpha3 → v0.10.1-alpha3 (beta hotfix)

Este hotfix restaura los fondos de megagrupo en los canales y añade la guía completa de personalización. No modifica Nexus Desktop ni requiere cambios en Supabase.

## Antes de empezar

1. Guarda una copia de tu repositorio actual.
2. Conserva `assets/js/config.js`; este archivo contiene la configuración de tu proyecto y no debe sustituirse por `config.js.example`.
3. Comprueba que tu instalación parte de Nexus v0.10.0-alpha3.

## Aplicar el hotfix

1. Descarga `nexus-chat-v0.10.1-alpha3-hotfix-upgrade.zip`.
2. Descomprime el ZIP.
3. Copia el contenido de la carpeta `nexus-chat/` a la raíz de tu repositorio de GitHub Pages y acepta sustituir los archivos existentes.
4. Comprueba que se han actualizado `index.html`, `assets/js/app.js` y `assets/css/app.css`, y que se ha añadido `GUIA-PERSONALIZACION.md`.
5. No sustituyas ni elimines `assets/js/config.js`.
6. Espera a que finalice el despliegue de GitHub Pages. En escritorio fuerza la recarga con `Ctrl + F5`; en móvil cierra Nexus y vuelve a abrirlo.

## Qué probar

- Entra en un megagrupo que tenga configurada una imagen de fondo.
- Abre un canal de texto: el fondo debe verse detrás del área de mensajes.
- Abre un MD: debe conservar el fondo del tema personal, sin heredar el fondo del megagrupo.
- Pulsa **Guía** en la barra superior. Debe abrirse la Guía de personalización.
- Comprueba el índice, los botones para ir a Configuración/Perfil/megagrupo/Markdown y **Volver a Nexus**.
- Repite la navegación en móvil; el botón **Guía** permanece en la barra superior.

## Migraciones

No ejecutes ninguna migración SQL para este hotfix. No cambia la base de datos ni los permisos de Supabase.
