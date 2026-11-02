# Nexus v0.9 — actualización desde v0.8

Esta actualización está preparada para una instalación que ya utiliza Nexus v0.8.

## Antes de empezar

1. Haz una copia de seguridad del repositorio y de la base de datos de Supabase.
2. Comprueba que ya aplicaste las migraciones anteriores, incluida `20261105_nexus_v08_performance_presence_frames.sql`.
3. Conserva `assets/js/config.js`. Los paquetes de actualización no contienen tus credenciales; no lo sustituyas por `config.js.example`.

## 1. Migración de Supabase

En **Supabase → SQL Editor**, ejecuta una sola vez:

`supabase/migrations/20261106_nexus_v09_mobile_unread_widgets.sql`

La migración:

- Eleva a 32 el límite de widgets de perfil en la base de datos.
- Crea `channel_reads` para registrar cuándo ha leído cada miembro un canal.
- Añade `mark_channel_read(uuid)` para marcar un canal como leído después de abrirlo.
- Añade `get_nexus_unread_counts()` para devolver los contadores de MDs, grupos y canales del usuario autenticado.
- Inicializa únicamente los registros de lectura que faltan. Los registros existentes no se sobrescriben.

No elimina mensajes, conversaciones, perfiles, widgets ni archivos.

## 2. Publicar GitHub Pages

1. Descomprime `nexus-chat-v0.9-upgrade.zip`.
2. Entra en la carpeta `nexus-chat` del ZIP.
3. Sube su contenido a la raíz de tu repositorio, conservando las rutas `assets/`, `supabase/` e `index.html`.
4. **Conserva tu `assets/js/config.js` actual**. El paquete contiene `config.js.example`, no tus claves.
5. Espera a que GitHub Pages termine el despliegue y recarga Nexus con `Ctrl + F5`.

Las URL de `app.js` y `app.css` cambian a v0.9 para evitar que el navegador reutilice los archivos anteriores de la caché.

## 3. Qué cambia

Consulta `CHANGELOG-v0.9.md` para el listado completo. La actualización incorpora navegación móvil, panel de miembros en línea, contadores por conversación/canal, tarjetas de voz con modo compacto opcional, selector conjunto de emojis/stickers, widgets de enlace y compactación de paneles.

### Configuración nueva

- **Configuración → Compactar paneles:** oculta la navegación que no corresponde al contexto actual. En MDs deja la navegación personal; en megagrupos deja los canales.
- **Configuración → Optimizaciones:** activa **Desactivar tarjetas visuales en chats de voz** para usar la presentación compacta de participantes.

### Widgets de enlace

En **Tu perfil → Widgets**, selecciona **Enlace externo**, introduce una URL HTTPS y, opcionalmente, un texto. El título también es opcional: si lo dejas vacío, se utiliza el dominio de la URL. El navegador intenta obtener el favicon del dominio. Los enlaces se abren en otra pestaña con protección `noopener noreferrer`.

## 4. Pruebas recomendadas

Haz las pruebas con dos cuentas en navegadores o perfiles diferentes:

1. En un móvil o emulador estrecho, abre el menú lateral, entra en un megagrupo y abre un canal. Comprueba que el chat ocupa la pantalla y que el botón de volver abre la lista de canales.
2. Abre un MD en el móvil. El botón de volver debe mostrar la lista de conversaciones.
3. Activa **Compactar paneles**. En un MD debe quedar visible la navegación personal; en un canal de megagrupo deben quedar visibles los canales y no la lista de MDs. Comprueba también que la opción se conserva al recargar.
4. Con ambas cuentas en el mismo chat, abre **X en línea** y comprueba que aparecen las dos tarjetas, con sus avatares, marcos y estados.
5. Envía mensajes desde una cuenta mientras la otra está en otra conversación. Debe aumentar el contador junto al chat. Al abrirlo debe desaparecer el contador.
6. Repite la prueba en un canal de megagrupo. Al abrir el canal, su contador debe desaparecer.
7. Entra en un canal de voz desde dos cuentas. Comprueba que se muestran las tarjetas con avatar y marco; activa la opción de Optimizaciones y verifica que cambia a la lista compacta sin desconectar el audio.
8. Abre el selector de emojis. Prueba emojis estándar, stickers y emojis personalizados.
9. Crea un widget de enlace con URL y sin título ni descripción. Debe usar el dominio como título, mostrar el favicon cuando esté disponible y abrir la dirección en otra pestaña.
10. Comprueba que un perfil puede guardar 32 widgets y que un intento de añadir un número 33 se rechaza desde la interfaz.
11. Sube un marco con centro transparente y comprueba su presentación en mensajes, perfiles públicos, lista de miembros en línea y tarjetas de voz.

## 5. Notas y límites

- La interfaz móvil utiliza los mismos datos y permisos que el cliente de escritorio; no requiere una aplicación móvil separada.
- Los contadores se basan en mensajes posteriores al último registro de lectura. El cliente los actualiza al entrar en el contexto y al recibir mensajes en tiempo real.
- El favicon se solicita al servicio de iconos de Google usando el dominio del enlace. Si no devuelve una imagen, aparece un símbolo genérico; el widget sigue funcionando.
- Las tarjetas de voz son una presentación visual. La transmisión sigue dependiendo de WebRTC P2P y de la conectividad de cada red; en redes restrictivas puede seguir haciendo falta TURN.
- La migración necesita permisos de propietario del proyecto en Supabase. No requiere cambios en SMTP, GIPHY, VAPID ni en las claves WebRTC.
- Las pruebas automáticas de este paquete verifican sintaxis y estructura estática; la prueba real de Realtime, RLS, correo y audio debe hacerse con tu proyecto Supabase y dos sesiones autenticadas.
