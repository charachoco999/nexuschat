@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  NEXUS DESKTOP - WINDOWS BUILDER
 echo =================================
echo.

where node >nul 2>nul || (echo [ERROR] Falta Node.js LTS. & echo Instala Node.js 22 LTS y vuelve a ejecutar este archivo. & pause & exit /b 1)
where npm >nul 2>nul || (echo [ERROR] No se encuentra npm. Reinstala Node.js LTS. & pause & exit /b 1)
where cargo >nul 2>nul || (echo [ERROR] Falta Rust. Instala Rust con rustup. & pause & exit /b 1)
if "%TAURI_SIGNING_PRIVATE_KEY%"=="" (
  echo [ERROR] Falta TAURI_SIGNING_PRIVATE_KEY. El actualizador necesita firmar los paquetes.
  echo Configura la variable con la ruta o el contenido de tu clave privada.
  echo Consulta README-DESKTOP.md antes de continuar.
  pause
  exit /b 1
)
where cl >nul 2>nul || echo [AVISO] No se detecta cl.exe en PATH. Abre "Developer Command Prompt for VS" si la compilacion falla.
where makensis >nul 2>nul || echo [AVISO] No se detecta NSIS. Instala NSIS o usa el workflow de GitHub Actions incluido.

for /f "delims=" %%V in ('node -p "require('./package.json').version"') do set APP_VERSION=%%V
if not defined APP_VERSION set APP_VERSION=0.9.0-alpha.3

if not exist node_modules (
  echo [1/3] Instalando dependencias JS...
  call npm install --no-audit --no-fund || (echo [ERROR] npm install fallo. & pause & exit /b 1)
) else (
  echo [1/3] Dependencias JS ya presentes.
)

echo.
echo [2/3] Compilando Nexus Desktop y el instalador NSIS...
call npm run build:windows
if errorlevel 1 (
  echo.
  echo [ERROR] La compilacion fallo. Consulta README-DESKTOP.md.
  pause
  exit /b 1
)

echo.
echo [3/3] Copiando el instalador a dist-installers...
set "OUTDIR=%~dp0dist-installers"
if not exist "%OUTDIR%" mkdir "%OUTDIR%"
set "FOUND=0"
for %%F in ("%~dp0src-tauri\target\release\bundle\nsis\*.exe") do (
  if exist "%%~fF" (
    copy /Y "%%~fF" "%OUTDIR%\Nexus-Desktop-Setup-v%APP_VERSION%.exe" >nul
    set "FOUND=1"
  )
)
if "%FOUND%"=="0" (
  echo [ERROR] Tauri no ha generado el .exe esperado.
  pause
  exit /b 1
)
echo.
echo [OK] Instalador generado:
echo %OUTDIR%\Nexus-Desktop-Setup-v%APP_VERSION%.exe
echo.
echo El instalador es por usuario y no requiere permisos de administrador.
echo Si WebView2 falta, el instalador integrado intentara descargarlo silenciosamente.
pause
