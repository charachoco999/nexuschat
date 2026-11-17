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

  // Los controles nativos solo existen dentro de Tauri; la vista web puede usarse como maqueta.
  const tauriApi = window.__TAURI__;
  if (tauriApi?.window?.getCurrentWindow) {
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
