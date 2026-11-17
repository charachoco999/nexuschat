# Nexus v0.13.1-alpha1 — instalación

## Contenido
- `nexus-chat/`: archivos web actualizados. Copiar a la raíz del repositorio publicado.
- Migración SQL para Super Admin y RPCs protegidas.
- Archivo de bootstrap separado para designar al primer Super Admin.

## 1. Copia de seguridad
Haz una copia del repositorio y de Supabase antes de aplicar la migración. Conserva tu `assets/js/config.js`: este archivo no viene incluido en el paquete porque contiene tu configuración personal.

## 2. Publicar la web
Sube el contenido de la carpeta `nexus-chat/` a la raíz del repositorio de Nexus y espera a que Cloudflare Pages termine el despliegue. Conserva `assets/js/config.js` y no sustituyas tus claves por `config.js.example`.

## 3. Aplicar la migración Super Admin
En Supabase → SQL Editor, ejecuta una sola vez:

`supabase/migrations/20261117_nexus_v0131_super_admin.sql`

La migración:
- Crea `platform_super_admins` sin promover automáticamente a nadie.
- Añade `is_platform_super_admin()`.
- Extiende `is_platform_admin()` para que Super Admin herede los permisos de administrador de plataforma.
- Añade `list_platform_admins()` y `set_platform_admin_role(uuid, boolean)`, ambas protegidas en el servidor.
- Registra las designaciones y retiradas en `platform_admin_audit`, visible solo para Super Admin.
- Impide que un admin normal pueda otorgar el rol admin o Super Admin.
- Impide que el propio panel retire un Super Admin o que alguien modifique su propio rol.

No ejecuta cambios en Auth, Storage, mensajes ni otros datos existentes.

## 4. Designar al primer Super Admin
Es un paso manual y obligatorio. No se puede deducir con seguridad qué cuenta debe ser Super Admin.

1. En Supabase → Authentication → Users, localiza TU cuenta y copia su UUID (no el correo).
2. Abre `supabase/BOOTSTRAP-SUPER-ADMIN-v0.13.1.sql`.
3. Sustituye las **dos apariciones** de `REPLACE_WITH_YOUR_AUTH_USER_UUID` por ese UUID (una en el bloque de inserción y otra en la consulta de verificación).
4. Ejecuta el SQL.
5. Comprueba que la consulta final devuelve tu cuenta.

No compartas tu UUID en público. Si lo haces desde una sesión administrativa de Supabase, la clave `service_role` no interviene en el navegador ni en GitHub.

## 5. Utilizar el panel
- Cierra sesión y vuelve a entrar, o recarga la aplicación para que `checkAdmin()` vuelva a consultar el nivel.
- Abre Panel de administración.
- Solo Super Admin verá la sección “Administradores de plataforma”.
- Escribe el nombre de usuario exacto (se acepta con o sin `@`) y pulsa “Designar administrador”.
- Para retirar un administrador, pulsa “Retirar admin” junto a su cuenta.
- Los Super Admin aparecen protegidos y no se pueden retirar desde esta lista.

El panel normal de administración sigue siendo accesible a admins y conserva búsqueda de usuarios, moderación, avisos, medallas, reportes y feedback.

## 6. Buscador de mensajes
Pulsa el nuevo icono de búsqueda de mensajes en la parte superior de la barra lateral. Puedes filtrar por:
- Palabras en el contenido o nombre de archivos adjuntos.
- Fecha inicial y final.
- Autor (username o nickname).
- Conversaciones o canales.
- Megagrupo, canal y rol del megagrupo.
- Mensajes que tengan adjuntos.

La consulta se realiza contra `public.messages` con la sesión normal. RLS sigue siendo la frontera de autorización: el buscador no da acceso a mensajes de conversaciones/canales donde la cuenta no tenga permiso.

El resultado abre el chat y carga una ventana de mensajes alrededor del mensaje encontrado. El buscador muestra hasta 80 resultados por ejecución.

## 7. Pruebas recomendadas
1. Entra con la cuenta Super Admin: debe aparecer el bloque de administradores.
2. Entra con una cuenta admin normal: debe ver el panel habitual, pero no el bloque Super Admin.
3. Entra con una cuenta normal: no debe ver el panel de plataforma.
4. Designa una cuenta de prueba como admin y comprueba que puede abrir el panel.
5. Retira ese admin y confirma que pierde el acceso tras recargar.
6. Comprueba que ninguna cuenta admin puede ejecutar `set_platform_admin_role` correctamente.
7. Busca mensajes por palabra, fecha, archivo, autor y filtros de canal/rol.
8. Prueba abrir un resultado antiguo en MD y en canal.
9. Comprueba la luz de presencia, tooltip de insignia, recibo y botones de descarga en escritorio y móvil.
10. Selecciona “Rosita pastel”, guarda apariencia y recarga.

## 8. Notas de seguridad y reversión
- No modifiques manualmente `user_roles` desde el navegador.
- No concedas credenciales `service_role` al frontend.
- La concesión inicial de Super Admin es manual y vive en `platform_super_admins`.
- Para revertir el nivel Super Admin, primero designa otro Super Admin desde SQL de forma deliberada; después elimina el registro correspondiente de `platform_super_admins`. No borres la tabla si ya hay asignaciones en uso.
- Los bugs de presencia y UI no requieren migración SQL.
- El buscador de mensajes no requiere migración SQL.
