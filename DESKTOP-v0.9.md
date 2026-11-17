# Nexus Desktop · 0.9.0-alpha.2

Nexus Desktop utiliza Tauri 2 para presentar la web de Nexus en una ventana nativa con barra de título propia. Esta alpha añade un instalador NSIS de Windows preparado para los betatesters: incluye el bootstrapper de WebView2, usa instalación por usuario y añade identidad visual propia en el asistente de instalación.

Los betatesters solo necesitan descargar y ejecutar `Nexus-Desktop-Setup-v0.9.0-alpha.2.exe`; no necesitan instalar Rust, Node, Visual Studio ni NSIS. Si WebView2 falta, el instalador intenta instalarlo silenciosamente y requiere Internet para descargar el runtime.

Consulta `desktop/INSTALL-WINDOWS.md` para instalarlo y `desktop/README-DESKTOP.md` para compilarlo localmente o con GitHub Actions.

Estado: código fuente y configuración de empaquetado preparados. Este paquete no contiene un ejecutable `.exe` ya compilado ni firmado; la generación del instalador necesita un runner Windows, que se puede proporcionar mediante GitHub Actions.
