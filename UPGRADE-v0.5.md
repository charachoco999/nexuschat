# Nexus v0.5 — actualización

Esta actualización está pensada para una instalación que ya funciona con Nexus v0.4.

## Antes de empezar

1. Haz una copia de seguridad de la base de datos desde Supabase (Database → Backups) y guarda una copia de tu repositorio.
2. Comprueba que la versión activa es v0.4. Si todavía no aplicaste las migraciones de v0.2, v0.3 y v0.4, no saltes directamente a v0.5: sigue las guías anteriores en orden.
3. No compartas ni subas `assets/js/config.js`; conserva el archivo local con la URL de Supabase y la clave pública de tu proyecto.

## 1. Aplicar la migración

En Supabase → SQL Editor, abre y ejecuta una sola vez:

`supabase/migrations/20261101_nexus_v05_features.sql`

La migración añade:

- Archivo/ocultación por usuario de conversaciones (`conversation_members.hidden_at`).
- Función segura para salir de una conversación sin borrar el historial de los demás.
- Creación transaccional de encuestas mediante `create_poll`, para que el mensaje y sus opciones existan antes de que Realtime pueda notificar la inserción.
- Límite de 10 widgets por perfil y nickname por megagrupo.
- Invitaciones con código, vencimiento y límite de usos.
- Solicitudes de alianza por ID, incluso cuando el megagrupo de destino sea privado, y acceso a megagrupos aliados.
- Mensajes fijados y confirmaciones de lectura en conversaciones privadas/grupales.
- Publicación Realtime de las tablas nuevas necesarias.

La migración conserva los mensajes y las cuentas. No elimina conversaciones ni perfiles. Aun así, haz la copia de seguridad antes de ejecutarla.

## 2. Actualizar GitHub Pages

1. Descomprime `nexus-chat-v0.5-upgrade.zip`.
2. Entra en la carpeta `nexus-chat` del ZIP.
3. Sube su contenido a la raíz del repositorio de GitHub Pages y acepta reemplazar los archivos existentes.
4. Conserva tu `assets/js/config.js`. El paquete solo contiene `config.js.example` como referencia.
5. Espera a que GitHub Pages publique los cambios y recarga Nexus con `Ctrl + F5`.

## 3. Funciones nuevas

### Conversaciones

- **Archivar** oculta la conversación solo en tu bandeja. Puedes verla desde «Archivadas» y restaurarla.
- **Archivar un MD** lo oculta solo de tu bandeja, sin dejar a la otra persona en un chat abandonado; puedes restaurarlo desde «Archivadas» y volverá a aparecer si recibes un mensaje nuevo. **Salir de un grupo** elimina tu pertenencia, pero conserva el historial para los demás. Si eras el propietario, se promueve al miembro más antiguo que siga dentro.
- Puedes seguir creando varias conversaciones con la misma persona; no se fuerza la fusión de MDs existentes.

### Encuestas

La nueva RPC `create_poll` inserta el mensaje y la encuesta en una misma transacción. Ya no hay una ventana en la que Realtime pueda renderizar el mensaje antes de que exista su encuesta.

### Fondo de megagrupo

El fondo configurado en el megagrupo se aplica también al panel de canales de texto y al panel visual de canales de voz. Los canales de voz siguen siendo una interfaz de sala: el audio WebRTC todavía no está integrado.

### Identidad y perfil

- Alias visibles en la ficha pública.
- Hasta 10 widgets con icono, banner, título y descripción.
- Nickname específico para cada megagrupo.
- Ficha de perfil pública al pulsar el nombre de una persona.

### Alianzas y comunidad

- Crear enlaces de invitación con duración de hasta 720 horas y límite de usos ilimitado (0) o de hasta 500 usos.
- Aceptar alianzas y entrar a comunidades aliadas mediante una función que comprueba la alianza en el servidor.
- Solicitar alianzas por ID aunque el megagrupo de destino sea privado.

### Mensajería

- Fijar y desfijar mensajes. En canales, se requiere el permiso de gestión de mensajes.
- Confirmaciones de lectura para conversaciones privadas y grupales.

## 4. Pruebas recomendadas

Utiliza dos cuentas distintas en dos navegadores o perfiles de navegador:

1. Envía un mensaje en un MD y comprueba que aparece en ambas sesiones.
2. Archiva el MD en una cuenta: debe desaparecer solo de esa bandeja. En «Archivadas» debe poder restaurarse.
3. Crea varios MDs con la misma persona y confirma que permanecen separados.
4. Sal de un grupo con una cuenta y comprueba que la otra conserva el historial.
5. Crea una encuesta y comprueba que aparece una sola vez para quien la publica y para la otra cuenta, sin recargar.
6. Configura un fondo en un megagrupo y abre un canal de texto y uno de voz.
7. Añade un widget y un alias a un perfil; pulsa el nombre del usuario para ver la ficha pública.
8. Fija un mensaje en un MD. En un canal, prueba la acción con una cuenta con y otra sin `manage_messages`.
9. Lee un mensaje con la segunda cuenta y comprueba el indicador de lectura en la primera.
10. Crea una invitación, ábrela en una sesión sin pertenencia al megagrupo y comprueba que se incorpora.
11. Envía una solicitud de alianza usando el ID de una comunidad privada y comprueba aceptación y acceso a la comunidad aliada.

## 5. Límites que siguen pendientes

- Canales de voz: no transportan audio todavía; falta WebRTC, señalización y TURN.
- Stickers, emojis propios y buscador de GIFs: falta el editor y/o la integración con un proveedor externo.
- Quick-Alt: la tabla de perfiles alternativos existe, pero no hay todavía un selector completo de identidad activa.
- Efectos animados, fuentes subidas y placa de perfil: siguen pendientes.
- Los recibos de lectura están implementados para MDs y grupos privados, no para canales de megagrupo.

## 6. Diagnóstico

Si aparece un error de columna, comprueba que la migración v0.5 se ejecutó correctamente. Si no aparecen cambios en tiempo real, comprueba que Realtime está activo para `messages`, `poll_votes`, `pinned_messages` y `conversation_reads` en el esquema `public`.

La comprobación local del paquete no sustituye una prueba real contra tu proyecto Supabase. La migración no se ha ejecutado automáticamente en tu base de datos ni se ha publicado directamente en tu repositorio.
