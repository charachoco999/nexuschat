# Nexus v0.8 — actualización desde v0.7.2

Esta versión está preparada para el proyecto Nexus que ya funciona con v0.7.2.

## Antes de empezar

1. Haz una copia de seguridad del repositorio y de la base de datos.
2. Comprueba que ya aplicaste las migraciones hasta `20261101_nexus_v072_profile_asset_mime.sql`.
3. Conserva `assets/js/config.js`: el paquete Upgrade no contiene tus credenciales.

## 1. Migración de Supabase

En **Supabase → SQL Editor**, ejecuta una sola vez:

`supabase/migrations/20261105_nexus_v08_performance_presence_frames.sql`

La migración:

- Añade `profiles.profile_frame_url` para guardar el marco de avatar.
- Añade índices de orden descendente para las consultas paginadas de mensajes.
- Autoriza el tema Realtime privado `nexus-online` para presencia global de usuarios autenticados.
- Actualiza las políticas privadas Realtime sin abrir canales públicos.

No elimina mensajes, conversaciones, perfiles ni archivos.

## 2. Publicar GitHub Pages

1. Descomprime `nexus-chat-v0.8-upgrade.zip`.
2. Entra en la carpeta `nexus-chat` del ZIP.
3. Sube su contenido a la raíz de tu repositorio, conservando las rutas `assets/`, `supabase/` e `index.html`.
4. Conserva tu `assets/js/config.js`; no lo sustituyas por `config.js.example`.
5. Espera a que GitHub Pages termine el despliegue y recarga con `Ctrl + F5`.

El HTML usa una versión nueva en la URL de `app.js` para invalidar la caché del navegador.

## 3. Qué cambia

### Historial y rendimiento

- La primera entrada carga los 50 mensajes más recientes.
- El botón **Cargar mensajes anteriores** obtiene páginas adicionales de 50.
- La aplicación guarda hasta 200 mensajes por contexto y hasta 12 contextos en memoria durante la sesión.
- Al volver a un chat, renderiza primero la copia en memoria y consulta solo los mensajes posteriores al último mensaje almacenado. Si el mismo chat ya está abierto, volver a seleccionarlo no reconstruye el panel: sincroniza únicamente el delta.
- Los cambios de mensajes, ediciones, votos de encuesta y reacciones actualizan el elemento afectado en vez de reconstruir toda la conversación.
- Respuestas, encuestas, votos, reacciones, stickers, emojis y adjuntos de cada página se consultan en lote para evitar consultas individuales por mensaje.
- La sincronización al volver a una pestaña usa un cursor compuesto `(created_at,id)` y consulta páginas de 100 mensajes nuevos; no vuelve a consultar todo el historial.
- Al cargar páginas antiguas, el cursor avanza desde el límite real de la página aunque la caché recorte entradas por encima del máximo de 200.
- La caché es temporal y local a la pestaña. Al cerrar o recargar el navegador se vuelve a cargar la página reciente desde Supabase. Las consultas auxiliares de cada página agrupan respuestas, encuestas, votos, reacciones, stickers, emojis y enlaces firmados para evitar consultas individuales por mensaje.

### Presencia y escritura

- La lista de amigos y la bandeja de MDs muestran si la otra persona está conectada.
- Dentro de un MD, grupo o canal aparece una fila compacta con los miembros conectados (hasta 8 nombres y un contador adicional). Pulsar una persona abre su perfil público.
- Cuando alguien escribe, aparece un indicador temporal separado en el encabezado del contexto actual.
- La presencia usa el tema privado `nexus-online`; escritura y presencia de contexto usan el tema privado de la conversación/canal. No se realizan consultas periódicas cada segundo.
- El estado personalizado del perfil también se muestra en la ficha y se comparte como texto de presencia.

La presencia global indica que alguien tiene Nexus abierto y conectado, no que esté mirando activamente una conversación concreta. La lista dentro del encabezado muestra solamente los miembros del chat/canal actual.

### Caja de escritura

- El área de texto aumenta de altura al escribir varias líneas, hasta un máximo de 180 px; después utiliza desplazamiento interno.
- `Enter` envía el mensaje y `Shift + Enter` inserta una línea nueva.
- En **Configuración → Fuente de escritura** puedes seleccionar DM Sans, Space Grotesk, Serif, Monoespaciada o tu fuente personalizada de perfil.
- En **Estado personalizado** puedes escribir hasta 60 caracteres. Se muestra junto a tu identidad y en presencia.

### Marcos de perfil

- En **Perfil → Efectos de identidad** hay un nuevo selector **Marco del avatar**.
- Se aceptan PNG, JPG, WebP y GIF de hasta 8 MB.
- Nexus aplica una máscara circular transparente en el centro del marco mediante CSS. No modifica el archivo original ni requiere editarlo con otra aplicación.
- El marco aparece en avatares de mensajes, perfiles públicos, amigos, MDs y listas que usan la identidad del usuario.
- Los marcos funcionan mejor con un diseño de borde que rodee el avatar y deje un margen alrededor. La perforación central es circular.

### Recuperación y cambio de contraseña

- Al pedir un cambio desde Configuración, Nexus envía un enlace de recuperación con `?recovery=1`.
- Al abrirlo, Nexus muestra una pantalla específica para introducir y confirmar la nueva contraseña.
- Al guardar, actualiza la contraseña y cierra la sesión de recuperación. Después debes iniciar sesión con la contraseña nueva.
- Ya no se solicita la contraseña mediante un `prompt` ni se deja al usuario dentro de la aplicación con la sesión temporal de recuperación. En Configuración, el botón aclara que envía un enlace; el formulario dedicado guarda la contraseña y cierra la sesión temporal antes de volver al login.

El envío sigue dependiendo del SMTP que tengas configurado en Supabase. Si Supabase devuelve `redirect_to is not allowed`, añade a **Authentication → URL Configuration → Redirect URLs** la URL `https://charachoco999.github.io/nexuschat/?recovery=1` (o el patrón equivalente para tu ruta de GitHub Pages).

### CSS de megagrupos

El editor admite más selectores locales para portada, paneles informativos, tarjetas de roles/medallas y canales de la barra lateral. También permite más propiedades de presentación, distribución, bordes, fondos de gradiente y sombras.

Consulta `MEGAGROUP-CSS-v0.8.md` para ver la lista completa. Se mantienen bloqueados `@import`, `@font-face`, `url()`, scripts, selectores globales y propiedades que permitan sacar el estilo fuera del área del megagrupo.

## 4. Pruebas recomendadas

Utiliza dos cuentas en dos navegadores o perfiles diferentes:

1. Abre el mismo canal con ambas cuentas. Comprueba que el contador de miembros en línea se actualiza al entrar y salir.
2. Escribe en el canal con una cuenta. La otra debería mostrar el indicador de escritura y retirarlo al dejar de escribir.
3. Comprueba que los amigos conectados aparecen como **En línea** en la lista de amigos y en los MDs.
4. Entra en una conversación con más de 50 mensajes. Deben mostrarse primero los 50 últimos; carga mensajes anteriores y comprueba que se conserva la posición del scroll.
5. Sal y vuelve a entrar a un chat. Debe aparecer enseguida el contenido en caché y solo consultar los mensajes nuevos.
6. Escribe varias líneas con `Shift + Enter`. El compositor debe crecer sin tapar los mensajes ni el botón de enviar.
7. Cambia la fuente de escritura y el estado personalizado. Comprueba que se conservan después de cerrar y volver a iniciar sesión.
8. Sube un marco PNG con el centro transparente. Debe rodear el avatar sin taparlo.
9. Solicita un cambio de contraseña, abre el correo y confirma que aparece la pantalla de nueva contraseña. Después comprueba que Nexus pide iniciar sesión otra vez.
10. Prueba el CSS personalizado en la portada, paneles, canales, barra lateral y chat del megagrupo. Comprueba que un MD normal no hereda el tema.
11. Cambia la contraseña desde Configuración, abre el correo y confirma que `?recovery=1` muestra el formulario de nueva contraseña. Si Supabase rechaza el destino, añade la URL de recuperación a Redirect URLs.

## 5. Notas y límites

- La presencia global muestra usuarios que tienen Nexus abierto y conectado. No equivale a un indicador de actividad o disponibilidad manual.
- La presencia y la escritura desaparecen al desconectarse el navegador o expirar el canal.
- La caché de mensajes no se guarda en `localStorage`; es temporal para evitar guardar mensajes privados en almacenamiento persistente del navegador.
- Los marcos no alteran el archivo: el hueco central se obtiene con una máscara CSS circular.
- Esta actualización no cambia la configuración de SMTP, GIPHY, VAPID ni WebRTC.
