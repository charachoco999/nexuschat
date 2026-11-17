@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Falta Node.js. Instala una version LTS y vuelve a abrir esta ventana.& pause & exit /b 1)
where npm >nul 2>nul || (echo No se encuentra npm. Reinstala Node.js LTS.& pause & exit /b 1)
if not exist node_modules (
  echo Instalando las dependencias de Nexus Desktop...
  call npm install || (echo No se pudieron instalar las dependencias.& pause & exit /b 1)
)
call npm run tauri:dev
if errorlevel 1 pause
