# Nexus v0.13.1-alpha1 — administración y voz de la comunidad

## Administración
- Nuevo nivel Super Admin, separado de los administradores de plataforma.
- Solo Super Admin puede designar o retirar administradores de plataforma.
- Las operaciones están protegidas mediante RPC SECURITY DEFINER; el frontend no escribe directamente en `user_roles`.
- Las altas y retiradas quedan registradas en `platform_admin_audit`, consultable únicamente por Super Admin.
- El rol Super Admin se concede mediante un bootstrap SQL manual, nunca automáticamente.

## Bugs de la comunidad
- Presencia de amigos: la lista de conversaciones combina la presencia global y la del chat abierto para evitar falsos estados desconectados.
- Insignias: los tooltips Hovers+ ya no generan barras de desplazamiento internas.
- Recibos de lectura: “Visto por…” se muestra con una insignia de doble check más visible.
- Adjuntos: los controles de mensaje y de descarga pueden distribuirse en varias líneas y dejan de superponerse.

## Sugerencias
- Buscador de mensajes por palabras, fechas, archivos, autor, megagrupo, canal y rol. Los resultados respetan RLS de Supabase.
- Nuevo preset de acento “Rosita pastel” (#F3A9C8).

## Feedback
- Se conserva el panel existente de errores y sugerencias, con estados Abierto / En revisión / Resuelto / Rechazado, notas internas y medalla opcional al resolver.
- No se importan automáticamente entradas de prueba ni se duplican las sugerencias que ya estén guardadas en `nexus_platform_feedback`.

## Requiere SQL
- `supabase/migrations/20261117_nexus_v0131_super_admin.sql`
- Después, ejecutar manualmente `supabase/BOOTSTRAP-SUPER-ADMIN-v0.13.1.sql` sustituyendo el UUID.


## Alcance de infraestructura
Esta actualización no cambia el Worker ni los bindings de R2. Conserva la configuración Cloudflare Edge que ya tengas de v0.13.0-alpha1; no requiere redeplegar Workers para usar las funciones de administración, búsqueda y ajustes de interfaz.
