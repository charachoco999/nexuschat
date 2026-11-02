import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

(() => {
  'use strict';

  const config = window.NEXUS_DESKTOP_CONFIG || {};
  const appUrl = String(config.webUrl || '').trim();
  const frame = document.getElementById('nexus-webview');
  const loading = document.getElementById('loading-screen');
  const error = document.getElementById('error-screen');
  const statusText = document.getElementById('status-text');
  const connectionLabel = document.getElementById('connection-label');
  const shell = document.querySelector('.window-frame');

  let loadTimer = 0;
  let loaded = false;
  let availableUpdate = null;
  let updateBusy = false;
  let isTauriApp = false;

  const updaterButton = document.getElementById('updater-open');
  const updaterOverlay = document.getElementById('update-overlay');
  const updateSummary = document.getElementById('update-summary');
  const updateCheckButton = document.getElementById('update-check');
  const updateInstallButton = document.getElementById('update-install');
  const updateIndicator = document.getElementById('update-indicator');
  document.getElementById('installed-version').textContent = config.version || 'Beta';
  document.getElementById('available-version').textContent = config.version || '—';

  function validWebUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function setLoading() {
    loaded = false;
    error.classList.add('hidden');
    loading.classList.remove('hidden');
    connectionLabel.textContent = 'Conectando con tu espacio';
    statusText.textContent = `Nexus Desktop · ${config.version || 'Beta'}`;
    window.clearTimeout(loadTimer);
    loadTimer = window.setTimeout(() => {
      if (!loaded) {
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        connectionLabel.textContent = 'Esperando conexión';
        statusText.textContent = 'No se pudo establecer conexión';
      }
    }, 16000);
  }

  function loadNexus() {
    if (!validWebUrl(appUrl)) {
      loading.classList.add('hidden');
      error.classList.remove('hidden');
      connectionLabel.textContent = 'Dirección no válida';
      statusText.textContent = 'Revisa desktop/ui/config.js';
      return;
    }
    setLoading();
    // La URL se configura como HTTPS para no cargar una página arbitraria o insegura.
    frame.src = appUrl;
  }

  frame.addEventListener('load', () => {
    loaded = true;
    window.clearTimeout(loadTimer);
    loading.classList.add('hidden');
    error.classList.add('hidden');
    connectionLabel.textContent = 'Vista web cargada';
    statusText.textContent = `Nexus Desktop · ${config.version || 'Beta'}`;
  });

  document.getElementById('reload-app').addEventListener('click', loadNexus);
  document.getElementById('retry-app').addEventListener('click', loadNexus);

  // Centro de actualizaciones: solo funciona dentro de la aplicación nativa.
  function openUpdater() {
    updaterOverlay.classList.remove('hidden');
    updaterOverlay.setAttribute('aria-hidden', 'false');
  }
  function closeUpdater() {
    updaterOverlay.classList.add('hidden');
    updaterOverlay.setAttribute('aria-hidden', 'true');
  }
  function setUpdaterStatus(title, message, footnote = '') {
    document.getElementById('update-title').textContent = title;
    updateSummary.textContent = message;
    if (footnote) document.getElementById('update-footnote').textContent = footnote;
  }
  function showUpdate(update) {
    availableUpdate = update;
    document.getElementById('available-version').textContent = update.version;
    const notes = String(update.body || update.notes || '').trim();
    document.getElementById('update-notes').textContent = notes || 'Esta versión incluye mejoras y correcciones para Nexus Desktop.';
    document.getElementById('update-notes-wrap').classList.remove('hidden');
    updateIndicator.hidden = false;
    updateInstallButton.disabled = false;
    setUpdaterStatus('Hay una actualización', `Nexus Desktop ${update.version} está lista para descargarse.`, 'La descarga se verifica con la firma digital de Nexus.');
  }
  async function checkForUpdates({ silent = false } = {}) {
    if (!isTauriApp || updateBusy) return;
    updateBusy = true;
    updateCheckButton.disabled = true;
    updateInstallButton.disabled = true;
    setUpdaterStatus('Buscando actualizaciones', 'Conectando con el servidor de versiones de Nexus…');
    try {
      const update = await check({ timeout: 20000 });
      if (update) {
        if (availableUpdate && availableUpdate !== update) {
          try { await availableUpdate.close(); } catch { /* el recurso anterior puede haberse cerrado */ }
        }
        showUpdate(update);
        if (!silent) openUpdater();
      } else {
        if (availableUpdate) {
          try { await availableUpdate.close(); } catch { /* el recurso puede haberse cerrado */ }
        }
        availableUpdate = null;
        updateIndicator.hidden = true;
        document.getElementById('available-version').textContent = config.version || 'Actual';
        document.getElementById('update-notes-wrap').classList.add('hidden');
        setUpdaterStatus('Ya tienes la última versión', 'Nexus Desktop está actualizado.', 'La comprobación se realiza contra las versiones oficiales publicadas en GitHub.');
        if (!silent) openUpdater();
      }
    } catch (error) {
      console.error('No se pudieron comprobar las actualizaciones:', error);
      setUpdaterStatus('No se pudo comprobar', 'No ha sido posible conectar con el servidor de actualizaciones.', 'Comprueba tu conexión y vuelve a intentarlo.');
      if (!silent) openUpdater();
    } finally {
      updateBusy = false;
      updateCheckButton.disabled = false;
      updateInstallButton.disabled = !availableUpdate;
    }
  }
  async function installAvailableUpdate() {
    if (!availableUpdate || updateBusy) return;
    updateBusy = true;
    updateCheckButton.disabled = true;
    updateInstallButton.disabled = true;
    const progressWrap = document.getElementById('update-progress-wrap');
    const progressLabel = document.getElementById('update-progress-label');
    const progressValue = document.getElementById('update-progress-value');
    const progressBar = document.getElementById('update-progress-bar');
    progressWrap.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressValue.textContent = '0%';
    setUpdaterStatus('Descargando actualización', `Preparando Nexus Desktop ${availableUpdate.version}…`, 'No cierres la aplicación mientras se descarga e instala la actualización.');
    let downloaded = 0;
    let total = 0;
    try {
      await availableUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength || 0;
          progressLabel.textContent = total ? 'Descargando archivos…' : 'Descargando actualización…';
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (total > 0) {
            const percent = Math.min(100, Math.round(downloaded / total * 100));
            progressBar.style.width = `${percent}%`;
            progressValue.textContent = `${percent}%`;
          } else {
            progressBar.classList.add('indeterminate');
            progressValue.textContent = '…';
          }
        } else if (event.event === 'Finished') {
          progressBar.style.width = '100%';
          progressValue.textContent = '100%';
          progressLabel.textContent = 'Instalando actualización…';
        }
      });
      setUpdaterStatus('Actualización instalada', 'Nexus Desktop se va a reiniciar para aplicar los cambios.', 'La aplicación volverá a abrirse con la versión nueva.');
      progressLabel.textContent = 'Reiniciando Nexus…';
      await relaunch();
    } catch (error) {
      console.error('Falló la instalación de la actualización:', error);
      setUpdaterStatus('No se pudo instalar', 'La actualización no se ha podido completar. Tu instalación actual se mantiene.', 'Comprueba tu conexión e inténtalo de nuevo más tarde.');
      updateInstallButton.disabled = false;
      updateCheckButton.disabled = false;
      updateBusy = false;
    }
  }

  document.getElementById('update-close').addEventListener('click', closeUpdater);
  document.querySelectorAll('[data-close-updater]').forEach(node => node.addEventListener('click', closeUpdater));
  updateCheckButton.addEventListener('click', () => checkForUpdates({ silent: false }));
  updateInstallButton.addEventListener('click', installAvailableUpdate);
  updaterButton.addEventListener('click', openUpdater);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeUpdater(); });

  // Los controles nativos solo existen dentro de Tauri; la vista web puede usarse como maqueta.
  const tauriApi = window.__TAURI__;
  if (tauriApi?.window?.getCurrentWindow) {
    isTauriApp = true;
    updaterButton.hidden = false;
    document.body.classList.add('is-tauri-app');
    const currentWindow = tauriApi.window.getCurrentWindow();
    const minimizeButton = document.getElementById('window-minimize');
    const maximizeButton = document.getElementById('window-maximize');
    const closeButton = document.getElementById('window-close');

    minimizeButton.addEventListener('click', () => currentWindow.minimize());
    maximizeButton.addEventListener('click', async () => {
      await currentWindow.toggleMaximize();
      await syncMaximizeState();
    });
    closeButton.addEventListener('click', () => currentWindow.close());

    async function syncMaximizeState() {
      try {
        shell.classList.toggle('is-maximized', await currentWindow.isMaximized());
      } catch (err) {
        console.debug('No se pudo consultar el estado de la ventana:', err);
      }
    }

    syncMaximizeState();
    // Comprueba en segundo plano al abrir. Si hay una versión nueva, marca el botón.
    window.setTimeout(() => checkForUpdates({ silent: true }), 2800);
    window.addEventListener('resize', syncMaximizeState, { passive: true });
    document.querySelector('.titlebar').addEventListener('dblclick', async (event) => {
      if (event.target.closest('button')) return;
      await currentWindow.toggleMaximize();
      await syncMaximizeState();
    });
  } else {
    document.querySelectorAll('.window-button').forEach(button => button.hidden = true);
    document.querySelector('.actions-divider').hidden = true;
    connectionLabel.textContent = 'Vista previa del escritorio';
  }

  loadNexus();
})();
