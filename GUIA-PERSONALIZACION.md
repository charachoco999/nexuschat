# Guía de personalización de Nexus

Esta guía explica las opciones visuales y de comodidad disponibles en Nexus v0.10.1-alpha3. Se actualizará junto con las siguientes versiones cuando se añadan nuevas opciones.

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
