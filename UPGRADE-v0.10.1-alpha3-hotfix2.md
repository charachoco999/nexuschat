# Actualizar Nexus v0.10.1-alpha3 → Hotfix 2

Esta actualización corrige el agrupado/scroll de mensajes y el modo compacto en móvil. También conserva y documenta las mejoras de emojis, VC y notas de voz WAV. No abre la rama 0.11 y no modifica Desktop.

## Antes de actualizar

1. Haz una copia del repositorio de GitHub.
2. Conserva `assets/js/config.js`. El paquete no contiene tus credenciales.
3. No es necesario ejecutar SQL ni cambiar los secretos de Supabase.

## Publicar la actualización

1. Descomprime `nexus-chat-v0.10.1-alpha3-hotfix2-upgrade.zip`.
2. Sube el contenido de la carpeta `nexus-chat/` a la raíz del repositorio de Nexus y acepta sustituir los archivos existentes.
3. Comprueba que `assets/js/config.js` sigue siendo tu archivo configurado y no lo sustituyas por `config.js.example`.
4. Espera a que GitHub Pages termine el despliegue. En escritorio fuerza la recarga con `Ctrl + F5`; en móvil cierra y vuelve a abrir la pestaña o la aplicación instalada.

## Pruebas recomendadas

1. Activa Compactar paneles en un móvil en vertical. Entra en un megagrupo, abre la lista de canales, entra en uno y vuelve atrás.
2. Envía varios mensajes consecutivos con placa y BoxGlow. Añade reacciones, edita un mensaje y comprueba que los efectos siguen presentes.
3. Mantén el historial desplazado hacia arriba mientras llegan mensajes nuevos y comprueba que Nexus no te mueve de sitio.
4. Abre el selector de emojis, busca `corazon` o `gato` y prueba `:corazon:` y `:pulgar_arriba:` en el compositor.
5. Conecta dos cuentas a un canal de voz y prueba la cancelación básica de eco/ruido en **Configuración → Optimizaciones**. Puede depender del soporte del navegador y del dispositivo.
6. Graba una nota de voz desde Android y otra desde iOS. Ambas deben guardarse como WAV PCM mono a 16 kHz y poder reproducirse en el otro dispositivo.

## Formato de audio

Las notas grabadas desde el botón **Audio** del compositor se convierten a WAV PCM mono a 16 kHz antes de subirse. Esto evita que una nota nueva dependa de que un dispositivo produzca WebM y otro MP4. Los audios antiguos y los archivos de audio que se adjunten manualmente conservan el formato original.

La grabación usa Web Audio y requiere permiso de micrófono, un contexto seguro HTTPS y soporte de `AudioContext`/`createScriptProcessor`. El límite es de 15 minutos y las subidas mantienen el máximo de 50 MB.

## Limitaciones

Esta beta ha pasado comprobaciones estáticas y validación del encabezado WAV, pero no se ha probado contra tu instancia Supabase ni en dispositivos físicos Android/iOS. La cancelación de ruido depende de las funciones que implemente el navegador; Nexus solicita los controles estándar `echoCancellation`, `noiseSuppression` y `autoGainControl`, pero no puede garantizar el mismo resultado en todos los equipos.
