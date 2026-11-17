# Nexus Desktop · 0.9.0-alpha.2

Aplicación de escritorio de Nexus construida con Tauri 2. Carga la web oficial dentro de una ventana nativa con barra de título propia. No mantiene una segunda copia del chat ni incorpora credenciales de Supabase.

## Qué cambia en Alpha 2

- El instalador de Windows utiliza NSIS.
- WebView2 usa `embedBootstrapper`: el bootstrapper de Microsoft queda incluido en el instalador (aprox. 1,8 MB adicionales) y se ejecuta silenciosamente solo cuando falta el runtime.
- La instalación se configura para el usuario actual, sin requerir elevación de administrador para la aplicación.
- Carpeta de menú Inicio `Nexus`.
- Recursos visuales personalizados del instalador y desinstalador.
- Selector de idioma oculto: usa el idioma del sistema cuando está disponible, con español e inglés incluidos.
- Se incluye un workflow de GitHub Actions para generar el instalador en Windows sin instalar Rust/Visual Studio en el equipo del desarrollador local.

## Arquitectura

La ventana muestra la URL definida en `ui/config.js`. Por eso comparte las cuentas, mensajes, comunidades y los cambios publicados en la web. La sesión de Desktop es independiente de la sesión del navegador normal. Se necesita Internet para usar Nexus.

Edita `ui/config.js` para elegir la URL de beta. Debe ser HTTPS. Si cambias el dominio, actualiza también `frame-src` en `src-tauri/tauri.conf.json`.

## Instalador: qué necesita el betatester

El betatester solo necesita Windows y el archivo `Nexus-Desktop-Setup-v0.9.0-alpha.2.exe`.

- No necesita Node.js, npm, Rust, Cargo, Visual Studio, C++ Build Tools ni NSIS.
- Si WebView2 ya está instalado (lo habitual en Windows 10/11), el instalador no vuelve a instalarlo.
- Si falta WebView2, el bootstrapper integrado lo descarga e instala silenciosamente. Para ese paso se necesita Internet.
- La instalación se hace en el perfil del usuario actual y no exige permisos de administrador en condiciones normales.
- Al desinstalar Nexus Desktop no se borran cuentas ni datos de Supabase.

La aplicación en sí también necesita Internet porque carga la web alojada de Nexus.

## Crear el instalador en tu propio Windows

Requisitos del equipo que compila, no del betatester:

1. Windows 10/11 de 64 bits.
2. Node.js 22 LTS.
3. Rust estable con el target `x86_64-pc-windows-msvc`.
4. Microsoft C++ Build Tools / Visual Studio Build Tools con la carga de trabajo **Desarrollo para el escritorio con C++**.
5. NSIS.

Abre una terminal de desarrollador de Visual Studio y ejecuta `build-windows.bat`. El script genera el `.exe` en `dist-installers/` además del resultado original de Tauri en `src-tauri/target/release/bundle/nsis/`.

## Generar el instalador con GitHub Actions

El workflow está en `../.github/workflows/nexus-desktop-windows.yml` (en el ZIP combinado, dentro de la raíz del repositorio). Sube el proyecto a GitHub y ejecuta **Actions → Build Nexus Desktop Windows → Run workflow**. El workflow instala NSIS, compila en `windows-latest` y publica el instalador como artifact descargable.

También se activa al modificar archivos de `desktop/` o el propio workflow.

## Tauri y WebView2

Configuración oficial:

- `bundle.windows.webviewInstallMode.type`: `embedBootstrapper`.
- `bundle.windows.webviewInstallMode.silent`: `true`.
- `bundle.windows.nsis.installMode`: `currentUser`.
- `bundle.windows.nsis.startMenuFolder`: `Nexus`.

`embedBootstrapper` añade aproximadamente 1,8 MB al instalador y requiere Internet si debe instalar el runtime. Para equipos completamente desconectados se necesitaría `offlineInstaller`, que aumenta el tamaño del instalador unos 127 MB; no se usa en esta beta para no distribuir un instalador innecesariamente enorme.

## Seguridad y limitaciones

- `ui/config.js` solo contiene una URL pública y metadatos de versión.
- No se incluyen claves privadas ni contraseñas de Supabase.
- La ventana carga el contenido remoto desde HTTPS y la CSP limita el dominio del iframe.
- La alpha todavía no incorpora integraciones nativas específicas para bandeja del sistema ni notificaciones nativas.
- No está firmada con certificado de editor. SmartScreen puede mostrar una advertencia de editor desconocido.
- Micrófono, voz, ventanas emergentes y enlaces externos deben validarse en equipos reales con WebView2.

## Archivos principales

- `ui/index.html`, `ui/desktop.css`, `ui/desktop.js`: interfaz de escritorio.
- `ui/config.js`: URL de la web y etiqueta de versión.
- `src-tauri/tauri.conf.json`: ventana, CSP e instalador NSIS.
- `src-tauri/icons/installer-header.bmp` y `installer-sidebar.bmp`: marca visual del instalador.
- `build-windows.bat`: compilación local.
- `INSTALL-WINDOWS.md`: guía breve para betatesters.
