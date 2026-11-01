/* Nexus front-end. The database rules in supabase/schema.sql are the security boundary. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const cfg = window.NEXUS_CONFIG || {};
  const hasConfig = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes('TU-PROYECTO') && !cfg.SUPABASE_ANON_KEY.includes('TU-PUBLISHABLE'));
  const client = hasConfig ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  let currentUser = null;
  let profile = null;
  let currentView = 'chats';
  let currentContext = null; // {type:'conversation'|'channel', id, title, subtitle, icon}
  let activeMessageChannel = null;
  let friendsRealtimeChannel = null;
  let inboxRealtimeChannel = null;
  let listRefreshTimer = null;
  const pendingListRefreshes = new Set();
  let replyTarget = null;
  let editingMessageId = null;
  let conversations = [];
  let showArchivedConversations = false;
  const renderingMessageIds = new Set();
  const renderedMessageIds = new Set();
  const REACTION_OPTIONS = ['👍','❤️','😂','😮','🎉','🔥','👀','🥳'];
  let currentCommunity = null;
  let currentCommunityChannels = [];
  let friendsCache = [];
  let isAdmin = false;
  let communityRoles = [];
  let communityMembers = [];
  let communityMemberRoles = [];
  let communityPermissions = {manage_roles:false,manage_badges:false,manage_messages:false,manage_channels:false,post_announcements:false};
  const messageIdentityCache = new Map();

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials = (value = '?') => String(value).trim().slice(0, 1).toUpperCase() || '?';
  const toast = (message, type = '') => {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    $('#toast-region').append(node);
    setTimeout(() => node.remove(), 4200);
  };
  const showError = (error, fallback = 'Ha ocurrido un error.') => {
    console.error(error);
    toast(error?.message || fallback, 'error');
  };
  const showAuthError = (error, fallback = 'No se pudo completar el acceso.') => {
    const message = String(error?.message || error?.code || '');
    const normalized = message.toLowerCase();
    console.error(error);
    if (normalized.includes('email rate limit exceeded') || normalized.includes('over_email_send_rate_limit')) {
      const friendly = 'Nexus ha alcanzado el límite temporal de correos de verificación de Supabase. No es un problema de tu contraseña. El equipo de Nexus debe configurar el envío de correo SMTP; inténtalo de nuevo cuando esté habilitado.';
      $('#auth-note').textContent = friendly;
      toast('Se ha alcanzado el límite de correos de registro. El administrador debe configurar SMTP.', 'error');
      return;
    }
    if (normalized.includes('email address not authorized') || normalized.includes('email_address_not_authorized')) {
      const friendly = 'El correo no está autorizado por el servicio de prueba de Supabase. El administrador debe configurar un proveedor SMTP para permitir registros públicos.';
      $('#auth-note').textContent = friendly;
      toast(friendly, 'error');
      return;
    }
    toast(error?.message || fallback, 'error');
  };
  const requireClient = () => {
    if (!client) {
      toast('Primero configura la URL y la clave pública de Supabase en assets/js/config.js.', 'error');
      return false;
    }
    return true;
  };
  const avatarStyle = (url) => {
    const safe = typeof url === 'string' && /^https:\/\//i.test(url) ? url : '';
    return safe ? `style="background-image:url('${escapeHtml(safe)}');color:transparent"` : '';
  };
  const avatarMarkup = (p, extra = '') => `<span class="avatar ${extra}" ${avatarStyle(p?.avatar_url)}>${p?.avatar_url ? '' : escapeHtml(initials(p?.nickname || p?.username || '?'))}</span>`;
  const dateLabel = value => {
    try { return new Date(value).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}); }
    catch { return ''; }
  };
  const showAuth = () => { $('#auth-screen').classList.remove('hidden'); $('#app-screen').classList.add('hidden'); };
  const showApp = () => { $('#auth-screen').classList.add('hidden'); $('#app-screen').classList.remove('hidden'); };

  // ---------- Authentication ----------
  let authMode = 'login';
  let authCaptchaToken = '';
  let authCaptchaWidget = null;
  let authCaptchaScriptLoading = false;
  let authCaptchaRequested = false;

  function renderAuthCaptcha() {
    const siteKey = String(cfg.TURNSTILE_SITE_KEY || '').trim();
    if (!siteKey) { $('#auth-captcha-wrap').classList.add('hidden'); return; }
    $('#auth-captcha-wrap').classList.remove('hidden');
    if (window.turnstile?.render) {
      if (authCaptchaWidget === null) {
        authCaptchaWidget = window.turnstile.render('#auth-captcha', {
          sitekey: siteKey,
          callback: token => { authCaptchaToken = token || ''; },
          'expired-callback': () => { authCaptchaToken = ''; },
          'error-callback': () => { authCaptchaToken = ''; toast('No se pudo completar la verificación de seguridad. Recarga el reto.', 'error'); }
        });
      }
      return;
    }
    if (authCaptchaScriptLoading) return;
    authCaptchaScriptLoading = true;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true; script.defer = true;
    script.onload = () => { authCaptchaScriptLoading = false; renderAuthCaptcha(); };
    script.onerror = () => { authCaptchaScriptLoading = false; toast('No se pudo cargar la verificación de seguridad.', 'error'); };
    document.head.append(script);
  }

  function resetAuthCaptcha() {
    authCaptchaToken = '';
    if (window.turnstile?.reset && authCaptchaWidget !== null) {
      try { window.turnstile.reset(authCaptchaWidget); } catch (error) { console.warn('No se pudo reiniciar Turnstile:',error); }
    }
  }

  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === 'signup';
    $('#auth-title').textContent = signup ? 'Crea tu cuenta' : 'Inicia sesión';
    $('#auth-subtitle').textContent = signup ? 'Tu próximo espacio empieza aquí.' : 'Vuelve a tus conversaciones.';
    $('#username-field').classList.toggle('hidden', !signup);
    $('#auth-username').required = signup;
    $('#auth-submit').textContent = signup ? 'Crear cuenta' : 'Entrar';
    $('#auth-toggle').textContent = signup ? 'Ya tengo una cuenta' : 'Crear cuenta';
    $('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';
    if (cfg.TURNSTILE_SITE_KEY) renderAuthCaptcha();
    else if (!authCaptchaRequested) $('#auth-captcha-wrap').classList.add('hidden');
  }

  if (cfg.TURNSTILE_SITE_KEY) renderAuthCaptcha();

  $('#auth-toggle').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'signup' : 'login'));
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!requireClient()) return;
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    const button = $('#auth-submit');
    button.disabled = true;
    try {
      if (cfg.TURNSTILE_SITE_KEY && !authCaptchaToken) { renderAuthCaptcha(); throw new Error('Completa primero la verificación de seguridad.'); }
      if (authMode === 'signup') {
        const username = $('#auth-username').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (username.length < 3) throw new Error('El usuario debe tener al menos 3 caracteres (letras, números o _).');
        const signupOptions = {data:{username}};
        if (cfg.TURNSTILE_SITE_KEY) signupOptions.captchaToken = authCaptchaToken;
        const { error } = await client.auth.signUp({email, password, options:signupOptions});
        if (error) throw error;
        toast('Cuenta creada. Revisa tu correo si Supabase exige confirmación.', 'success');
      } else {
        const signinCredentials = {email, password};
        if (cfg.TURNSTILE_SITE_KEY) signinCredentials.options = {captchaToken:authCaptchaToken};
        const { error } = await client.auth.signInWithPassword(signinCredentials);
        if (error) throw error;
      }
    } catch (error) { showAuthError(error, 'No se pudo completar el acceso.'); }
    finally { if (cfg.TURNSTILE_SITE_KEY) resetAuthCaptcha(); button.disabled = false; }
  });

  $('#forgot-password').addEventListener('click', async () => {
    if (!requireClient()) return;
    const email = $('#auth-email').value.trim();
    if (!email) { toast('Escribe primero tu correo electrónico.'); $('#auth-email').focus(); return; }
    try {
      if (cfg.TURNSTILE_SITE_KEY && !authCaptchaToken) { authCaptchaRequested = true; renderAuthCaptcha(); toast('Completa la verificación y vuelve a pulsar «He olvidado mi contraseña».'); return; }
      const redirectTo = `${location.origin}${location.pathname}`;
      const resetOptions = {redirectTo};
      if (cfg.TURNSTILE_SITE_KEY) resetOptions.captchaToken = authCaptchaToken;
      const { error } = await client.auth.resetPasswordForEmail(email, resetOptions);
      if (error) throw error;
      toast('Si la cuenta existe, recibirás un enlace de recuperación.', 'success');
    } catch (error) { showAuthError(error); }
    finally { if (cfg.TURNSTILE_SITE_KEY) resetAuthCaptcha(); }
  });

  $('#auth-note').textContent = hasConfig
    ? 'Tus datos se guardan en tu propio proyecto de Supabase.'
    : 'Antes de usar la plataforma, configura tu proyecto Supabase en assets/js/config.js. La guía está en README.md.';

  async function startApp(user) {
    currentUser = user;
    showApp();
    try {
      const {data, error} = await client.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      profile = data;
      renderIdentity();
      subscribeAccountRealtime();
      await loadInitialData();
      await consumePendingCommunityInvite();
    } catch (error) {
      showError(error, 'No se pudo cargar el perfil. Ejecuta primero supabase/schema.sql.');
    }
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    if (friendsRealtimeChannel) client.removeChannel(friendsRealtimeChannel);
    if (inboxRealtimeChannel) client.removeChannel(inboxRealtimeChannel);
    if (activeMessageChannel) client.removeChannel(activeMessageChannel);
    friendsRealtimeChannel = null; inboxRealtimeChannel = null; activeMessageChannel = null;
    if (listRefreshTimer) clearTimeout(listRefreshTimer);
    pendingListRefreshes.clear();
    currentUser = null; profile = null; currentContext = null; replyTarget = null;
    showAuth();
  }

  if (client) {
    client.auth.onAuthStateChange((event, session) => {
      if (session?.user && !currentUser) startApp(session.user);
      if (!session?.user) { currentUser = null; profile = null; showAuth(); }
    });
    client.auth.getSession().then(({data}) => data.session?.user ? startApp(data.session.user) : showAuth());
  } else showAuth();

  // ---------- Navigation and identity ----------
  function switchView(view) {
    currentView = view;
    $$('.view').forEach(node => node.classList.toggle('active', node.id === `view-${view}`));
    $$('[data-view]').forEach(node => node.classList.toggle('active', node.dataset.view === view));
    const labels = {
      chats:['Mensajes','Tus conversaciones, en un mismo lugar.','◫'],
      friends:['Amigos','Tu círculo de Nexus.','♧'],
      workshop:['Workshop','Presets creados por la comunidad.','✧'],
      profile:['Tu perfil','Tu identidad en Nexus.','●'],
      settings:['Configuración','Preferencias y administración.','⚙'],
      community:[currentCommunity?.name || 'Megagrupo','Canales y comunidad.','▦']
    };
    const [title, subtitle, icon] = labels[view] || labels.chats;
    $('#context-title').textContent = title;
    $('#context-subtitle').textContent = subtitle;
    $('#context-icon').textContent = icon;
    $('#sidebar-community').classList.toggle('hidden', !currentCommunity || !['community','chats'].includes(view));
    if (view === 'profile') { fillProfileForm(); renderProfileWidgets(); fillCommunityNickname(); }
    if (view === 'settings') fillSettingsForm();
  }
  $$('[data-view]').forEach(node => node.addEventListener('click', () => switchView(node.dataset.view)));
  $('#rail-profile').addEventListener('click', () => switchView('profile'));
  $('#open-profile').addEventListener('click', () => switchView('profile'));
  $('#top-profile').addEventListener('click', () => switchView('profile'));
  $('#open-settings').addEventListener('click', () => switchView('settings'));
  $('#logout-button').addEventListener('click', signOut);
  $('#global-search').addEventListener('click', () => addFriendFlow());

  function renderIdentity() {
    const username = profile?.nickname || profile?.username || currentUser?.email?.split('@')[0] || 'Usuario';
    $('#sidebar-username').textContent = username;
    $('#sidebar-handle').textContent = `@${profile?.username || 'usuario'}`;
    $('#sidebar-avatar').style.backgroundImage = profile?.avatar_url ? `url('${profile.avatar_url}')` : '';
    $('#sidebar-avatar').textContent = profile?.avatar_url ? '' : initials(username);
    $('#rail-avatar').style.backgroundImage = profile?.avatar_url ? `url('${profile.avatar_url}')` : '';
    $('#rail-avatar').textContent = profile?.avatar_url ? '' : initials(username);
    if (/^#[0-9a-f]{6}$/i.test(profile?.settings?.accent || '')) document.documentElement.style.setProperty('--accent', profile.settings.accent);
    if (/^https:\/\//i.test(profile?.settings?.background || '')) document.body.style.backgroundImage = `url('${profile.settings.background}')`;
  }

  async function loadInitialData() {
    await Promise.allSettled([loadConversations(), loadFriends(), loadCommunities(), checkAdmin()]);
    if (location.hash.includes('access_token') || location.hash.includes('type=recovery')) {
      const password = prompt('Escribe tu nueva contraseña (mínimo 8 caracteres):');
      if (password && password.length >= 8) {
        const {error} = await client.auth.updateUser({password});
        if (error) showError(error); else toast('Contraseña actualizada.', 'success');
      }
      history.replaceState(null, '', location.pathname);
    }
  }

  // ---------- Prompt dialog ----------
  function ask(title, description, label, placeholder = '', initial = '') {
    return new Promise(resolve => {
      const dialog = $('#prompt-dialog');
      $('#prompt-title').textContent = title;
      $('#prompt-description').textContent = description || '';
      $('#prompt-field-label').querySelector('span').textContent = label;
      $('#prompt-input').placeholder = placeholder;
      $('#prompt-input').value = initial;
      const onClose = () => {
        dialog.removeEventListener('close', onClose);
        resolve(dialog.returnValue === 'default' ? $('#prompt-input').value.trim() : null);
      };
      dialog.addEventListener('close', onClose);
      dialog.showModal();
      setTimeout(() => $('#prompt-input').focus(), 40);
    });
  }

  // ---------- Realtime inbox and friends ----------
  function scheduleAccountListRefresh(kind) {
    pendingListRefreshes.add(kind);
    if (listRefreshTimer) clearTimeout(listRefreshTimer);
    listRefreshTimer = setTimeout(async () => {
      listRefreshTimer = null;
      const pending = new Set(pendingListRefreshes);
      pendingListRefreshes.clear();
      try {
        if (pending.has('friends') || pending.has('all')) await loadFriends();
        if (pending.has('conversations') || pending.has('all')) await loadConversations();
      } catch (error) { console.warn('No se pudo actualizar la bandeja en tiempo real:', error); }
    }, 180);
  }

  function subscribeAccountRealtime() {
    if (!client || !currentUser) return;
    if (friendsRealtimeChannel) client.removeChannel(friendsRealtimeChannel);
    if (inboxRealtimeChannel) client.removeChannel(inboxRealtimeChannel);

    friendsRealtimeChannel = client.channel(`nexus-friends-${currentUser.id}`)
      .on('postgres_changes', {event:'*', schema:'public', table:'friends'}, () => scheduleAccountListRefresh('friends'))
      .subscribe();

    inboxRealtimeChannel = client.channel(`nexus-inbox-${currentUser.id}`)
      .on('postgres_changes', {event:'*', schema:'public', table:'conversation_members', filter:`user_id=eq.${currentUser.id}`}, () => scheduleAccountListRefresh('conversations'))
      .on('postgres_changes', {event:'*', schema:'public', table:'conversations'}, () => scheduleAccountListRefresh('conversations'))
      .subscribe();
  }

  // ---------- Conversations and realtime messages ----------
  async function loadConversations() {
    if (!currentUser) return;
    const {data: memberships, error: memberError} = await client.from('conversation_members')
      .select('conversation_id,personal_name,hidden_at')
      .eq('user_id', currentUser.id);
    if (memberError) throw memberError;
    const ids = [...new Set((memberships || []).map(row => row.conversation_id))];
    if (!ids.length) {
      conversations = [];
      renderConversationList();
      return;
    }
    const {data: rows, error} = await client.from('conversations').select('*').in('id', ids).order('updated_at', {ascending:false});
    if (error) throw error;
    const {data: participants, error: participantError} = await client.from('conversation_members')
      .select('conversation_id,user_id,personal_name,hidden_at').in('conversation_id', ids);
    if (participantError) throw participantError;
    const otherIds = [...new Set((participants || []).filter(m => m.user_id !== currentUser.id).map(m => m.user_id))];
    const otherProfiles = await fetchProfiles(otherIds);
    conversations = (rows || []).map(row => {
      const members = (participants || []).filter(member => member.conversation_id === row.id);
      const other = members.find(member => member.user_id !== currentUser.id);
      const otherProfile = other ? otherProfiles[other.user_id] : null;
      const mine = members.find(member => member.user_id === currentUser.id);
      const title = mine?.personal_name || row.title || (row.kind === 'direct' ? (otherProfile?.nickname || otherProfile?.username || 'Mensaje directo') : 'Grupo sin nombre');
      const avatar = row.icon_url || (row.kind === 'direct' ? otherProfile?.avatar_url : null);
      return {...row, displayTitle:title, displayAvatar:avatar, hidden_at:mine?.hidden_at || null};
    });
    renderConversationList();
  }

  function renderConversationList() {
    const visible = conversations.filter(row => showArchivedConversations ? Boolean(row.hidden_at) : !row.hidden_at);
    const archivedCount = conversations.filter(row => row.hidden_at).length;
    $('#dm-count').textContent = conversations.filter(row => !row.hidden_at).length || '';
    const toggle = $('#toggle-archived-conversations');
    if (toggle) {
      toggle.textContent = showArchivedConversations ? 'Volver' : `Archivadas${archivedCount ? ` (${archivedCount})` : ''}`;
      toggle.setAttribute('aria-pressed', String(showArchivedConversations));
    }
    if (!visible.length) {
      $('#conversation-list').innerHTML = showArchivedConversations
        ? '<div class="empty-state compact">No tienes conversaciones archivadas.</div>'
        : '<div class="empty-state compact">Todavía no tienes conversaciones.<br>Empieza añadiendo amigos.</div>';
      return;
    }
    $('#conversation-list').innerHTML = visible.map(row => `
      <div class="conversation-row">
        <button class="conversation-item ${currentContext?.id === row.id ? 'active' : ''}" data-conversation="${row.id}">
          <span class="avatar" ${avatarStyle(row.displayAvatar)}>${row.displayAvatar ? '' : escapeHtml(initials(row.displayTitle))}</span>
          <span class="conversation-copy"><strong>${escapeHtml(row.displayTitle)}</strong><small>${row.kind === 'direct' ? 'Mensaje directo' : 'Grupo'}${row.hidden_at ? ' · Archivada' : ''}</small></span>
        </button>
        <div class="conversation-actions">
          <button type="button" data-hide-conversation="${row.id}" title="${row.hidden_at ? 'Restaurar conversación' : 'Archivar conversación'}">${row.hidden_at ? '↥' : '⌑'}</button>
          ${row.kind === 'group' ? `<button type="button" data-leave-conversation="${row.id}" title="Salir del grupo">×</button>` : ''}
        </div>
      </div>`).join('');
    $$('[data-conversation]').forEach(button => button.addEventListener('click', () => {
      const row = conversations.find(item => item.id === button.dataset.conversation);
      if (row) openConversation(row);
    }));
    $$('[data-hide-conversation]').forEach(button => button.addEventListener('click', () => toggleConversationHidden(button.dataset.hideConversation)));
    $$('[data-leave-conversation]').forEach(button => button.addEventListener('click', () => leaveConversation(button.dataset.leaveConversation)));
  }

  $('#toggle-archived-conversations').addEventListener('click', () => {
    showArchivedConversations = !showArchivedConversations;
    renderConversationList();
  });

  async function toggleConversationHidden(conversationId) {
    const row = conversations.find(item => item.id === conversationId);
    if (!row) return;
    const nextHiddenAt = row.hidden_at ? null : new Date().toISOString();
    const {error} = await client.from('conversation_members').update({hidden_at:nextHiddenAt})
      .eq('conversation_id', conversationId).eq('user_id', currentUser.id);
    if (error) { showError(error, 'No se pudo actualizar la conversación. Ejecuta la migración v0.5.'); return; }
    await loadConversations();
    toast(nextHiddenAt ? 'Conversación archivada.' : 'Conversación restaurada.', 'success');
    if (currentContext?.id === conversationId && nextHiddenAt) resetConversationPanel();
  }

  async function leaveConversation(conversationId) {
    const row = conversations.find(item => item.id === conversationId);
    if (!row) return;
    const confirmed = confirm(`¿Salir de «${row.displayTitle}»? Los demás participantes conservarán la conversación y sus mensajes.`);
    if (!confirmed) return;
    const {error} = await client.rpc('leave_conversation', {p_conversation_id:conversationId});
    if (error) { showError(error, 'No se pudo eliminar la conversación. Ejecuta la migración v0.5.'); return; }
    if (currentContext?.id === conversationId) resetConversationPanel();
    await loadConversations();
    toast('Has salido del grupo.', 'success');
  }

  function resetConversationPanel() {
    currentContext = null;
    replyTarget = null;
    if (activeMessageChannel) client.removeChannel(activeMessageChannel);
    activeMessageChannel = null;
    const pane = $('#conversation-panel');
    pane.style.backgroundImage = '';
    pane.innerHTML = `<div class="welcome-state"><div class="welcome-orb">N</div><p class="eyebrow">BIENVENIDO A NEXUS</p><h2>Tu gente, tus espacios.</h2><p>Abre una conversación o crea una nueva para empezar.</p><button class="button button-primary" id="welcome-new-chat">Nueva conversación</button></div>`;
    $('#welcome-new-chat').addEventListener('click', createNewChat);
    renderConversationList();
  }
  async function openConversation(row) {
    replyTarget = null;
    if (row.hidden_at) {
      const {error} = await client.from('conversation_members').update({hidden_at:null})
        .eq('conversation_id', row.id).eq('user_id', currentUser.id);
      if (error) { showError(error, 'No se pudo restaurar la conversación.'); return; }
      row.hidden_at = null;
      showArchivedConversations = false;
      renderConversationList();
    }
    currentContext = {type:'conversation', id:row.id, title:row.displayTitle, subtitle:row.kind === 'direct' ? 'Mensaje directo' : 'Chat grupal', icon:row.displayAvatar};
    switchView('chats');
    await showMessagePanel();
    await loadMessages();
    subscribeMessages();
    $$('.conversation-item').forEach(button => button.classList.toggle('active', button.dataset.conversation === row.id));
  }

  async function showMessagePanel() {
    const panel = $('#conversation-panel');
    const c = currentContext;
    const isCommunityChannel = c.type === 'channel';
    const mediaOnly = isCommunityChannel && c.channelType === 'media';
    const announcementLocked = isCommunityChannel && c.channelType === 'announcements' && !communityPermissions.post_announcements;
    const voiceNotice = isCommunityChannel && c.channelType === 'voice';
    const readOnly = announcementLocked || voiceNotice;
    const channelLabel = isCommunityChannel ? ` · ${escapeHtml(c.channelType === 'media' ? 'Solo multimedia' : c.channelType === 'announcements' ? 'Anuncios' : c.channelType === 'voice' ? 'Voz' : 'Texto')}` : '';
    const composerHint = mediaOnly
      ? 'Este canal solo admite archivos multimedia.'
      : announcementLocked
        ? 'Necesitas el permiso «Publicar anuncios» para escribir aquí.'
        : 'Enter para enviar · Shift + Enter para nueva línea · Markdown disponible';
    panel.innerHTML = `
      <div class="active-conversation">
        <div class="conversation-head"><span class="avatar" ${avatarStyle(c.icon)}>${c.icon ? '' : escapeHtml(initials(c.title))}</span><div class="conversation-head-copy"><strong>${escapeHtml(c.title)}</strong><small>${escapeHtml(c.subtitle || '')}${channelLabel}${c.channelDescription ? ` · ${escapeHtml(c.channelDescription)}` : ''}</small></div><div class="conversation-tools"><button class="icon-button" id="conversation-info" title="Información">ⓘ</button></div></div>
        <div id="pinned-messages" class="pinned-messages hidden"></div>
        ${voiceNotice ? '<div class="voice-placeholder"><div class="voice-placeholder-orb">◖</div><strong>Canal de voz</strong><p>Esta sala ya tiene su fondo y configuración de megagrupo. La conexión de audio llegará en una fase WebRTC independiente.</p><span class="tag">Audio todavía no conectado</span></div>' : `
        <div class="messages" id="messages-container"><div class="empty-state compact">Cargando mensajes…</div></div>
        <div class="composer-wrap ${readOnly ? 'composer-readonly' : ''} ${mediaOnly ? 'composer-media-only' : ''}">
          <div id="reply-composer" class="reply-composer hidden"><div><small>Respondiendo a <strong id="reply-author"></strong></small><span id="reply-excerpt"></span></div><button type="button" id="cancel-reply" class="icon-button" aria-label="Cancelar respuesta">×</button></div>
          <div class="composer-tools"><button id="attach-file" ${readOnly ? 'disabled' : ''}>＋ Archivo</button>${mediaOnly ? '' : `<button id="create-poll" ${readOnly ? 'disabled' : ''}>▤ Encuesta</button><button id="insert-bold" ${readOnly ? 'disabled' : ''}><b>B</b></button><button id="insert-italic" ${readOnly ? 'disabled' : ''}><i>I</i></button><button id="insert-code" ${readOnly ? 'disabled' : ''}>&lt;/&gt;</button>`}<input id="chat-file" class="upload-input" type="file" accept="image/*,video/*,.pdf,.txt,.zip"></div>
          <form class="composer" id="message-form"><textarea id="message-input" rows="1" maxlength="12000" placeholder="${mediaOnly ? 'Este canal solo admite archivos…' : announcementLocked ? 'Publicar anuncios requiere un permiso…' : 'Escribe un mensaje… (Markdown disponible)'}" ${mediaOnly || readOnly ? 'disabled' : ''}></textarea><button class="composer-send" type="submit" aria-label="Enviar" ${mediaOnly || readOnly ? 'disabled' : ''}>➤</button></form><div class="composer-hint">${composerHint}</div>
        </div>`}
      </div>`;
    applyChatCommunityBackground();
    loadPinnedMessages();
    if (!voiceNotice) {
      $('#cancel-reply').addEventListener('click', clearReplyTarget);
      $('#message-form').addEventListener('submit', sendMessage);
      $('#message-input').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#message-form').requestSubmit(); } });
      $('#attach-file').addEventListener('click', () => $('#chat-file').click());
      $('#chat-file').addEventListener('change', uploadAttachment);
      if (!mediaOnly && !announcementLocked) {
        $('#create-poll').addEventListener('click', createPoll);
        $('#insert-bold').addEventListener('click', () => wrapSelection('**'));
        $('#insert-italic').addEventListener('click', () => wrapSelection('*'));
        $('#insert-code').addEventListener('click', () => wrapSelection('`'));
      }
    }
    $('#conversation-info').addEventListener('click', () => {
      if (isCommunityChannel && c.channelDescription) toast(c.channelDescription);
      else toast('Los ajustes de nombre personal e icono por miembro se añadirán en el módulo de grupos.');
    });
  }

  function clearReplyTarget() {
    replyTarget = null;
    const preview = $('#reply-composer');
    if (preview) preview.classList.add('hidden');
  }

  function setReplyTarget(message, sender) {
    if (!$('#reply-composer')) return;
    replyTarget = {id:message.id, author:sender?.nickname || sender?.username || 'Usuario', body:String(message.body || message.attachment?.name || 'Mensaje').slice(0,180)};
    $('#reply-author').textContent = replyTarget.author;
    $('#reply-excerpt').textContent = replyTarget.body;
    $('#reply-composer').classList.remove('hidden');
    $('#message-input')?.focus();
  }

  function wrapSelection(mark) {
    const input = $('#message-input');
    const start = input.selectionStart, end = input.selectionEnd;
    const selected = input.value.slice(start, end);
    input.setRangeText(`${mark}${selected || 'texto'}${mark}`, start, end, 'select');
    input.focus();
  }

  async function openPublicProfile(userId) {
    const {data:person,error} = await client.from('profiles')
      .select('id,username,nickname,avatar_url,banner_url,bio,pronouns,aliases,default_name_color,widgets')
      .eq('id',userId).maybeSingle();
    if (error || !person) { showError(error || new Error('No se pudo encontrar el perfil.')); return; }
    let communityNickname = '';
    if (currentContext?.type === 'channel' && currentCommunity) {
      const {data:member} = await client.from('community_members').select('nickname')
        .eq('community_id',currentCommunity.id).eq('user_id',userId).maybeSingle();
      communityNickname = member?.nickname || '';
    }
    $('#public-profile-title').textContent = person.nickname || person.username;
    const host = $('#public-profile-body'); host.innerHTML = '';
    const banner = document.createElement('div'); banner.className='public-profile-banner';
    const bannerUrl = safeHttpsUrl(person.banner_url);
    if (bannerUrl) banner.style.backgroundImage = `linear-gradient(#10131c33,#10131c88),url("${bannerUrl.replace(/["\\]/g,'')}")`;
    const header = document.createElement('div'); header.className='public-profile-header';
    const avatar = document.createElement('span'); avatar.className='avatar public-profile-avatar';
    if (safeHttpsUrl(person.avatar_url)) avatar.style.backgroundImage=`url("${safeHttpsUrl(person.avatar_url).replace(/["\\]/g,'')}")`;
    else avatar.textContent=initials(person.nickname || person.username);
    const names = document.createElement('div'); names.className='public-profile-names';
    const display = document.createElement('strong'); display.textContent=communityNickname || person.nickname || person.username;
    const handle = document.createElement('small'); handle.textContent=`@${person.username}${communityNickname ? ` · ${person.nickname || person.username}` : ''}`;
    names.append(display,handle); header.append(avatar,names); host.append(banner,header);
    if (person.pronouns) { const pronouns=document.createElement('span'); pronouns.className='profile-pronouns-tag'; pronouns.textContent=person.pronouns; host.append(pronouns); }
    if (person.bio) { const bio=document.createElement('p'); bio.className='public-profile-bio'; bio.textContent=person.bio; host.append(bio); }
    const aliases = Array.isArray(person.aliases) ? person.aliases.filter(Boolean).slice(0,10) : [];
    if (aliases.length) {
      const aliasWrap=document.createElement('div'); aliasWrap.className='public-profile-aliases';
      aliases.forEach(alias=>{const tag=document.createElement('span');tag.className='tag';tag.textContent=alias;aliasWrap.append(tag);});
      host.append(aliasWrap);
    }
    const widgets = Array.isArray(person.widgets) ? person.widgets.slice(0,10) : [];
    if (widgets.length) {
      const heading=document.createElement('h4'); heading.className='public-profile-section-title'; heading.textContent='Widgets'; host.append(heading);
      const grid=document.createElement('div'); grid.className='public-profile-widgets';
      widgets.forEach(widget=>{
        const card=document.createElement('article'); card.className='public-profile-widget';
        const widgetBanner=document.createElement('div'); widgetBanner.className='profile-widget-banner';
        const value=String(widget.banner || '');
        if (/^#[0-9a-f]{6}$/i.test(value)) widgetBanner.style.background=value;
        else if (safeHttpsUrl(value)) widgetBanner.style.backgroundImage=`linear-gradient(#10131c22,#10131c66),url("${safeHttpsUrl(value).replace(/["\\]/g,'')}")`;
        const icon=document.createElement('span'); icon.className='profile-widget-icon';
        if (safeHttpsUrl(String(widget.icon || ''))) { const image=document.createElement('img'); image.src=safeHttpsUrl(widget.icon); image.alt=''; icon.append(image); }
        else icon.textContent=String(widget.icon || '✦').slice(0,8);
        const title=document.createElement('strong'); title.textContent=String(widget.title || 'Widget').slice(0,50);
        const desc=document.createElement('p'); desc.textContent=String(widget.description || '').slice(0,220);
        card.append(widgetBanner,icon,title,desc); grid.append(card);
      });
      host.append(grid);
    }
    $('#public-profile-dialog').showModal();
  }

  $('#close-public-profile').addEventListener('click',()=>$('#public-profile-dialog').close());

  async function fetchProfiles(ids) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) return {};
    const {data, error} = await client.from('profiles').select('id,username,nickname,avatar_url,default_name_color').in('id', unique);
    if (error) { console.warn(error); return {}; }
    return Object.fromEntries((data || []).map(row => [row.id,row]));
  }

  async function loadMessages() {
    if (!currentContext) return;
    const field = currentContext.type === 'conversation' ? 'conversation_id' : 'channel_id';
    const {data, error} = await client.from('messages').select('*').eq(field, currentContext.id).order('created_at', {ascending:true}).limit(100);
    if (error) { showError(error, 'No se pudieron cargar los mensajes.'); return; }
    const container = $('#messages-container');
    if (!container) return;
    renderedMessageIds.clear();
    container.innerHTML = '';
    if (!data?.length) container.innerHTML = '<div class="empty-state compact">Este espacio está tranquilo. Envía el primer mensaje.</div>';
    const profiles = await fetchProfiles((data || []).map(row => row.sender_id));
    const messageIds = (data || []).map(row => row.id);
    const reactionsByMessage = {};
    if (messageIds.length) {
      const {data:reactionRows,error:reactionError} = await client.from('message_reactions').select('message_id,emoji,user_id').in('message_id',messageIds);
      if (reactionError) console.warn('No se pudieron cargar las reacciones:',reactionError);
      else for (const reaction of reactionRows || []) (reactionsByMessage[reaction.message_id] ||= []).push(reaction);
    }
    for (const message of (data || [])) await appendMessage(message, profiles[message.sender_id], reactionsByMessage[message.id] || []);
    container.scrollTop = container.scrollHeight;
    if (currentContext?.type === 'conversation') {
      await markConversationRead(data?.at(-1)?.id || null);
      await renderConversationReadReceipts();
    }
  }

  async function getMessageIdentity(senderId) {
    const communityId = currentContext?.type === 'channel' ? currentCommunity?.id : null;
    const key = `${communityId || 'personal'}:${senderId}`;
    if (messageIdentityCache.has(key)) return messageIdentityCache.get(key);
    const result = {roles:[],badges:[]};
    try {
      if (communityId) {
        const {data:memberRecord} = await client.from('community_members').select('nickname').eq('community_id',communityId).eq('user_id',senderId).maybeSingle();
        result.communityNickname = memberRecord?.nickname || '';
        const {data:assignments} = await client.from('member_roles').select('role_id').eq('community_id',communityId).eq('user_id',senderId);
        const roleIds = (assignments || []).map(row => row.role_id);
        if (roleIds.length) {
          const {data:roles} = await client.from('community_roles').select('name,color,position').in('id',roleIds).order('position',{ascending:false});
          result.roles = roles || [];
        }
      }
      let badgeQuery = client.from('member_badges').select('badge_id').eq('user_id',senderId);
      badgeQuery = communityId ? badgeQuery.eq('community_id',communityId) : badgeQuery.is('community_id',null);
      const {data:badgeAssignments} = await badgeQuery;
      const badgeIds = (badgeAssignments || []).map(row => row.badge_id);
      if (badgeIds.length) {
        const {data:badges} = await client.from('badges').select('id,name,icon_url,animated').in('id',badgeIds);
        result.badges = badges || [];
      }
    } catch (error) {
      console.warn('No se pudieron cargar las insignias o roles del mensaje:',error);
    }
    messageIdentityCache.set(key,result);
    return result;
  }

  async function appendMessage(message, sender, initialReactions = null) {
    if (!message?.id || renderingMessageIds.has(message.id) || renderedMessageIds.has(message.id)) return;
    const existingContainer = $('#messages-container');
    if (existingContainer && $(`[data-message-id="${message.id}"]`, existingContainer)) { renderedMessageIds.add(message.id); return; }
    renderingMessageIds.add(message.id);
    try { await appendMessageInternal(message, sender, initialReactions); }
    finally { renderingMessageIds.delete(message.id); }
  }

  async function appendMessageInternal(message, sender, initialReactions = null) {
    const container = $('#messages-container');
    const contextIdAtStart = currentContext?.id;
    if (!container || $(`[data-message-id="${message.id}"]`, container)) return;
    const template = $('#message-template').content.cloneNode(true);
    const article = $('.message', template);
    article.dataset.messageId = message.id;
    article.__nexusMessage = message;
    const avatar = $('.avatar-message', article);
    if (sender?.avatar_url) avatar.style.backgroundImage = `url('${sender.avatar_url}')`;
    else avatar.textContent = initials(sender?.nickname || sender?.username || 'U');
    const author = $('.message-author', article);
    const identity = await getMessageIdentity(message.sender_id);
    author.textContent = identity.communityNickname || sender?.nickname || sender?.username || 'Usuario';
    author.classList.add('message-author-clickable');
    author.title = 'Ver perfil';
    author.addEventListener('click', () => openPublicProfile(message.sender_id));
    if (sender?.default_name_color) author.style.color = sender.default_name_color;
    if (identity.roles[0]?.color) author.style.color = identity.roles[0].color;
    if (identity.roles.length || identity.badges.length) {
      const decorations = document.createElement('span');
      decorations.className = 'message-identity-decorations';
      for (const role of identity.roles) {
        const tag = document.createElement('span');
        tag.className = 'message-role-tag';
        tag.textContent = role.name;
        tag.style.setProperty('--role-color', role.color || '#a99bff');
        decorations.append(tag);
      }
      for (const badge of identity.badges) {
        const safeIcon = /^https:\/\//i.test(badge.icon_url || '');
        if (safeIcon) {
          const icon = document.createElement('img');
          icon.className = 'message-badge-icon';
          icon.src = badge.icon_url;
          icon.alt = badge.name;
          icon.title = badge.name;
          icon.loading = 'lazy';
          decorations.append(icon);
        } else {
          const icon = document.createElement('span');
          icon.className = 'message-badge-emoji';
          icon.textContent = badge.icon_url || '★';
          icon.title = badge.name;
          decorations.append(icon);
        }
      }
      $('.message-meta', article).insertBefore(decorations, $('time', article));
    }
    $('time', article).textContent = `${dateLabel(message.created_at)}${message.edited_at ? ' · editado' : ''}`;
    const messageActions = document.createElement('span');
    messageActions.className = 'message-actions';
    const replyButton = document.createElement('button');
    replyButton.type = 'button';
    replyButton.className = 'message-action-button';
    replyButton.textContent = 'Responder';
    replyButton.addEventListener('click', () => setReplyTarget(message, sender));
    messageActions.append(replyButton);
    const pinButton = document.createElement('button');
    pinButton.type = 'button'; pinButton.className = 'message-action-button'; pinButton.textContent = 'Fijar';
    pinButton.dataset.pinMessageId = message.id;
    if (currentContext?.type === 'channel' && !communityPermissions.manage_messages) { pinButton.disabled = true; pinButton.title = 'Solo moderadores pueden fijar mensajes en este canal.'; }
    pinButton.addEventListener('click', () => togglePinnedMessage(message));
    messageActions.append(pinButton);
    if (message.sender_id === currentUser.id && message.message_type === 'text') {
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'message-action-button';
      editButton.textContent = 'Editar';
      editButton.addEventListener('click', () => openMessageEditor(message));
      messageActions.append(editButton);
    }
    if (message.sender_id === currentUser.id || (currentContext?.type === 'channel' && communityPermissions.manage_messages)) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'message-delete-button';
      deleteButton.textContent = 'Eliminar';
      deleteButton.title = 'Eliminar este mensaje';
      deleteButton.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este mensaje?')) return;
        const {error} = await client.from('messages').delete().eq('id',message.id);
        if (error) showError(error,'No tienes permiso para eliminar este mensaje.');
        else { article.remove(); toast('Mensaje eliminado.','success'); }
      });
      messageActions.append(deleteButton);
    }
    $('.message-meta', article).append(messageActions);

    if (message.reply_to) {
      const quote = document.createElement('button');
      quote.type = 'button';
      quote.className = 'message-reply-quote';
      quote.textContent = 'Cargando mensaje citado…';
      quote.addEventListener('click', () => {
        const target = $(`[data-message-id="${message.reply_to}"]`, container);
        if (target) { target.scrollIntoView({behavior:'smooth',block:'center'}); target.classList.add('message-flash'); setTimeout(() => target.classList.remove('message-flash'), 900); }
      });
      $('.message-main', article).insertBefore(quote, $('.message-body', article));
      const {data:original} = await client.from('messages').select('body,sender_id,attachment').eq('id',message.reply_to).maybeSingle();
      if (original) {
        const replyProfiles = await fetchProfiles([original.sender_id]);
        const replyName = replyProfiles[original.sender_id]?.nickname || replyProfiles[original.sender_id]?.username || 'Usuario';
        quote.textContent = `${replyName}: ${String(original.body || original.attachment?.name || 'Mensaje').slice(0,150)}`;
      } else quote.textContent = 'Mensaje original no disponible';
    }

    const body = $('.message-body', article);
    const source = String(message.body || '');
    try {
      const rendered = window.marked ? marked.parse(source, {breaks:true, gfm:true}) : escapeHtml(source).replace(/\n/g,'<br>');
      body.innerHTML = window.DOMPurify ? DOMPurify.sanitize(rendered, {USE_PROFILES:{html:true}}) : escapeHtml(source);
    } catch { body.textContent = source; }
    if (message.message_type === 'poll') {
      const {data: poll} = await client.from('polls').select('*').eq('message_id',message.id).maybeSingle();
      if (poll) {
        const {data: votes} = await client.from('poll_votes').select('option_index,user_id').eq('poll_id',poll.id);
        const counts = (poll.options || []).map((_,index) => (votes || []).filter(vote => vote.option_index === index).length);
        const mine = (votes || []).find(vote => vote.user_id === currentUser.id);
        const card = document.createElement('div');
        card.className = 'poll-card';
        const heading = document.createElement('strong');
        heading.textContent = poll.question;
        card.append(heading);
        (poll.options || []).forEach((option,index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `poll-option ${mine?.option_index === index ? 'selected' : ''}`;
          button.textContent = `${option} · ${counts[index] || 0}`;
          button.disabled = Boolean(poll.ends_at && new Date(poll.ends_at) < new Date());
          button.addEventListener('click', async () => {
            const {error} = await client.from('poll_votes').upsert({poll_id:poll.id,user_id:currentUser.id,option_index:index},{onConflict:'poll_id,user_id'});
            if (error) showError(error); else loadMessages();
          });
          card.append(button);
        });
        $('.message-attachment', article).append(card);
      }
    }
    if (message.attachment?.path) {
      const {data} = await client.storage.from('chat-media').createSignedUrl(message.attachment.path, 3600);
      if (data?.signedUrl) {
        const attachment = $('.message-attachment', article);
        const type = message.attachment.mimetype || '';
        const name = escapeHtml(message.attachment.name || 'archivo');
        if (type.startsWith('image/')) attachment.innerHTML = `<a href="${data.signedUrl}" target="_blank" rel="noopener"><img src="${data.signedUrl}" alt="${name}" loading="lazy"></a>`;
        else if (type.startsWith('video/')) attachment.innerHTML = `<video controls preload="metadata" src="${data.signedUrl}"></video><a href="${data.signedUrl}" download="${name}">Descargar vídeo</a>`;
        else attachment.innerHTML = `<a href="${data.signedUrl}" download="${name}">Descargar ${name}</a>`;
      }
    }
    const reactionBar = $('.message-reactions', article);
    reactionBar.dataset.reactionMessage = message.id;
    if (container !== $('#messages-container') || currentContext?.id !== contextIdAtStart) return;
    container.append(template);
    renderedMessageIds.add(message.id);
    await refreshMessageReactions(article, message.id, initialReactions);
    container.scrollTop = container.scrollHeight;
  }

  async function refreshMessageReactions(article, messageId, initialRows = null) {
    const bar = $('.message-reactions', article);
    if (!bar) return;
    let rows = initialRows;
    if (rows === null) {
      const {data,error} = await client.from('message_reactions').select('emoji,user_id').eq('message_id', messageId);
      if (error) { console.warn('No se pudieron cargar las reacciones:', error); return; }
      rows = data || [];
    }
    const grouped = new Map();
    for (const row of rows || []) {
      if (!grouped.has(row.emoji)) grouped.set(row.emoji, []);
      grouped.get(row.emoji).push(row.user_id);
    }
    bar.innerHTML = '';
    for (const [emoji, users] of grouped) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `reaction-chip ${users.includes(currentUser.id) ? 'selected' : ''}`;
      chip.textContent = `${emoji} ${users.length}`;
      chip.title = users.length === 1 ? '1 reacción' : `${users.length} reacciones`;
      chip.addEventListener('click', () => toggleMessageReaction(messageId, emoji));
      bar.append(chip);
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'reaction-add';
    add.textContent = '＋';
    add.title = 'Añadir reacción';
    add.addEventListener('click', async () => {
      const selected = await ask('Añadir reacción', `Elige uno: ${REACTION_OPTIONS.join(' ')}`, 'Emoji', '👍');
      if (!selected) return;
      if (!REACTION_OPTIONS.includes(selected)) { toast('Elige uno de los emojis disponibles.'); return; }
      await toggleMessageReaction(messageId, selected, true);
    });
    bar.append(add);
  }

  async function toggleMessageReaction(messageId, emoji, forceAdd = false) {
    const {data:existing, error:readError} = await client.from('message_reactions').select('message_id').eq('message_id',messageId).eq('user_id',currentUser.id).eq('emoji',emoji).maybeSingle();
    if (readError) { showError(readError, 'No se pudo consultar la reacción. Ejecuta la migración v0.4.'); return; }
    const response = existing && !forceAdd
      ? await client.from('message_reactions').delete().eq('message_id',messageId).eq('user_id',currentUser.id).eq('emoji',emoji)
      : existing ? {error:null} : await client.from('message_reactions').insert({message_id:messageId,user_id:currentUser.id,emoji});
    if (response.error) { showError(response.error, 'No se pudo guardar la reacción.'); return; }
    const article = $(`[data-message-id="${messageId}"]`, $('#messages-container'));
    if (article) await refreshMessageReactions(article, messageId);
  }

  async function openMessageEditor(message) {
    editingMessageId = message.id;
    $('#edit-message-body').value = message.body || '';
    $('#edit-message-dialog').showModal();
    $('#edit-message-body').focus();
  }

  $('#close-message-edit').addEventListener('click', () => { $('#edit-message-dialog').close(); editingMessageId = null; });
  $('#cancel-message-edit').addEventListener('click', () => { $('#edit-message-dialog').close(); editingMessageId = null; });

  $('#edit-message-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!editingMessageId) return;
    const body = $('#edit-message-body').value.trim();
    if (!body) { toast('El mensaje no puede quedar vacío.'); return; }
    const save = $('#save-message-edit');
    save.disabled = true;
    const {error} = await client.rpc('edit_message',{p_message_id:editingMessageId,p_body:body});
    save.disabled = false;
    if (error) { showError(error,'No se pudo editar el mensaje.'); return; }
    $('#edit-message-dialog').close();
    editingMessageId = null;
    await loadMessages();
    toast('Mensaje editado.','success');
  });

  async function loadPinnedMessages() {
    const host = $('#pinned-messages');
    if (!host || !currentContext) return;
    const field = currentContext.type === 'conversation' ? 'conversation_id' : 'channel_id';
    const {data:pins,error} = await client.from('pinned_messages').select('id,message_id,pinned_by,created_at')
      .eq(field,currentContext.id).order('created_at',{ascending:false}).limit(5);
    if (error) { console.warn('No se pudieron cargar los mensajes fijados:',error); host.classList.add('hidden'); return; }
    if (!pins?.length) { host.classList.add('hidden'); host.innerHTML=''; $$('[data-pin-message-id]').forEach(button => button.textContent='Fijar'); return; }
    const messageIds = pins.map(pin => pin.message_id);
    const {data:messages} = await client.from('messages').select('id,body,attachment,sender_id').in('id',messageIds);
    const messageMap = Object.fromEntries((messages || []).map(message => [message.id,message]));
    const profiles = await fetchProfiles((messages || []).map(message => message.sender_id));
    host.innerHTML = `<div class="pinned-label">Fijados</div>${pins.map(pin => {
      const message = messageMap[pin.message_id];
      const author = profiles[message?.sender_id]?.nickname || profiles[message?.sender_id]?.username || 'Usuario';
      const excerpt = message?.body || message?.attachment?.name || 'Mensaje';
      return `<button type="button" class="pinned-entry" data-pin-target="${pin.message_id}"><strong>${escapeHtml(author)}</strong><span>${escapeHtml(String(excerpt).slice(0,110))}</span></button>`;
    }).join('')}`;
    host.classList.remove('hidden');
    const pinnedIds = new Set(messageIds);
    $$('[data-pin-message-id]').forEach(button => { button.textContent = pinnedIds.has(button.dataset.pinMessageId) ? 'Desfijar' : 'Fijar'; });
    $$('[data-pin-target]',host).forEach(button => button.addEventListener('click', () => {
      const target = $(`[data-message-id="${button.dataset.pinTarget}"]`,$('#messages-container'));
      if (target) { target.scrollIntoView({behavior:'smooth',block:'center'}); target.classList.add('message-flash'); setTimeout(()=>target.classList.remove('message-flash'),900); }
      else toast('Ese mensaje no está en los últimos 100 mensajes cargados.');
    }));
  }

  async function togglePinnedMessage(message) {
    const field = currentContext.type === 'conversation' ? 'conversation_id' : 'channel_id';
    const {data:existing,error:readError} = await client.from('pinned_messages').select('id')
      .eq('message_id',message.id).maybeSingle();
    if (readError) { showError(readError,'No se pudieron consultar los mensajes fijados. Ejecuta la migración v0.5.'); return; }
    const response = existing
      ? await client.from('pinned_messages').delete().eq('id',existing.id)
      : await client.from('pinned_messages').insert({message_id:message.id,[field]:currentContext.id,pinned_by:currentUser.id});
    if (response.error) { showError(response.error,'No se pudo fijar este mensaje. En canales necesitas gestionar mensajes.'); return; }
    await loadPinnedMessages();
    toast(existing ? 'Mensaje desfijado.' : 'Mensaje fijado.','success');
  }

  async function markConversationRead(messageId) {
    if (currentContext?.type !== 'conversation') return;
    const {error} = await client.rpc('mark_conversation_read',{p_conversation_id:currentContext.id,p_message_id:messageId});
    if (error) console.warn('No se pudo marcar como leído:',error.message);
  }

  async function renderConversationReadReceipts() {
    const container = $('#messages-container');
    if (!container || currentContext?.type !== 'conversation') return;
    const {data:reads,error} = await client.from('conversation_reads').select('user_id,read_at')
      .eq('conversation_id',currentContext.id).neq('user_id',currentUser.id);
    if (error) { console.warn('No se pudieron leer las confirmaciones:',error.message); return; }
    $$('.message-read-receipt',container).forEach(node=>node.remove());
    const mine = $$('.message',container).filter(article => article.__nexusMessage?.sender_id === currentUser.id);
    const latest = mine.at(-1);
    if (!latest) return;
    const messageDate = new Date(latest.__nexusMessage.created_at).getTime();
    const seen = (reads || []).filter(row => new Date(row.read_at).getTime() >= messageDate).length;
    if (!seen) return;
    const receipt = document.createElement('small'); receipt.className='message-read-receipt';
    receipt.textContent = seen === 1 ? 'Visto por 1 persona' : `Visto por ${seen} personas`;
    $('.message-main',latest).append(receipt);
  }

  async function refreshPollFromRealtime(payload) {
    if (!currentContext) return;
    const pollId = payload.new?.poll_id || payload.old?.poll_id;
    if (!pollId) return;
    const {data:poll} = await client.from('polls').select('message_id').eq('id',pollId).maybeSingle();
    if (!poll) return;
    const {data:message} = await client.from('messages').select('conversation_id,channel_id').eq('id',poll.message_id).maybeSingle();
    if (!message) return;
    const isCurrent = currentContext.type === 'conversation'
      ? message.conversation_id === currentContext.id
      : message.channel_id === currentContext.id;
    if (isCurrent) await loadMessages();
  }

  async function refreshPinsFromRealtime(payload) {
    if (!currentContext) return;
    const row = payload.new || payload.old || {};
    const field = currentContext.type === 'conversation' ? 'conversation_id' : 'channel_id';
    if (row[field] === currentContext.id) { await loadPinnedMessages(); return; }
    const messageId = row.message_id;
    if (!messageId) return;
    const {data:message} = await client.from('messages').select('conversation_id,channel_id').eq('id',messageId).maybeSingle();
    if (message && message[field] === currentContext.id) await loadPinnedMessages();
  }

  function subscribeMessages() {
    if (activeMessageChannel) client.removeChannel(activeMessageChannel);
    if (!currentContext) return;
    const field = currentContext.type === 'conversation' ? 'conversation_id' : 'channel_id';
    activeMessageChannel = client.channel(`nexus-${currentContext.type}-${currentContext.id}`)
      .on('postgres_changes', {event:'INSERT',schema:'public',table:'messages',filter:`${field}=eq.${currentContext.id}`}, async payload => {
        const profiles = await fetchProfiles([payload.new.sender_id]);
        await appendMessage(payload.new, profiles[payload.new.sender_id]);
        if (currentContext?.type === 'conversation') {
          scheduleAccountListRefresh('conversations');
          if (payload.new.sender_id !== currentUser.id) { await markConversationRead(payload.new.id); await renderConversationReadReceipts(); }
        }
      })
      .on('postgres_changes', {event:'UPDATE',schema:'public',table:'messages',filter:`${field}=eq.${currentContext.id}`}, async () => loadMessages())
      .on('postgres_changes', {event:'*',schema:'public',table:'message_reactions'}, async payload => {
        const messageId = payload.new?.message_id || payload.old?.message_id;
        if (!messageId) return;
        const article = $(`[data-message-id="${messageId}"]`, $('#messages-container'));
        if (article) await refreshMessageReactions(article,messageId);
      })
      .on('postgres_changes', {event:'*',schema:'public',table:'poll_votes'}, async payload => refreshPollFromRealtime(payload))
      .on('postgres_changes', {event:'*',schema:'public',table:'pinned_messages'}, async payload => refreshPinsFromRealtime(payload))
      .on('postgres_changes', {event:'*',schema:'public',table:'conversation_reads',filter:currentContext.type === 'conversation' ? `conversation_id=eq.${currentContext.id}` : 'conversation_id=eq.00000000-0000-0000-0000-000000000000'}, async () => renderConversationReadReceipts())
      .subscribe(status => {
        const node = $('#connection-status');
        node.classList.toggle('online', status === 'SUBSCRIBED');
        node.innerHTML = `<i></i> ${status === 'SUBSCRIBED' ? 'En directo' : status === 'CHANNEL_ERROR' ? 'Sin conexión' : 'Conectando'}`;
      });
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!currentContext) return;
    if (currentContext.type === 'channel' && currentContext.channelType === 'media') { toast('Este canal solo admite archivos multimedia.','error'); return; }
    if (currentContext.type === 'channel' && currentContext.channelType === 'announcements' && !communityPermissions.post_announcements) { toast('Necesitas el permiso Publicar anuncios.','error'); return; }
    const input = $('#message-input');
    const body = input.value.trim();
    if (!body) return;
    input.disabled = true;
    const payload = {sender_id:currentUser.id, body, ...(replyTarget ? {reply_to:replyTarget.id} : {})};
    payload[currentContext.type === 'conversation' ? 'conversation_id' : 'channel_id'] = currentContext.id;
    const {error} = await client.from('messages').insert(payload);
    input.disabled = false;
    if (error) { showError(error, 'No se pudo enviar el mensaje.'); return; }
    input.value = '';
    clearReplyTarget();
    input.focus();
  }

  async function uploadAttachment(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !currentContext || !currentUser) return;
    if (currentContext.type === 'channel' && currentContext.channelType === 'announcements' && !communityPermissions.post_announcements) { toast('Necesitas el permiso Publicar anuncios.','error'); return; }
    if (file.size > 50 * 1024 * 1024) { toast('El límite inicial de archivos es 50 MB.', 'error'); return; }
    const allowed = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|application\/(pdf|zip)|text\/plain)$/i;
    if (file.type && !allowed.test(file.type)) { toast('Este tipo de archivo no está permitido.', 'error'); return; }

    const isConversation = currentContext.type === 'conversation';
    const folder = isConversation ? 'dm' : 'community';
    const safeExtension = (file.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi,'').slice(0,8) || 'bin';
    const path = `${folder}/${currentContext.id}/${crypto.randomUUID()}.${safeExtension}`;
    const storage = client.storage.from('chat-media');
    toast('Subiendo archivo…');

    let uploaded = false;
    try {
      const {error: uploadError} = await storage.upload(path, file, {
        contentType:file.type || 'application/octet-stream',
        upsert:false
      });
      if (uploadError) {
        if (/row-level security|security policy/i.test(uploadError.message || '')) {
          throw new Error('Supabase ha bloqueado la subida por sus políticas de Storage. Ejecuta el parche supabase/fix-chat-media-rls.sql en el SQL Editor y vuelve a intentarlo.');
        }
        throw uploadError;
      }
      uploaded = true;
      const payload = {
        sender_id:currentUser.id,
        body:file.name || 'Archivo adjunto',
        message_type:'media',
        attachment:{path,name:file.name || 'archivo',mimetype:file.type || 'application/octet-stream'},
        ...(replyTarget ? {reply_to:replyTarget.id} : {})
      };
      payload[isConversation ? 'conversation_id' : 'channel_id'] = currentContext.id;
      const {error: messageError} = await client.from('messages').insert(payload);
      if (messageError) {
        // Avoid leaving an inaccessible object behind when its message cannot be created.
        await storage.remove([path]);
        uploaded = false;
        throw new Error(`El archivo se subió, pero no se pudo publicar el mensaje: ${messageError.message}`);
      }
      clearReplyTarget();
      toast('Archivo enviado.', 'success');
    } catch (error) {
      showError(error, 'No se pudo subir el archivo.');
    } finally {
      if (uploaded) {
        // Keep the object; its path is now referenced by the message row.
      }
    }
  }

  async function createPoll() {
    if (!currentContext) return;
    if (currentContext.type === 'channel' && currentContext.channelType === 'media') { toast('Los canales multimedia solo admiten archivos.','error'); return; }
    if (currentContext.type === 'channel' && currentContext.channelType === 'voice') { toast('Los canales de voz no admiten encuestas.','error'); return; }
    if (currentContext.type === 'channel' && currentContext.channelType === 'announcements' && !communityPermissions.post_announcements) { toast('Necesitas el permiso Publicar anuncios.','error'); return; }
    const raw = await ask('Crear encuesta','Escribe la pregunta y dos o más opciones separadas por |.','Pregunta y opciones','¿Qué hacemos? | Opción A | Opción B');
    if (!raw) return;
    const parts = raw.split('|').map(value => value.trim()).filter(Boolean);
    if (parts.length < 3 || parts.length > 11) { toast('Incluye una pregunta y entre 2 y 10 opciones.','error'); return; }
    if (parts[0].length > 200 || parts.slice(1).some(option => option.length > 100)) { toast('La pregunta admite 200 caracteres y cada opción 100.','error'); return; }
    const {error} = await client.rpc('create_poll', {
      p_context_type:currentContext.type,
      p_context_id:currentContext.id,
      p_question:parts[0],
      p_options:parts.slice(1),
      p_reply_to:replyTarget?.id || null
    });
    if (error) { showError(error, 'No se pudo crear la encuesta. Ejecuta la migración v0.5.'); return; }
    clearReplyTarget();
    // The message and poll row now commit in one transaction; realtime can only
    // observe the fully-created poll. Reload is an idempotent fallback.
    await loadMessages();
    toast('Encuesta publicada.','success');
  }

  $('#new-chat').addEventListener('click', createNewChat);
  $('#welcome-new-chat').addEventListener('click', createNewChat);
  async function createNewChat() {
    const selection = await ask('Nueva conversación','Escribe el nombre de usuario de un amigo. Para un grupo, separa varios usuarios con comas.','Usuarios','ejemplo o ana, mario');
    if (!selection) return;
    const usernames = selection.split(',').map(value => value.trim().replace(/^@/,'').toLowerCase()).filter(Boolean);
    const {data: people, error} = await client.from('profiles').select('id,username').in('username', usernames);
    if (error) { showError(error); return; }
    const found = people || [];
    const missing = usernames.filter(name => !found.some(p => p.username === name));
    if (missing.length) { toast(`No se encontró: ${missing.join(', ')}`, 'error'); return; }
    const isGroup = found.length > 1;
    const groupTitle = isGroup ? await ask('Nombre del grupo','Dale un nombre a esta conversación.','Nombre','Mi grupo') : null;
    const {data: conversationId, error: createError} = await client.rpc('create_conversation', {
      p_kind:isGroup ? 'group' : 'direct', p_title:groupTitle || null, p_member_ids:found.map(person => person.id)
    });
    if (createError) { showError(createError, 'No se pudo crear la conversación. Comprueba que sois amigos.'); return; }
    await loadConversations();
    const conversation = conversations.find(row => row.id === conversationId);
    if (conversation) openConversation(conversation);
    toast('Conversación creada.', 'success');
  }

  // ---------- Friends ----------
  async function loadFriends() {
    if (!currentUser) return;
    const {data, error} = await client.from('friends').select('*').or(`requester.eq.${currentUser.id},addressee.eq.${currentUser.id}`).order('created_at',{ascending:false});
    if (error) throw error;
    const rows = data || [];
    const otherIds = rows.map(row => row.requester === currentUser.id ? row.addressee : row.requester);
    const profiles = await fetchProfiles(otherIds);
    friendsCache = rows.filter(row => row.status === 'accepted').map(row => ({...row,person:profiles[row.requester === currentUser.id ? row.addressee : row.requester]}));
    const incoming = rows.filter(row => row.status === 'pending' && row.addressee === currentUser.id);
    const outgoing = rows.filter(row => row.status === 'pending' && row.requester === currentUser.id);
    $('#friend-count').textContent = friendsCache.length || '';
    $('#friend-list').innerHTML = friendsCache.length ? friendsCache.map(row => personRow(row.person, `<button class="button button-secondary" data-dm="${row.person.id}">Mensaje</button>`)).join('') : '<div class="empty-state compact">Todavía no has añadido a nadie.</div>';
    $('#friend-requests').innerHTML = incoming.length ? incoming.map(row => personRow(profiles[row.requester], `<button class="button button-primary" data-accept="${row.id}">Aceptar</button>`)).join('') : '<div class="empty-state compact">No hay solicitudes pendientes.</div>';
    if (outgoing.length) $('#friend-requests').insertAdjacentHTML('beforeend', outgoing.map(row => personRow(profiles[row.addressee], '<span class="tag">Enviada</span>')).join(''));
    $$('[data-dm]').forEach(button => button.addEventListener('click', () => startDirect(button.dataset.dm)));
    $$('[data-accept]').forEach(button => button.addEventListener('click', () => acceptFriend(button.dataset.accept)));
  }
  function personRow(person, actions = '') {
    if (!person) return '';
    return `<div class="person-row">${avatarMarkup(person)}<div class="person-row-copy"><strong>${escapeHtml(person.nickname || person.username)}</strong><small>@${escapeHtml(person.username)}</small></div><div class="person-actions">${actions}</div></div>`;
  }
  $('#add-friend').addEventListener('click', addFriendFlow);
  async function addFriendFlow() {
    const username = await ask('Añadir amigo','Busca a alguien por su nombre de usuario.','Usuario','nombre_de_usuario');
    if (!username) return;
    const clean = username.replace(/^@/,'').toLowerCase();
    const {data:person,error} = await client.from('profiles').select('id,username').eq('username',clean).maybeSingle();
    if (error) { showError(error); return; }
    if (!person) { toast('No se ha encontrado ese usuario.','error'); return; }
    if (person.id === currentUser.id) { toast('No puedes enviarte una solicitud a ti mismo.'); return; }
    const {error: insertError} = await client.from('friends').insert({requester:currentUser.id,addressee:person.id,status:'pending'});
    if (insertError) { showError(insertError, 'Ya existe una solicitud o ya sois amigos.'); return; }
    toast('Solicitud de amistad enviada.','success');
    loadFriends();
  }
  async function acceptFriend(id) {
    const {error} = await client.from('friends').update({status:'accepted'}).eq('id',id).eq('addressee',currentUser.id);
    if (error) showError(error); else { toast('Ahora sois amigos.','success'); loadFriends(); }
  }
  async function startDirect(userId) {
    const {data:id,error} = await client.rpc('create_conversation',{p_kind:'direct',p_title:null,p_member_ids:[userId]});
    if (error) { showError(error,'No se pudo iniciar el MD. Añadid primero vuestra amistad.'); return; }
    await loadConversations();
    const row = conversations.find(item => item.id === id);
    if (row) openConversation(row); else toast('Conversación iniciada. Recarga la bandeja si no aparece.','success');
  }

  // ---------- Megagroups / channels / alliances ----------
  async function loadCommunities() {
    const {data: memberships,error} = await client.from('community_members').select('community_id').eq('user_id',currentUser.id);
    if (error) throw error;
    const ids = [...new Set((memberships || []).map(row => row.community_id))];
    let rows = [];
    if (ids.length) {
      const response = await client.from('communities').select('*').in('id',ids).order('created_at',{ascending:true});
      if (response.error) throw response.error;
      rows = response.data || [];
    }
    const rail = $('#community-rail');
    rail.innerHTML = rows.map(row => `<button title="${escapeHtml(row.name)}" data-community="${row.id}" class="${currentCommunity?.id === row.id ? 'active' : ''}" ${avatarStyle(row.icon_url)}>${row.icon_url ? '' : escapeHtml(initials(row.name))}</button>`).join('');
    $$('[data-community]').forEach(button => button.addEventListener('click', () => selectCommunity(rows.find(row => row.id === button.dataset.community))));
  }
  $('#create-community-shortcut').addEventListener('click', createCommunity);

  function safeHttpsUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try { const parsed = new URL(raw); return parsed.protocol === 'https:' ? parsed.href : ''; }
    catch { return ''; }
  }

  function sanitizeCommunityCss(source) {
    const css = String(source || '').trim();
    if (!css) return '';
    if (css.length > 6000 || /@import|@font-face|url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding|<|>|\\/i.test(css)) {
      throw new Error('El CSS contiene una regla no permitida. Solo se aceptan estilos visuales locales.');
    }
    const allowedSelectors = new Set(['.community-hero','.community-info-grid','.community-info-grid h2','#community-name','#community-description']);
    const allowedProperties = new Set(['color','background-color','border-color','border-radius','box-shadow','font-family','font-size','font-weight','letter-spacing','text-align','padding','margin','opacity','text-decoration']);
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    if (!rules.length || rules.map(rule => rule[0]).join('').replace(/\s/g,'') !== css.replace(/\s/g,'')) {
      throw new Error('El CSS debe contener reglas sencillas con selector y llaves.');
    }
    const output = [];
    for (const match of rules) {
      const selectors = match[1].split(',').map(value => value.trim());
      if (!selectors.length || selectors.some(selector => !allowedSelectors.has(selector))) {
        throw new Error('Solo puedes personalizar .community-hero, .community-info-grid, .community-info-grid h2, #community-name y #community-description.');
      }
      const declarations = [];
      for (const declaration of match[2].split(';')) {
        if (!declaration.trim()) continue;
        const splitAt = declaration.indexOf(':');
        if (splitAt < 1) throw new Error('Hay una declaración CSS no válida.');
        const property = declaration.slice(0,splitAt).trim().toLowerCase();
        const value = declaration.slice(splitAt+1).trim();
        if (!allowedProperties.has(property) || !value || !/^[a-zA-Z0-9#(),.%+\s-]+$/.test(value)) {
          throw new Error(`La propiedad CSS «${property}» o su valor no está permitido.`);
        }
        declarations.push(`${property}:${value}`);
      }
      if (declarations.length) output.push(`${selectors.map(selector => `#view-community ${selector}`).join(',')} { ${declarations.join(';')} }`);
    }
    return output.join('\n');
  }

  function applyCommunityAppearance(community) {
    const name = $('#community-name');
    const hero = $('#community-hero');
    const view = $('#view-community');
    const banner = safeHttpsUrl(community?.banner_url);
    const background = safeHttpsUrl(community?.background_url);
    const icon = safeHttpsUrl(community?.icon_url);
    name.style.color = /^#[0-9a-f]{6}$/i.test(community?.name_color || '') ? community.name_color : '';
    hero.style.backgroundImage = banner ? `linear-gradient(90deg,#10131caa,#10131c66),url("${banner.replace(/["\\]/g,'')}")` : '';
    view.style.backgroundImage = background ? `linear-gradient(#10131cbb,#10131cdd),url("${background.replace(/["\\]/g,'')}")` : '';
    view.style.backgroundSize = background ? 'cover' : '';
    view.style.backgroundAttachment = background ? 'fixed' : '';
    const iconNode = $('#community-icon-preview');
    if (iconNode) {
      iconNode.textContent = icon ? '' : initials(community?.name || '?');
      iconNode.style.backgroundImage = icon ? `url("${icon.replace(/["\\]/g,'')}")` : '';
    }
    let styleNode = document.getElementById('community-custom-style');
    if (!styleNode) { styleNode = document.createElement('style'); styleNode.id = 'community-custom-style'; document.head.append(styleNode); }
    try { styleNode.textContent = sanitizeCommunityCss(community?.custom_css || ''); }
    catch (error) { styleNode.textContent = ''; console.warn('CSS del megagrupo ignorado:',error); }
  }
  function applyChatCommunityBackground() {
    const pane = $('#conversation-panel');
    if (!pane) return;
    const background = currentContext?.type === 'channel' ? safeHttpsUrl(currentCommunity?.background_url) : '';
    if (background) {
      const safe = background.replace(/["\\]/g,'');
      pane.style.backgroundImage = `linear-gradient(rgba(12,16,25,.55),rgba(12,16,25,.70)),url("${safe}")`;
      pane.style.backgroundSize = 'cover';
      pane.style.backgroundPosition = 'center';
      pane.style.backgroundAttachment = 'fixed';
    } else {
      pane.style.backgroundImage = '';
      pane.style.backgroundSize = '';
      pane.style.backgroundPosition = '';
      pane.style.backgroundAttachment = '';
    }
  }

  async function createCommunity() {
    const name = await ask('Crear megagrupo','Crea un espacio público para tu comunidad.','Nombre','Mi comunidad');
    if (!name) return;
    const {data:id,error} = await client.rpc('create_community',{p_name:name,p_description:'Una nueva comunidad en Nexus.'});
    if (error) { showError(error); return; }
    await loadCommunities();
    const {data:community} = await client.from('communities').select('*').eq('id',id).single();
    selectCommunity(community);
    toast('Megagrupo creado con un canal #general.','success');
  }
  async function selectCommunity(community) {
    if (!community) return;
    currentCommunity = community;
    await loadCommunities();
    $('#community-name').textContent = community.name;
    $('#community-description').textContent = community.description || 'Sin descripción.';
    $('#community-id-short').textContent = community.id.slice(0,8);
    applyCommunityAppearance(community);
    $('#community-settings').classList.toggle('hidden',community.owner_id !== currentUser.id);
    switchView('community');
    const permissionNames = ['manage_roles','manage_badges','manage_messages','manage_channels','post_announcements'];
    const permissionResults = await Promise.all(permissionNames.map(p_permission => client.rpc('has_community_permission',{p_community_id:community.id,p_permission})));
    permissionNames.forEach((name,index) => { communityPermissions[name] = Boolean(permissionResults[index].data); });
    await loadChannels();
    await loadAllies();
    const {count} = await client.from('community_members').select('*',{count:'exact',head:true}).eq('community_id',community.id);
    $('#community-members-count').textContent = count ?? '—';
    $('#community-roles-area').classList.toggle('hidden',!communityPermissions.manage_roles);
    $('#community-badges-area').classList.toggle('hidden',!communityPermissions.manage_badges);
    if (communityPermissions.manage_roles) await loadCommunityManagement();
    if (communityPermissions.manage_badges) await loadCommunityBadgeManagement();
  }
  // ---------- Community role and member management ----------
  const ROLE_PERMISSIONS = [
    ['send_messages','Enviar mensajes'],
    ['manage_messages','Gestionar mensajes'],
    ['post_announcements','Publicar anuncios'],
    ['manage_channels','Gestionar canales'],
    ['manage_roles','Gestionar roles'],
    ['manage_badges','Gestionar medallas'],
    ['create_invites','Crear invitaciones'],
  ];
  async function loadCommunityManagement() {
    if (!currentCommunity || !communityPermissions.manage_roles) return;
    const [rolesResponse,membersResponse,assignmentsResponse] = await Promise.all([
      client.from('community_roles').select('*').eq('community_id',currentCommunity.id).order('position',{ascending:true}).order('name'),
      client.from('community_members').select('user_id,nickname,joined_at').eq('community_id',currentCommunity.id).order('joined_at',{ascending:true}),
      client.from('member_roles').select('user_id,role_id').eq('community_id',currentCommunity.id)
    ]);
    for (const response of [rolesResponse,membersResponse,assignmentsResponse]) {
      if (response.error) { showError(response.error,'No se pudo cargar la gestión de roles.'); return; }
    }
    communityRoles = rolesResponse.data || [];
    communityMembers = membersResponse.data || [];
    communityMemberRoles = assignmentsResponse.data || [];
    const roleList = $('#community-role-list');
    if (!communityRoles.length) {
      roleList.innerHTML = '<div class="empty-state compact">Todavía no hay roles.</div>';
    } else {
      roleList.innerHTML = communityRoles.map(role => {
        const permissionInputs = ROLE_PERMISSIONS.map(([key,label]) => `<label><input type="checkbox" data-role-permission="${key}" ${role.permissions?.[key] ? 'checked' : ''}> ${label}</label>`).join('');
        return `<form class="role-card" data-role-form="${role.id}">
          <div class="role-card-head"><span class="role-dot" style="background:${escapeHtml(role.color || '#a99bff')}"></span><input class="role-name-input" data-role-name maxlength="32" value="${escapeHtml(role.name)}" aria-label="Nombre del rol"><input type="color" data-role-color value="${/^#[0-9a-f]{6}$/i.test(role.color || '') ? role.color : '#a99bff'}" aria-label="Color del rol"></div>
          <div class="permission-grid">${permissionInputs}</div>
          <div class="role-card-actions"><button class="button button-secondary" type="submit">Guardar cambios</button><button class="button button-danger" type="button" data-delete-role="${role.id}">Eliminar</button></div>
        </form>`;
      }).join('');
    }
    const ids = communityMembers.map(member => member.user_id);
    const profiles = await fetchProfiles(ids);
    const memberList = $('#community-members-list');
    memberList.innerHTML = communityMembers.length ? communityMembers.map(member => {
      const person = profiles[member.user_id] || {username:'usuario',nickname:''};
      const active = new Set(communityMemberRoles.filter(item => item.user_id === member.user_id).map(item => item.role_id));
      const toggles = communityRoles.map(role => `<label class="member-role-toggle"><input type="checkbox" data-member-role="${role.id}" data-member-id="${member.user_id}" ${active.has(role.id) ? 'checked' : ''}><span style="color:${escapeHtml(role.color || '#a99bff')}">${escapeHtml(role.name)}</span></label>`).join('');
      return `<div class="member-role-card"><div class="member-role-person"><strong>${escapeHtml(member.nickname || person.nickname || person.username)}</strong><small>@${escapeHtml(person.username || 'usuario')}${member.user_id === currentCommunity.owner_id ? ' · propietario' : ''}</small></div><div class="member-role-toggles">${toggles || '<span class="muted">Crea un rol para poder asignarlo.</span>'}</div></div>`;
    }).join('') : '<div class="empty-state compact">No hay miembros.</div>';

    $$('[data-role-form]').forEach(form => form.addEventListener('submit', async event => {
      event.preventDefault();
      const roleId = form.dataset.roleForm;
      const permissions = {};
      $$('[data-role-permission]',form).forEach(input => permissions[input.dataset.rolePermission] = input.checked);
      const name = $('[data-role-name]',form).value.trim();
      const color = $('[data-role-color]',form).value;
      if (name.length < 2) { toast('El nombre del rol debe tener al menos 2 caracteres.','error'); return; }
      const {error} = await client.from('community_roles').update({name,color,permissions}).eq('id',roleId).eq('community_id',currentCommunity.id);
      if (error) showError(error,'No se pudo guardar el rol.'); else { toast('Rol actualizado.','success'); await loadCommunityManagement(); }
    }));
    $$('[data-delete-role]').forEach(button => button.addEventListener('click', async () => {
      const role = communityRoles.find(item => item.id === button.dataset.deleteRole);
      if (!role || !confirm(`¿Eliminar el rol «${role.name}» y quitarlo de los miembros?`)) return;
      const {error} = await client.from('community_roles').delete().eq('id',role.id).eq('community_id',currentCommunity.id);
      if (error) showError(error,'No se pudo eliminar el rol.'); else { toast('Rol eliminado.','success'); await loadCommunityManagement(); }
    }));
    $$('[data-member-role]').forEach(input => input.addEventListener('change', async () => {
      const payload = {community_id:currentCommunity.id,user_id:input.dataset.memberId,role_id:input.dataset.memberRole};
      const response = input.checked
        ? await client.from('member_roles').insert(payload)
        : await client.from('member_roles').delete().match(payload);
      if (response.error) { input.checked = !input.checked; showError(response.error,'No se pudo cambiar la asignación del rol.'); }
      else {
        if (input.checked) communityMemberRoles.push({user_id:payload.user_id,role_id:payload.role_id});
        else communityMemberRoles = communityMemberRoles.filter(item => !(item.user_id === payload.user_id && item.role_id === payload.role_id));
        messageIdentityCache.delete(`${currentCommunity.id}:${payload.user_id}`);
        toast('Asignación actualizada.','success');
      }
    }));
  }
  $('#community-role-create').addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentCommunity || !communityPermissions.manage_roles) return;
    const name = $('#new-role-name').value.trim();
    if (name.length < 2) { toast('El nombre del rol debe tener al menos 2 caracteres.','error'); return; }
    const permissions = {};
    $$('[data-new-role-perm]').forEach(input => permissions[input.dataset.newRolePerm] = input.checked);
    const {error} = await client.from('community_roles').insert({community_id:currentCommunity.id,name,color:$('#new-role-color').value,permissions,position:communityRoles.length});
    if (error) showError(error,'No se pudo crear el rol. Comprueba que no exista otro con ese nombre.');
    else {
      $('#community-role-create').reset();
      $('#new-role-color').value = '#a99bff';
      $('[data-new-role-perm="send_messages"]').checked = true;
      toast('Rol creado.','success');
      await loadCommunityManagement();
    }
  });

  // ---------- Community badge management ----------
  async function loadCommunityBadgeManagement() {
    if (!currentCommunity || !communityPermissions.manage_badges) return;
    const [badgesResponse,membersResponse,assignmentsResponse] = await Promise.all([
      client.from('badges').select('*').eq('community_id',currentCommunity.id).order('created_at',{ascending:true}),
      client.from('community_members').select('user_id,nickname').eq('community_id',currentCommunity.id).order('joined_at',{ascending:true}),
      client.from('member_badges').select('badge_id,user_id').eq('community_id',currentCommunity.id)
    ]);
    for (const response of [badgesResponse,membersResponse,assignmentsResponse]) {
      if (response.error) { showError(response.error,'No se pudo cargar la gestión de medallas.'); return; }
    }
    const badges = badgesResponse.data || [];
    const members = membersResponse.data || [];
    const assignments = assignmentsResponse.data || [];
    const profiles = await fetchProfiles(members.map(item => item.user_id));
    const list = $('#community-badges-list');
    if (!badges.length) {
      list.innerHTML = '<div class="empty-state compact">Todavía no hay medallas en este megagrupo.</div>';
      return;
    }
    list.innerHTML = badges.map(badge => {
      const icon = /^https:\/\//i.test(badge.icon_url || '')
        ? `<img class="badge-preview-image" src="${escapeHtml(badge.icon_url)}" alt="" loading="lazy">`
        : `<span class="badge-preview-emoji">${escapeHtml(badge.icon_url || '★')}</span>`;
      const holders = assignments.filter(item => item.badge_id === badge.id);
      const holderList = holders.map(item => {
        const person = profiles[item.user_id] || {username:'usuario'};
        return `<span class="badge-holder">@${escapeHtml(person.username)} <button type="button" title="Retirar medalla" data-remove-badge="${badge.id}" data-badge-member="${item.user_id}">×</button></span>`;
      }).join('') || '<span class="muted">Sin asignar</span>';
      const options = members.map(member => {
        const person = profiles[member.user_id] || {username:'usuario'};
        return `<option value="${member.user_id}">${escapeHtml(member.nickname || person.nickname || person.username)}</option>`;
      }).join('');
      return `<article class="badge-admin-card"><div class="badge-admin-head">${icon}<div><strong>${escapeHtml(badge.name)}</strong><small>${badge.animated ? 'Animada' : 'Estática'}</small></div></div><div class="badge-holders">${holderList}</div><form class="badge-assign-form" data-assign-badge="${badge.id}"><select data-badge-target aria-label="Miembro">${options}</select><button class="button button-secondary" type="submit" ${members.length ? '' : 'disabled'}>Asignar</button></form></article>`;
    }).join('');
    $$('[data-assign-badge]').forEach(form => form.addEventListener('submit', async event => {
      event.preventDefault();
      const badgeId = form.dataset.assignBadge;
      const userId = $('[data-badge-target]',form).value;
      if (!userId) return;
      const {error} = await client.from('member_badges').insert({badge_id:badgeId,user_id:userId,community_id:currentCommunity.id});
      if (error) showError(error,'No se pudo asignar la medalla.');
      else { messageIdentityCache.delete(`${currentCommunity.id}:${userId}`); toast('Medalla asignada.','success'); await loadCommunityBadgeManagement(); }
    }));
    $$('[data-remove-badge]').forEach(button => button.addEventListener('click', async () => {
      const {error} = await client.from('member_badges').delete().eq('badge_id',button.dataset.removeBadge).eq('user_id',button.dataset.badgeMember).eq('community_id',currentCommunity.id);
      if (error) showError(error,'No se pudo retirar la medalla.');
      else { messageIdentityCache.delete(`${currentCommunity.id}:${button.dataset.badgeMember}`); toast('Medalla retirada.','success'); await loadCommunityBadgeManagement(); }
    }));
  }
  $('#community-badge-create').addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentCommunity || !communityPermissions.manage_badges) return;
    const name = $('#new-badge-name').value.trim();
    const icon = $('#new-badge-icon').value.trim();
    if (name.length < 2 || !icon) { toast('Escribe un nombre y un icono para la medalla.','error'); return; }
    if (/^https?:\/\//i.test(icon) && !/^https:\/\//i.test(icon)) { toast('Los iconos externos deben usar HTTPS.','error'); return; }
    if (/^https:\/\//i.test(icon) && icon.length > 500) { toast('La URL del icono es demasiado larga.','error'); return; }
    if (/[<>"']/.test(icon) && !/^https:\/\//i.test(icon)) { toast('Usa un emoji o una URL HTTPS como icono.','error'); return; }
    const {error} = await client.from('badges').insert({owner_id:currentUser.id,community_id:currentCommunity.id,name,icon_url:icon,animated:$('#new-badge-animated').checked});
    if (error) showError(error,'No se pudo crear la medalla.');
    else {
      $('#community-badge-create').reset();
      messageIdentityCache.clear();
      toast('Medalla creada.','success');
      await loadCommunityBadgeManagement();
    }
  });

  function channelTypeLabel(type) {
    return ({text:'Texto',announcements:'Anuncios',voice:'Voz',media:'Solo multimedia'})[type] || 'Texto';
  }
  function channelTypeIcon(type) {
    return ({text:'#',announcements:'⚑',voice:'◖',media:'▧'})[type] || '#';
  }
  function openChannelEditor(channel = null) {
    if (!currentCommunity || !communityPermissions.manage_channels) return;
    $('#channel-editor-title').textContent = channel ? 'Editar canal' : 'Crear canal';
    $('#channel-edit-id').value = channel?.id || '';
    $('#channel-edit-name').value = channel?.name || '';
    $('#channel-edit-type').value = channel?.type || 'text';
    $('#channel-edit-description').value = channel?.description || '';
    $('#channel-edit-position').value = String(channel?.position ?? currentCommunityChannels.length);
    $('#channel-editor-dialog').showModal();
  }

  async function loadChannels() {
    if (!currentCommunity) return;
    const {data,error} = await client.from('channels').select('*').eq('community_id',currentCommunity.id).order('position',{ascending:true}).order('created_at',{ascending:true});
    if (error) { showError(error); return; }
    currentCommunityChannels = data || [];
    $('#community-channels-count').textContent = currentCommunityChannels.length;
    $('#add-channel').classList.toggle('hidden',!communityPermissions.manage_channels);
    $('#channel-list').innerHTML = currentCommunityChannels.map(channel => `<div class="channel-row"><button class="channel-item ${currentContext?.id === channel.id ? 'active' : ''}" data-channel="${channel.id}" title="${escapeHtml(channel.description || channelTypeLabel(channel.type))}"><span class="channel-hash">${channelTypeIcon(channel.type)}</span><span class="channel-item-name">${escapeHtml(channel.name)}</span><span class="channel-type-mini">${channel.type === 'text' ? '' : escapeHtml(channelTypeLabel(channel.type))}</span></button>${communityPermissions.manage_channels ? `<span class="channel-admin-actions"><button type="button" data-edit-channel="${channel.id}" title="Editar canal">✎</button><button type="button" data-delete-channel="${channel.id}" title="Eliminar canal">×</button></span>` : ''}</div>`).join('') || '<p class="muted channel-empty">Todavía no hay canales.</p>';
    $$('[data-channel]').forEach(button => button.addEventListener('click', () => {
      const channel = currentCommunityChannels.find(row => row.id === button.dataset.channel);
      if (channel) openCommunityChannel(channel);
    }));
    $$('[data-edit-channel]').forEach(button => button.addEventListener('click', () => {
      const channel = currentCommunityChannels.find(row => row.id === button.dataset.editChannel);
      if (channel) openChannelEditor(channel);
    }));
    $$('[data-delete-channel]').forEach(button => button.addEventListener('click', async () => {
      const channel = currentCommunityChannels.find(row => row.id === button.dataset.deleteChannel);
      if (!channel || !confirm(`¿Eliminar #${channel.name} y sus mensajes? Esta acción no se puede deshacer.`)) return;
      const {error:deleteError} = await client.from('channels').delete().eq('id',channel.id).eq('community_id',currentCommunity.id);
      if (deleteError) showError(deleteError,'No se pudo eliminar el canal.');
      else {
        if (currentContext?.id === channel.id) { currentContext = null; $('#conversation-panel').innerHTML = '<div class="welcome-state"><div class="welcome-orb">N</div><p class="eyebrow">BIENVENIDO A NEXUS</p><h2>Tu gente, tus espacios.</h2><p>Abre una conversación o crea una nueva para empezar.</p></div>'; }
        toast('Canal eliminado.','success');
        await loadChannels();
      }
    }));
  }

  $('#channel-editor-form').addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    if (!currentCommunity || !communityPermissions.manage_channels) return;
    const channelId = $('#channel-edit-id').value;
    const name = $('#channel-edit-name').value.trim().toLowerCase().replace(/\s+/g,'-');
    const type = $('#channel-edit-type').value;
    const description = $('#channel-edit-description').value.trim();
    const position = Number.parseInt($('#channel-edit-position').value,10);
    if (name.length < 1 || name.length > 70) { toast('El nombre debe tener entre 1 y 70 caracteres.','error'); return; }
    if (!['text','announcements','voice','media'].includes(type)) { toast('Tipo de canal no válido.','error'); return; }
    if (!Number.isInteger(position) || position < 0 || position > 500) { toast('La posición debe estar entre 0 y 500.','error'); return; }
    const payload = {community_id:currentCommunity.id,name,type,description,position};
    const response = channelId
      ? await client.from('channels').update({name,type,description,position}).eq('id',channelId).eq('community_id',currentCommunity.id)
      : await client.from('channels').insert(payload);
    if (response.error) { showError(response.error,'No se pudo guardar el canal. Comprueba tus permisos y que el nombre sea válido.'); return; }
    $('#channel-editor-dialog').close();
    toast(channelId ? 'Canal actualizado.' : 'Canal creado.','success');
    await loadChannels();
    if (channelId && currentContext?.id === channelId) {
      const updated = currentCommunityChannels.find(row => row.id === channelId);
      if (updated) await openCommunityChannel(updated);
    }
  });

  async function openCommunityChannel(channel) {
    replyTarget = null;
    if (channel.type === 'voice') {
      if (activeMessageChannel) { client.removeChannel(activeMessageChannel); activeMessageChannel = null; }
      currentContext = {type:'channel',id:channel.id,title:`◖ ${channel.name}`,subtitle:`${currentCommunity.name} · ${channelTypeLabel(channel.type)}`,channelType:channel.type,channelDescription:channel.description || ''};
      switchView('chats');
      await showMessagePanel();
      $$('.channel-item').forEach(button => button.classList.toggle('active',button.dataset.channel === channel.id));
      toast('El canal de voz está creado. La conexión WebRTC todavía no está integrada.');
      return;
    }
    currentContext = {type:'channel',id:channel.id,title:`${channelTypeIcon(channel.type)} ${channel.name}`,subtitle:currentCommunity.name,channelType:channel.type,channelDescription:channel.description || ''};
    switchView('chats');
    await showMessagePanel();
    if (channel.type === 'media') $('#message-input').placeholder = 'Este canal solo admite archivos…';
    await loadMessages();
    subscribeMessages();
    $$('.channel-item').forEach(button => button.classList.toggle('active',button.dataset.channel === channel.id));
  }
  $('#add-channel').addEventListener('click', () => openChannelEditor());
  $('#community-settings').addEventListener('click', () => {
    if (!currentCommunity || currentCommunity.owner_id !== currentUser.id) return;
    $('#community-edit-name').value = currentCommunity.name;
    $('#community-edit-description').value = currentCommunity.description || '';
    $('#community-edit-color').value = currentCommunity.name_color || '#a99bff';
    $('#community-edit-icon').value = currentCommunity.icon_url || '';
    $('#community-edit-banner').value = currentCommunity.banner_url || '';
    $('#community-edit-background').value = currentCommunity.background_url || '';
    $('#community-edit-css').value = currentCommunity.custom_css || '';
    $('#community-settings-dialog').showModal();
  });
  $('#community-settings-form').addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    if (!currentCommunity || currentCommunity.owner_id !== currentUser.id) { toast('Solo el propietario puede cambiar estos ajustes.','error'); return; }
    const name = $('#community-edit-name').value.trim();
    const description = $('#community-edit-description').value.trim();
    const nameColor = $('#community-edit-color').value;
    const iconUrlRaw = $('#community-edit-icon').value.trim();
    const bannerUrlRaw = $('#community-edit-banner').value.trim();
    const backgroundUrlRaw = $('#community-edit-background').value.trim();
    const iconUrl = safeHttpsUrl(iconUrlRaw);
    const bannerUrl = safeHttpsUrl(bannerUrlRaw);
    const backgroundUrl = safeHttpsUrl(backgroundUrlRaw);
    if (name.length < 2 || name.length > 60) { toast('El nombre debe tener entre 2 y 60 caracteres.','error'); return; }
    if ((iconUrlRaw && !iconUrl) || (bannerUrlRaw && !bannerUrl) || (backgroundUrlRaw && !backgroundUrl)) { toast('Las imágenes deben utilizar direcciones HTTPS válidas.','error'); return; }
    let customCss = '';
    try { customCss = sanitizeCommunityCss($('#community-edit-css').value); }
    catch (error) { toast(error.message,'error'); return; }
    const updates = {name,description,name_color:nameColor,icon_url:iconUrl || null,banner_url:bannerUrl || null,background_url:backgroundUrl || null,custom_css:customCss};
    const {error} = await client.from('communities').update(updates).eq('id',currentCommunity.id);
    if (error) showError(error,'No se pudieron guardar los ajustes del megagrupo.');
    else {
      Object.assign(currentCommunity,updates);
      $('#community-settings-dialog').close();
      await loadCommunities();
      await selectCommunity(currentCommunity);
      toast('Megagrupo actualizado.','success');
    }
  });
  $('#create-community-invite').addEventListener('click', async () => {
    if (!currentCommunity) return;
    const hoursRaw = await ask('Duración de invitación','Introduce horas (1-720).','Horas','168','168');
    if (hoursRaw === null) return;
    const hours = Number(hoursRaw);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) { toast('Introduce una duración entre 1 y 720 horas.','error'); return; }
    const {data:code,error} = await client.rpc('create_community_invite',{p_community_id:currentCommunity.id,p_expires_hours:hours,p_max_uses:0});
    if (error) { showError(error,'No se pudo crear la invitación. Ejecuta la migración v0.5 y revisa el permiso create_invites.'); return; }
    const inviteUrl = new URL(location.href); inviteUrl.searchParams.set('invite',code); inviteUrl.hash='';
    try { await navigator.clipboard.writeText(inviteUrl.toString()); toast('Invitación creada y enlace copiado.','success'); }
    catch { prompt('Copia este enlace de invitación:',inviteUrl.toString()); }
  });

  async function consumePendingCommunityInvite() {
    const url = new URL(location.href);
    const code = url.searchParams.get('invite');
    if (!code) return;
    url.searchParams.delete('invite');
    history.replaceState(null,'',url.pathname + url.search + url.hash);
    const {data:communityId,error} = await client.rpc('join_community_by_invite',{p_code:code});
    if (error) { showError(error,'No se pudo aceptar la invitación. Puede haber caducado o alcanzado su límite.'); return; }
    const {data:community, error:communityError} = await client.from('communities').select('*').eq('id',communityId).single();
    if (communityError) { showError(communityError); return; }
    await selectCommunity(community);
    toast(`Te has unido a ${community.name}.`,'success');
  }

  $('#add-alliance').addEventListener('click', async () => {
    if (!currentCommunity) return;
    const target = await ask('Solicitar alianza','Escribe el ID o el nombre exacto del megagrupo.','Megagrupo','Nombre o ID');
    if (!target) return;
    if (target === currentCommunity.id || target.toLowerCase() === currentCommunity.name.toLowerCase()) { toast('No puedes aliar un megagrupo consigo mismo.'); return; }
    let targetRow = null;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let targetId = null;
    let targetName = '';
    if (uuidPattern.test(target)) {
      // A private community intentionally cannot be discovered through SELECT.
      // Resolve the supplied ID inside a SECURITY DEFINER RPC instead.
      targetId = target;
      const {data:publicTarget} = await client.from('communities').select('name').eq('id',target).maybeSingle();
      targetName = publicTarget?.name || `megagrupo ${target.slice(0,8)}`;
    } else {
      const response = await client.from('communities').select('id,name').ilike('name',target).limit(2);
      if (response.error) { showError(response.error); return; }
      if (response.data?.length === 1) targetRow = response.data[0];
      else if (response.data?.length > 1) { toast('Hay varios megagrupos con ese nombre. Utiliza su ID para elegir el correcto.','error'); return; }
      if (!targetRow) { toast('No se ha encontrado un megagrupo público con ese nombre. Para uno privado, utiliza su ID.','error'); return; }
      targetId = targetRow.id;
      targetName = targetRow.name;
    }
    const {error} = await client.rpc('request_community_alliance',{p_source_community_id:currentCommunity.id,p_target_community_id:targetId});
    if (error) showError(error,'No se pudo enviar la solicitud. Comprueba que eres propietario y que no existe ya una solicitud.');
    else { toast(`Solicitud de alianza enviada a ${targetName}.`,'success'); loadAllies(); }
  });
  async function loadAllies() {
    if (!currentCommunity) return;
    // This RPC returns only communities linked to the current community by an
    // alliance request. It can therefore reveal the partner name/icon even if
    // that partner is private, without exposing private community discovery.
    const {data:links,error} = await client.rpc('get_community_alliances',{p_community_id:currentCommunity.id});
    if (error) { console.warn('No se pudieron cargar las alianzas:',error); return; }
    const rows = links || [];
    const accepted = rows.filter(row=>row.status === 'accepted');
    const incoming = rows.filter(row=>row.status === 'pending' && row.direction === 'incoming');
    const outgoing = rows.filter(row=>row.status === 'pending' && row.direction === 'outgoing');
    const acceptedMarkup = accepted.map(row => `<button class="channel-item" data-ally="${row.partner_id}"><span class="channel-hash">◇</span>${escapeHtml(row.partner_name)}</button>`).join('');
    const canAccept = currentCommunity.owner_id === currentUser.id;
    const incomingMarkup = incoming.map(row => `<div class="alliance-request"><span>${escapeHtml(row.partner_name || 'Otro megagrupo')}</span>${canAccept ? `<button class="button button-primary" data-accept-alliance="${row.request_id}">Aceptar</button><button class="button button-secondary" data-decline-alliance="${row.request_id}">Rechazar</button>` : '<span class="tag">Pendiente</span>'}</div>`).join('');
    const outgoingMarkup = outgoing.map(row => `<div class="alliance-request"><span>${escapeHtml(row.partner_name || 'Otro megagrupo')}</span><span class="tag">Solicitud enviada</span></div>`).join('');
    $('#allied-list').innerHTML = `${incomingMarkup}${outgoingMarkup}${acceptedMarkup}` || '<p class="muted" style="font-size:10px;padding:0 10px">Sin alianzas todavía.</p>';
    $$('[data-ally]').forEach(button => button.addEventListener('click', async () => {
      const targetId = button.dataset.ally;
      const {error:joinError} = await client.rpc('join_allied_community',{p_source_community_id:currentCommunity.id,p_target_community_id:targetId});
      if (joinError) { showError(joinError,'No se pudo entrar al megagrupo aliado. Ejecuta la migración v0.5.'); return; }
      // Joining first grants member-level SELECT access, including for a private ally.
      const {data:community,error:communityError} = await client.from('communities').select('*').eq('id',targetId).single();
      if (communityError || !community) { showError(communityError || new Error('Te has unido, pero no se pudo cargar el megagrupo.')); return; }
      selectCommunity(community);
    }));
    $$('[data-accept-alliance]').forEach(button => button.addEventListener('click', async () => {
      const {error:acceptError} = await client.from('alliance_requests').update({status:'accepted'}).eq('id',button.dataset.acceptAlliance).eq('target_community_id',currentCommunity.id);
      if (acceptError) showError(acceptError,'No se pudo aceptar la alianza.'); else {toast('Alianza aceptada.','success');loadAllies();}
    }));
    $$('[data-decline-alliance]').forEach(button => button.addEventListener('click', async () => {
      const {error:declineError} = await client.from('alliance_requests').update({status:'declined'}).eq('id',button.dataset.declineAlliance).eq('target_community_id',currentCommunity.id);
      if (declineError) showError(declineError,'No se pudo rechazar la solicitud.'); else {toast('Solicitud rechazada.');loadAllies();}
    }));
  }

  // ---------- Profile and client settings ----------
  function fillProfileForm() {
    if (!profile) return;
    $('#profile-nickname').value = profile.nickname || '';
    $('#profile-pronouns').value = profile.pronouns || '';
    $('#profile-bio').value = profile.bio || '';
    $('#profile-color').value = profile.default_name_color || '#a99bff';
    $('#profile-aliases').value = (profile.aliases || []).join(', ');
  }
  $('#profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const aliases = [...new Set($('#profile-aliases').value.split(',').map(value => value.trim()).filter(Boolean))].slice(0,10);
    if (aliases.some(value => value.length > 24)) { toast('Cada alias admite un máximo de 24 caracteres.','error'); return; }
    const patch = {nickname:$('#profile-nickname').value.trim(),pronouns:$('#profile-pronouns').value.trim(),bio:$('#profile-bio').value.trim(),default_name_color:$('#profile-color').value,aliases};
    const {error} = await client.from('profiles').update(patch).eq('id',currentUser.id);
    if (error) { showError(error); return; }
    Object.assign(profile,patch); renderIdentity(); toast('Perfil actualizado.','success');
  });

  function renderProfileWidgets() {
    const list = $('#profile-widgets-list');
    if (!list) return;
    const widgets = Array.isArray(profile?.widgets) ? profile.widgets.slice(0,10) : [];
    list.innerHTML = '';
    if (!widgets.length) {
      const empty = document.createElement('p'); empty.className = 'muted small-muted';
      empty.textContent = 'Todavía no has creado widgets para tu perfil.'; list.append(empty);
    }
    widgets.forEach((widget,index) => {
      const card = document.createElement('article'); card.className = 'profile-widget-card';
      const banner = document.createElement('div'); banner.className = 'profile-widget-banner';
      const bannerValue = String(widget.banner || '');
      if (/^#[0-9a-f]{6}$/i.test(bannerValue)) banner.style.background = bannerValue;
      else if (safeHttpsUrl(bannerValue)) banner.style.backgroundImage = `linear-gradient(#11182755,#11182799),url("${safeHttpsUrl(bannerValue).replace(/["\\]/g,'')}")`;
      else banner.style.background = 'linear-gradient(120deg,#34304f,#252e43)';
      const icon = document.createElement('span'); icon.className = 'profile-widget-icon';
      const iconValue = String(widget.icon || '✦');
      if (safeHttpsUrl(iconValue)) { const image = document.createElement('img'); image.src = safeHttpsUrl(iconValue); image.alt = ''; image.loading = 'lazy'; icon.append(image); }
      else icon.textContent = iconValue.slice(0,8);
      const title = document.createElement('strong'); title.textContent = widget.title || 'Widget';
      const desc = document.createElement('p'); desc.textContent = widget.description || '';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-danger'; remove.textContent = 'Eliminar';
      remove.addEventListener('click', async () => {
        const next = widgets.filter((_,i) => i !== index);
        const {error} = await client.from('profiles').update({widgets:next}).eq('id',currentUser.id);
        if (error) showError(error,'No se pudo eliminar el widget.');
        else { profile.widgets=next; renderProfileWidgets(); toast('Widget eliminado.','success'); }
      });
      card.append(banner,icon,title,desc,remove); list.append(card);
    });
    const count = $('#profile-widget-count'); if (count) count.textContent = `${widgets.length}/10`;
  }

  $('#profile-widget-form').addEventListener('submit', async event => {
    event.preventDefault();
    const widgets = Array.isArray(profile?.widgets) ? [...profile.widgets] : [];
    if (widgets.length >= 10) { toast('Tu perfil ya tiene el máximo de 10 widgets.','error'); return; }
    const title = $('#widget-title').value.trim();
    const description = $('#widget-description').value.trim();
    const icon = $('#widget-icon').value.trim() || '✦';
    const banner = $('#widget-banner').value.trim() || '#34304f';
    if (title.length < 1 || title.length > 50 || description.length > 220) { toast('Revisa el título o la descripción del widget.','error'); return; }
    if (icon.length > 300 || (icon.startsWith('http') && !safeHttpsUrl(icon))) { toast('El icono debe ser un emoji o una URL HTTPS.','error'); return; }
    if (!/^#[0-9a-f]{6}$/i.test(banner) && !safeHttpsUrl(banner)) { toast('El banner debe ser un color HEX o una URL HTTPS.','error'); return; }
    widgets.push({id:crypto.randomUUID(),title,description,icon,banner});
    const {error} = await client.from('profiles').update({widgets}).eq('id',currentUser.id);
    if (error) { showError(error,'No se pudo guardar el widget.'); return; }
    profile.widgets = widgets; $('#profile-widget-form').reset(); $('#widget-banner').value='#34304f'; renderProfileWidgets();
    toast('Widget añadido a tu perfil.','success');
  });

  async function fillCommunityNickname() {
    const panel = $('#community-nickname-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', !currentCommunity);
    if (!currentCommunity) return;
    const {data,error} = await client.from('community_members').select('nickname')
      .eq('community_id',currentCommunity.id).eq('user_id',currentUser.id).maybeSingle();
    if (error) { console.warn('No se pudo cargar el nickname del megagrupo:',error); return; }
    $('#profile-community-nickname').value = data?.nickname || '';
    $('#profile-community-name').textContent = currentCommunity.name;
  }

  $('#save-community-nickname').addEventListener('click', async () => {
    if (!currentCommunity) { toast('Selecciona primero un megagrupo.'); return; }
    const nickname = $('#profile-community-nickname').value.trim();
    if (nickname.length > 40) { toast('El nickname admite un máximo de 40 caracteres.','error'); return; }
    const {error} = await client.from('community_members').update({nickname: nickname || null})
      .eq('community_id',currentCommunity.id).eq('user_id',currentUser.id);
    if (error) { showError(error,'No se pudo guardar el nickname. Ejecuta la migración v0.5.'); return; }
    messageIdentityCache.clear(); toast('Nickname del megagrupo actualizado.','success');
  });

  async function uploadProfileImage(file, kind) {
    if (!file) return;
    if (file.size > 8*1024*1024 || !file.type.startsWith('image/')) { toast('Usa una imagen de máximo 8 MB.','error'); return; }
    const ext = file.name.split('.').pop().replace(/[^a-z0-9]/gi,'').slice(0,8) || 'png';
    const path = `${currentUser.id}/${kind}-${Date.now()}.${ext}`;
    const {error:uploadError} = await client.storage.from('profile-media').upload(path,file,{contentType:file.type,upsert:false});
    if (uploadError) { showError(uploadError); return; }
    const {data} = client.storage.from('profile-media').getPublicUrl(path);
    const field = kind === 'avatar' ? 'avatar_url' : 'banner_url';
    const {error} = await client.from('profiles').update({[field]:data.publicUrl}).eq('id',currentUser.id);
    if (error) showError(error); else { profile[field] = data.publicUrl; renderIdentity(); toast('Imagen actualizada.','success'); }
  }
  $('#profile-avatar-file').addEventListener('change',event => uploadProfileImage(event.target.files?.[0],'avatar'));
  $('#profile-banner-file').addEventListener('change',event => uploadProfileImage(event.target.files?.[0],'banner'));
  function fillSettingsForm() {
    const settings = profile?.settings || {};
    $('#setting-accent').value = settings.accent || '#8d7cff';
    $('#setting-density').value = settings.density || 'comfortable';
    $('#setting-background').value = settings.background || '';
  }
  $('#settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    const settings = {accent:$('#setting-accent').value,density:$('#setting-density').value,background:$('#setting-background').value.trim()};
    const {error} = await client.from('profiles').update({settings}).eq('id',currentUser.id);
    if (error) showError(error); else { profile.settings = settings; renderIdentity(); toast('Apariencia guardada.','success'); }
  });
  $('#change-password').addEventListener('click', async () => {
    const {error} = await client.auth.resetPasswordForEmail(currentUser.email,{redirectTo:`${location.origin}${location.pathname}`});
    if (error) showError(error); else toast('Enlace de recuperación enviado a tu correo.','success');
  });

  // ---------- Workshop ----------
  $('#publish-preset').addEventListener('click', publishPreset);
  async function loadPresets() {
    const {data,error} = await client.from('presets').select('id,name,description,preset_type,config,owner_id,created_at').eq('is_public',true).order('created_at',{ascending:false}).limit(60);
    if (error) { console.warn(error); return; }
    const ownerMap = await fetchProfiles((data || []).map(row => row.owner_id));
    $('#preset-grid').innerHTML = data?.length ? data.map(row => `<article class="preset-card"><div class="preset-swatch" style="background:linear-gradient(125deg,${escapeHtml(row.config?.accent || '#8d7cff')},#252d42)"></div><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.description || 'Sin descripción.')}</p><small class="muted">${escapeHtml(row.preset_type)} · @${escapeHtml(ownerMap[row.owner_id]?.username || 'usuario')}</small><br><button class="button button-secondary" data-apply-preset="${row.id}">Aplicar preset</button></article>`).join('') : '<div class="empty-state">Todavía no hay presets publicados. Puedes ser la primera persona en compartir uno.</div>';
    $$('[data-apply-preset]').forEach(button => button.addEventListener('click', async () => {
      const row = data.find(item => item.id === button.dataset.applyPreset);
      const settings = {...(profile.settings || {}),...row.config};
      const {error:saveError} = await client.from('profiles').update({settings}).eq('id',currentUser.id);
      if (saveError) showError(saveError); else {profile.settings=settings;renderIdentity();toast('Preset aplicado.','success');}
    }));
  }
  async function publishPreset() {
    const name = await ask('Publicar preset','Se compartirá tu color de acento y tus preferencias básicas, no contraseñas ni datos privados.','Nombre','Mi tema');
    if (!name) return;
    const description = await ask('Descripción','Explica brevemente qué aspecto tiene.','Descripción','Un tema oscuro violeta.');
    const config = {accent:profile.settings?.accent || '#8d7cff',density:profile.settings?.density || 'comfortable'};
    const {error} = await client.from('presets').insert({owner_id:currentUser.id,name,description:description || '',preset_type:'client',config,is_public:true});
    if (error) showError(error); else {toast('Preset publicado.','success');loadPresets();}
  }

  // ---------- Administration ----------
  async function checkAdmin() {
    const {data,error} = await client.rpc('is_admin');
    if (error) { console.warn('Admin RPC:',error.message); return; }
    isAdmin = Boolean(data);
    $('#admin-area').classList.toggle('hidden',!isAdmin);
  }
  $('#admin-search-button').addEventListener('click', searchAdminUsers);
  $('#admin-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchAdminUsers();}});
  async function searchAdminUsers() {
    if (!isAdmin) return;
    const term = $('#admin-search').value.trim().replace(/^@/,'');
    if (!term) return;
    const {data,error} = await client.from('profiles').select('id,username,nickname,avatar_url').ilike('username',`%${term}%`).limit(20);
    if (error) { showError(error); return; }
    $('#admin-results').innerHTML = data?.length ? data.map(person => personRow(person, `<button class="button button-danger" data-ban="${person.id}">Banear</button><button class="button button-secondary" data-reset="${person.id}">Reset</button><button class="button button-secondary" data-unban="${person.id}">Desbanear</button>`)).join('') : '<div class="empty-state compact">No se han encontrado usuarios.</div>';
    $$('[data-ban]').forEach(button => button.addEventListener('click',()=>adminBan(button.dataset.ban)));
    $$('[data-unban]').forEach(button => button.addEventListener('click',()=>adminUnban(button.dataset.unban)));
    $$('[data-reset]').forEach(button => button.addEventListener('click',()=>adminReset(button.dataset.reset)));
  }
  async function adminBan(target) {
    const raw = await ask('Banear cuenta','Introduce horas. Deja vacío para un ban permanente.','Duración en horas','24');
    if (raw === null) return;
    const hours = raw === '' ? null : Number(raw);
    if (hours !== null && (!Number.isInteger(hours) || hours < 1 || hours > 87600)) { toast('Introduce horas válidas (1 a 87600), o deja el campo vacío.','error'); return; }
    const reason = await ask('Motivo del ban','Este motivo quedará registrado para el equipo de moderación.','Motivo','Incumplimiento de las normas.');
    const {error} = await client.rpc('admin_ban_user',{p_target:target,p_reason:reason || '',p_hours:hours});
    if (error) showError(error,'No se pudo aplicar el ban.'); else toast('Cuenta baneada.','success');
  }
  async function adminUnban(target) {
    const {error} = await client.rpc('admin_unban_user',{p_target:target});
    if (error) showError(error); else toast('Ban retirado.','success');
  }
  async function adminReset(target) {
    const {data,error} = await client.functions.invoke('admin-send-reset',{body:{targetUserId:target}});
    if (error) { showError(error,'No se pudo enviar la recuperación. Configura la función y el proveedor de correo según README.md.'); return; }
    toast(data?.message || 'Correo de recuperación enviado.','success');
  }

  // ---------- Community navigation / initial page data ----------
  async function loadInitialDataSafe() {
    try { await loadPresets(); } catch (error) { console.warn(error); }
  }

  // Additional actions and welcome shortcuts.
  $('#create-community-shortcut').title = 'Crear un megagrupo';
  document.addEventListener('visibilitychange', () => { if (!document.hidden && currentUser && currentContext) loadMessages(); });

  // Replace the initial data loader after all module functions are defined.
  const originalLoadInitialData = loadInitialData;
  loadInitialData = async function() {
    await originalLoadInitialData();
    await loadInitialDataSafe();
  };

  // Helpful inline formatting shortcuts.
  $('#message-template').setAttribute('aria-hidden','true');
})();
