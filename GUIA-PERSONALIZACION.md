# Guía de personalización de Nexus

Esta guía explica las opciones visuales y de comodidad disponibles en Nexus v0.10.2-alpha1. Se actualizará junto con las siguientes versiones cuando se añadan nuevas opciones.

## Abrir la guía dentro de Nexus

Pulsa **Guía** en la barra superior. Funciona tanto en escritorio como en móvil. En móvil, también puedes abrir el menú con el botón ☰ para acceder a Configuración y Perfil. Dentro de la guía, pulsa **Volver a Nexus** para regresar a la pantalla anterior.

## Interfaz y colores

En **Configuración** puedes cambiar el color de acento, el fondo general mediante una URL HTTPS, la densidad y la fuente de escritura. En **Colores de interfaz** puedes ajustar el fondo principal, paneles, superficies, texto principal y secundario, bordes y fondo de las cajas agrupadas. Elige colores que mantengan un contraste legible.

## Perfil e identidad

En **Tu perfil** puedes cambiar nickname, pronombres, aliases, biografía, avatar y banner. También puedes configurar recursos de identidad como marcos, placas y su opacidad. Quick-Alt permite gestionar identidades alternativas asociadas a la misma cuenta. Desde Configuración puedes ocultar medallas universales.

## Megagrupos

Selecciona un megagrupo y entra en su página. Pulsa **Administrar** para editar la apariencia (la edición visual completa corresponde al propietario):

- **Icono:** imagen HTTPS del megagrupo.
- **Banner:** imagen de la cabecera.
- **Fondo:** imagen usada en la página del megagrupo y detrás de los canales de texto.
- **Color del nombre:** color de su título.
- **CSS personalizado:** reglas visuales limitadas y saneadas. No se permiten scripts, imports ni recursos externos arbitrarios.

## Mensajes y formato

En Configuración puedes elegir la fuente de los mensajes y activar BoxGlow, que permite ajustar color, intensidad y una textura HTTPS opcional. Para dar formato a los mensajes, abre la **Guía de Markdown** desde Configuración o desde el compositor. Allí encontrarás bloques, estilos, spoilers, citas, tablas, NexCSS e InputSync.

## Notificaciones

Configura por separado los avisos de MDs, grupos y megagrupos. Puedes seleccionar un sonido personalizado, que se guarda localmente en el navegador/dispositivo. Cada conversación o canal puede usar la configuración general, recibir todos los mensajes, solo menciones o quedar silenciado desde el botón de notificaciones de su encabezado.

## Optimización

En Configuración → Optimizaciones puedes compactar paneles, elegir 25/50/75/100 mensajes iniciales, activar o desactivar el agrupado de mensajes, desactivar el ajuste de ancho/efectos de las cajas agrupadas, desactivar los retrasos Markdown y reducir tarjetas visuales en voz.

## Emojis y stickers

Desde el compositor abre **Emojis / Stickers** para elegir emojis estándar, emojis personalizados y stickers. Los recursos pueden ser personales o pertenecer a una conversación o megagrupo. Los emojis personalizados también pueden usarse en reacciones si están disponibles para ese chat.

## Workshop

En Workshop puedes explorar presets compartidos y publicar los tuyos. Comprueba qué elementos modifica un preset antes de aplicarlo.

---

**Consejo:** si no encuentras una opción, abre Configuración y busca la sección correspondiente. La guía se ampliará cuando Nexus incorpore nuevas herramientas de personalización.


## Voz y calidad de audio

- **Cancelación básica de eco y ruido en VC:** Configuración → Optimizaciones. Usa las opciones integradas del navegador cuando estén disponibles. Se aplica al volver a entrar en el canal de voz.


## Audio y voz (hotfix v0.10.1-alpha3 hotfix3)

- **Notas de voz:** Nexus graba en WAV PCM mono a 16 kHz para no depender del formato de grabación preferido por cada móvil. Android, iOS y escritorio reciben el mismo tipo de archivo; el límite de grabación es de 15 minutos y el archivo debe respetar el límite de subida de 50 MB.
- **VC:** Configuración → Optimizaciones → Cancelación básica de eco y ruido. Activa las opciones de procesamiento del micrófono del navegador cuando estén disponibles. El ajuste se aplica al volver a conectar al canal de voz.

## Emojis (recordatorio)

En el selector puedes buscar por nombre, alias o emoji. En el compositor escribe `:smile:`, `:heart:` o `:thumbsup:` para insertar un emoji estándar; al escribir `:` seguido de un nombre aparecen sugerencias. Los emojis personalizados disponibles en el chat también se muestran en esas sugerencias. También puedes usar nombres en español como `:gato:`, `:perro:`, `:corazon:`, `:fuego:` y `:pulgar_arriba:`.

## Mensajes agrupados (recordatorio)

Los mensajes consecutivos de una misma persona se presentan en un único bloque. La placa y BoxGlow se aplican al bloque sin borrar la configuración decorativa original de cada mensaje, para que las ediciones y reacciones no hagan desaparecer esos efectos. En móvil vertical, el modo compacto conserva la navegación normal de una sola columna.


## Novedades de Nexus v0.10.2

- **Perfiles por megagrupo:** abre Tu perfil → Perfil por megagrupo, escoge un megagrupo y personaliza nickname, pronombres, aliases, biografía, avatar, banner, color, fuentes, efectos, placa, marco, estado y widgets. Quick-Alt sigue siendo global.
- **Fuentes separadas:** la fuente del nickname y la fuente del texto de los mensajes se configuran por separado. En perfiles por megagrupo también pueden sobrescribirse.
- **BetterEmojis:** los mensajes compuestos únicamente por emojis se ven más grandes. En la configuración del emoji personal puedes elegir si lo ven solo tú, tus amigos, miembros de megagrupos compartidos o cualquiera.
- **Sticker Workshop:** entra en Sticker Workshop desde la navegación, busca publicaciones, añade stickers a tu colección o publica los tuyos. Publicar no hace público el archivo de Storage por sí solo: la lectura se valida mediante las políticas de Nexus.
- **Megacompactación BETA:** activa primero Configuración → Optimizaciones → Compactar paneles; después activa Megacompactación. El selector rápido permite saltar entre Chats, Amigos, Workshop y Stickers. Puede consumir más recursos en dispositivos de gama baja.
- **Administración de plataforma:** el botón de la barra superior solo aparece para cuentas con el rol de administrador de plataforma. Desde allí se buscan usuarios, se revisan sugerencias/bugs y se gestionan sanciones.
- **Sugerencias y bugs:** cualquier usuario puede enviar comentarios al equipo con los botones superiores. El estado y la posible medalla de recompensa solo los decide el equipo.
- **Reenvío y archivos:** usa Reenviar en el menú del mensaje. Para adjuntar varios archivos, selecciónalos juntos; el texto del compositor se aplica como descripción al primer archivo del lote.
- **Separadores de fecha:** los mensajes de días diferentes se separan por fecha aunque desactives la agrupación.
- **Ayuda de Markdown:** Configuración → Guías de Nexus → Markdown ofrece ejemplos recomendados y ejemplos que conviene evitar.



## Opciones añadidas en Nexus v0.11

### Optimización y navegación

- **ImageCulling (BETA):** carga imágenes y vídeos a medida que te acercas a ellos en el historial. Desactívalo en Configuración → Optimizaciones si prefieres cargar todos los medios de inmediato.
- **Megacompactación (BETA):** necesita que **Compactar paneles** esté activado. Reúne la navegación de Chats, Amigos y Workshops en una barra superior de la lista de MDs. Puede consumir más recursos en dispositivos modestos.
- **Popups nativos:** en Optimizaciones puedes sustituir las ventanas de Nexus por los diálogos del navegador.
- **Hovers+:** activa o desactiva las tarjetas emergentes con el estilo visual de Nexus.

### Mensajes y adjuntos

- Selecciona uno o varios archivos con **＋ Archivo**. Se quedan en la bandeja de adjuntos hasta que envíes el mensaje, junto con el texto que escribas.
- Marca **Ocultar archivos adjuntos con spoiler** para que los destinatarios tengan que pulsar para mostrarlos.
- Añade `&&lang=true` a la cabecera de un bloque de código para mostrar el lenguaje sobre el bloque.

### Megagrupos

- Los **Foros** son categorías con tableros. Los miembros pueden crear tableros dentro de un foro usando el botón `+`.
- **Channels+** permite a quienes gestionan canales o roles asignar permisos concretos por canal a miembros y roles. Un override de miembro tiene prioridad; una denegación de rol prevalece sobre una autorización de otro rol.
- Cada canal puede activar o desactivar la recepción de avisos importantes del megagrupo.

### Avisos, reputación e insignias

- Los avisos importantes globales aparecen como ventanas de Nexus. Los avisos de megagrupo se muestran dentro de los canales con recepción activada.
- En la sección de personalización puedes solicitar una insignia y revisar el estado de la propuesta.
- En **Reputación** aparecen los avisos y los tiempos de sanción que el sistema ha podido registrar.

