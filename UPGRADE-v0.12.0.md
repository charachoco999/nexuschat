# Actualizar Nexus v0.11.1-alpha2 → v0.12.0

Esta entrega amplía la localización de la interfaz. No modifica la base de datos, las condiciones legales aceptadas ni la configuración de Supabase.

## Antes de publicar

1. Haz una copia de seguridad del repositorio.
2. Comprueba que tu instalación es Nexus v0.11.1-alpha2.
3. **Conserva `assets/js/config.js`**. El paquete no incluye ni sustituye ese archivo.

## Publicar en GitHub Pages

1. Descomprime `nexus-chat-v0.12.0-localization-upgrade.zip`.
2. Entra en la carpeta `nexus-chat/` del ZIP.
3. Sube su contenido a la raíz del repositorio de GitHub Pages y acepta reemplazar los archivos existentes.
4. No borres ni sustituyas `assets/js/config.js`.
5. Espera a que GitHub Pages termine el despliegue y recarga con `Ctrl + F5`. En móvil, cierra la pestaña o la aplicación instalada y vuelve a abrirla.

## Base de datos y condiciones

- No ejecutes SQL para esta actualización.
- No es necesario cambiar secretos ni claves de Supabase.
- La versión y huella de las condiciones legales no cambian; no se solicita una nueva aceptación por este paquete.
- El documento legal oficial sigue en español. El selector de idioma afecta a la interfaz, no al contenido legal aceptado.

## Idiomas incluidos

Inglés, esloveno, italiano, francés, japonés, chino simplificado, alemán, portugués europeo, guaraní (beta), catalán, gallego, euskera, latín (beta) y español Julio Verne, además del español fuente. Consulta `LANGUAGES-v0.12.0.md`.

## Pruebas recomendadas

1. Antes de iniciar sesión, cambia entre español, inglés, catalán, japonés y chino simplificado.
2. Inicia sesión y comprueba que el idioma se conserva desde el perfil.
3. En Configuración, cambia de idioma y comprueba los paneles, menús, formularios, tooltips y diálogos.
4. Abre la ventana de novedades v0.12.0 y la ventana de aceptación de condiciones.
5. Comprueba que los mensajes, biografías y contenido de usuarios siguen en su idioma original.
6. Verifica que la página legal continúa mostrando el documento oficial en español.

## Comprobación local

Desde la raíz de `nexus-chat/`, ejecuta:

```bash
node scripts/check-i18n.mjs
```

El resultado esperado es 893 claves, 14 idiomas destino, 12.502 traducciones no vacías, cero huecos y cero nuevas cadenas estáticas sin traducir. Las 23 excepciones registradas son deliberadas (marca, nombres propios de funciones, ejemplos de código y datos de demostración).

La auditoría es estática. Guaraní y latín siguen en beta y las pantallas deben revisarse visualmente en escritorio y móvil.
