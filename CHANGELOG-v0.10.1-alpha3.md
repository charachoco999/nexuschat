# Nexus v0.10.1-alpha3 — beta hotfix

Parche de mantenimiento sobre v0.10.0-alpha3. No abre la rama 0.11 y no modifica Nexus Desktop.

## Correcciones

- Restaurada la imagen de fondo de los megagrupos en canales de texto y en el resto de canales que muestran el panel de conversación.
- La imagen se aplica ahora a `.active-conversation`, no solo al panel exterior. Esto evita que el fondo opaco `var(--bg)` añadido en alpha2 lo tape.
- Los mensajes directos conservan el fondo normal del tema personal.

## Guía completa de personalización

- Nueva vista integrada `Guía de personalización`, con índice y explicaciones sencillas de las opciones actuales.
- Acceso permanente mediante el botón **Guía** de la barra superior, también visible en móvil.
- Acceso adicional desde Configuración.
- Navegación de vuelta a la pantalla anterior con **Volver a Nexus**.
- La vista enlaza a Configuración, Perfil, el megagrupo actual y la guía específica de Markdown.
- Se incorpora `GUIA-PERSONALIZACION.md` en la raíz del proyecto como copia consultable fuera de la aplicación.

## Base de datos

- No requiere migración SQL.
- No cambia el esquema de Supabase, permisos, mensajes, perfiles ni almacenamiento.

## Mantenimiento de la guía

Cuando se añadan opciones de personalización en versiones futuras, se deben actualizar tanto la guía integrada en `index.html` como `GUIA-PERSONALIZACION.md` en el mismo cambio.

## Validación realizada

- Sintaxis JavaScript comprobada con `node --check`.
- HTML comprobado: sin IDs duplicados.
- CSS: llaves equilibradas.
- Referencias de caché actualizadas a `v0.10.1-alpha3`.
- Paquetes ZIP comprobados.

No se ha probado contra una instancia Supabase real ni se ha ejecutado una prueba visual en todos los navegadores y dispositivos. La entrega se mantiene como beta hotfix.
