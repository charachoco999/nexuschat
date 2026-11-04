# Nexus v0.11.0-alpha1-hotfix2

Hotfix de la rama 0.11 para avisos persistentes, notificaciones de voz y herramientas Markdown. No modifica Nexus Desktop.

## Correcciones

- Los avisos globales se reconocen por cuenta en Supabase; cambiar de canal o usar otro navegador no vuelve a mostrar avisos ya descartados.
- Los avisos importantes de megagrupo se publican como mensajes reales de Nexus (App) en todos los canales de texto suscritos de uno, varios o todos los megagrupos seleccionados.
- El selector de destinos de anuncios usa casillas, no un selector múltiple que resulta poco claro en móvil.
- Los hovers de insignias y roles se ajustan al ancho del viewport, envuelven texto largo y se colocan arriba o abajo según el espacio disponible.
- Al salir otro participante de una VC se reproduce un sonido distinto del tono de salida propio.
- Las sesiones de voz se conservan al cambiar entre MDs, vistas y megagrupos; solo se abandonan al salir explícitamente o entrar en otro canal de voz.
- `glow:` conserva los nombres CSS y hexadecimales admitidos desde hotfix2.

## Añadido y reforzado

- More Sounds: tonos distintos para entrar, salir, llegada y salida de participantes, controlados desde Configuración.
- MarkdownUI BETA: editor visual con vista previa y herramientas Markdown habituales.
- Los avisos globales tienen confirmación de lectura persistente por cuenta.

## Migración

`supabase/migrations/20261104_nexus_v0110_hotfix2_global_notice_reads_multi_delivery.sql` crea la tabla privada de lecturas y reitera la RPC protegida para avisos múltiples.

La migración no vuelve a enviar avisos antiguos.
