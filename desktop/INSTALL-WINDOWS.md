# Instalar Nexus Desktop en Windows

Esta guía es para los betatesters. **No necesitan Node.js, Rust, Visual Studio ni herramientas de desarrollo.** Esos programas solo se usan para compilar el instalador.

## Instalación

1. Descarga `Nexus-Desktop-Setup-v0.9.0-alpha.2.exe` desde la publicación oficial de Nexus.
2. Haz doble clic en el archivo.
3. Acepta la instalación para tu usuario de Windows. No hace falta seleccionar instalación para todo el equipo.
4. Si el ordenador no tiene Microsoft Edge WebView2 Runtime, el instalador incluye el bootstrapper de Microsoft e intentará instalarlo silenciosamente. En ese caso necesita conexión a Internet.
5. Abre Nexus Desktop desde el menú Inicio o el acceso directo creado por el instalador.
6. Inicia sesión con tu cuenta habitual de Nexus.

## Qué instala

- La aplicación Nexus Desktop.
- Acceso directo en el menú Inicio, dentro de la carpeta Nexus.
- Acceso directo de escritorio según las opciones del instalador.
- El bootstrapper de WebView2, que solo se ejecuta si el runtime no está disponible.

La instalación es por usuario y normalmente no requiere permisos de administrador. Nexus sigue necesitando conexión a Internet porque carga la web de Nexus y utiliza Supabase.

## Aviso de Windows SmartScreen

Las versiones beta pueden no estar firmadas digitalmente. Windows puede mostrar una advertencia de editor desconocido. Comprueba que has descargado el instalador desde la publicación oficial compartida por el equipo Nexus. No ejecutes copias de origen desconocido.

## Desinstalar

Ve a **Configuración de Windows → Aplicaciones → Aplicaciones instaladas → Nexus Desktop → Desinstalar**. La desinstalación elimina la aplicación, pero no borra tu cuenta ni tus conversaciones de Supabase.
