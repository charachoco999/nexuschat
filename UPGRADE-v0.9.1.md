# Actualizar Nexus v0.9 → v0.9.1 (hotfix)

Esta actualización incorpora mejoras de voz, adjuntos, visor de imágenes y estados de carga. Está pensada para instalaciones que ya funcionan con Nexus v0.9.

## Antes de actualizar

1. Haz una copia de seguridad del repositorio y de la base de datos.
2. Conserva `assets/js/config.js`; el paquete de actualización no sustituye tus credenciales públicas de Supabase.
3. No es necesario ejecutar SQL nuevo para este parche.

## Publicar el parche

1. Descomprime `nexus-chat-v0.9.1-hotfix.zip`.
2. Entra en la carpeta `nexus-chat` del ZIP.
3. Sube y sustituye `index.html`, `assets/js/app.js`, `assets/css/app.css` y los dos documentos Markdown en la raíz del repositorio.
4. No sustituyas `assets/js/config.js`.
5. Espera a que GitHub Pages termine el despliegue y recarga Nexus con `Ctrl + F5`.

## Requisitos de Storage

El esquema de Nexus ya permite `application/zip` en el bucket privado `chat-media`, con límite de 50 MB. No se requiere una migración si ya se aplicó `supabase/fix-chat-media-rls.sql` o se instaló el esquema completo de v0.9. Si ZIP no estaba permitido en una instalación antigua, revisa y aplica el script de corrección de medios de la versión anterior, no una política pública nueva.

## Pruebas recomendadas

1. Entra en una sala de voz, conecta el micrófono y cambia a otro canal de texto del mismo megagrupo. Comprueba que sigues oyendo y transmitiendo, y que aparece la barra de llamada.
2. Silencia/reactiva y abandona la llamada desde la barra persistente.
3. Pega una imagen desde el portapapeles en un MD y en un canal. Comprueba la subida y abre la imagen en el visor.
4. Prueba un GIF y un sticker en el visor.
5. Pega un vídeo MP4 o WebM desde una aplicación que lo ofrezca como archivo al portapapeles.
6. Envía un ZIP menor de 50 MB desde Windows y desde otro navegador. Comprueba que el mensaje se puede descargar.
7. Abre un chat con historial largo y comprueba el esqueleto inicial, el scroll al final y la carga de recursos multimedia.
8. Comprueba que los mensajes se expanden al ancho disponible en escritorio y siguen ajustándose en móvil.

La validación estática de este paquete no sustituye las pruebas reales con cuentas, navegador, micrófono y Storage de tu proyecto Supabase.
