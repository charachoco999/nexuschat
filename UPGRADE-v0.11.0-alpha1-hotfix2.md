# Actualizar Nexus v0.11.0-alpha1-hotfix1 → hotfix2

Esta actualización continúa la rama web/móvil 0.11. No cambia Desktop.

## Antes de empezar

1. Haz una copia del repositorio y una copia de seguridad de Supabase.
2. Comprueba que ya aplicaste la migración original de v0.11.0-alpha1 y la migración principal de v0.11.0-alpha1. La nueva migración de este hotfix incluye la RPC multi-megagrupo y el registro de lecturas globales; no necesitas ejecutar una migración intermedia adicional.
3. Conserva `assets/js/config.js`; no se incluye en el ZIP.

## Migración

Ejecuta una sola vez desde Supabase → SQL Editor:

`supabase/migrations/20261104_nexus_v0110_hotfix2_global_notice_reads_multi_delivery.sql`

Crea una tabla privada con las lecturas de avisos globales por cuenta y reitera la RPC administrativa para publicar avisos en uno, varios o todos los megagrupos con canales suscritos.

No vuelvas a ejecutar las migraciones previas si ya finalizaron correctamente.

## Publicar la web

1. Descomprime `nexus-chat-v0.11.0-alpha1-hotfix2-upgrade.zip`.
2. Sube el contenido de `nexus-chat/` a la raíz de GitHub Pages y acepta sustituir archivos.
3. Conserva `assets/js/config.js`.
4. Fuerza la recarga con `Ctrl + F5` en escritorio; en móvil cierra y vuelve a abrir Nexus.

## Pruebas recomendadas

1. Descarta un aviso global y cambia entre varios canales; no debe reaparecer. Inicia también sesión desde otro navegador y comprueba la lectura persistente.
2. Desde administración, marca varios megagrupos o la opción Todos. Comprueba que el aviso aparece como mensaje de Nexus (App) en cada canal suscrito de cada destino.
3. Entra en VC, cambia a MDs, amigos, otros megagrupos y vuelve; la llamada debe continuar activa en el dock.
4. Comprueba sonidos propios y de llegada/salida de participantes; desactívalos desde Configuración.
5. Pasa el cursor por insignias con nombres largos y comprueba que el texto no sobresale de la caja.
6. Prueba `{glow:white:...}`, `{glow:gold:...}` y `{glow:#ffffff:...}`.
7. Abre MarkdownUI, previsualiza y aplica negrita, cursiva, listas, citas, enlaces, spoilers y bloques de código.

## Límites conocidos

- More Sounds usa tonos sintetizados con Web Audio; el navegador puede requerir interacción previa para desbloquear audio.
- La continuidad de voz WebRTC debe probarse con varias cuentas y redes reales.
- MarkdownUI BETA cubre Markdown habitual; la vista previa es orientativa y saneada.
- La RPC de avisos envía un mensaje por cada canal no-voz con `important_announcements_enabled=true` dentro de cada comunidad destino.
