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
  let conversations = [];
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
      loadInitialData();
    } catch (error) {
      showError(error, 'No se pudo cargar el perfil. Ejecuta primero supabase/schema.sql.');
    }
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    currentUser = null; profile = null; currentContext = null;
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
    if (view === 'profile') fillProfileForm();
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

  // ---------- Conversations and realtime messages ----------
  async function loadConversations() {
    if (!currentUser) return;
    const {data: memberships, error: memberError} = await client.from('conversation_members').select('conversation_id,personal_name').eq('user_id', currentUser.id);
    if (memberError) throw memberError;
    const ids = [...new Set((memberships || []).map(row => row.conversation_id))];
    if (!ids.length) {
      conversations = [];
      $('#conversation-list').innerHTML = '<div class="empty-state compact">Todavía no tienes conversaciones.<br>Empieza añadiendo amigos.</div>';
      $('#dm-count').textContent = '';
      return;
    }
    const {data: rows, error} = await client.from('conversations').select('*').in('id', ids).order('updated_at', {ascending:false});
    if (error) throw error;
    const {data: participants} = await client.from('conversation_members').select('conversation_id,user_id,personal_name').in('conversation_id', ids);
    const otherIds = [...new Set((participants || []).filter(m => m.user_id !== currentUser.id).map(m => m.user_id))];
    const otherProfiles = await fetchProfiles(otherIds);
    conversations = (rows || []).map(row => {
      const members = (participants || []).filter(member => member.conversation_id === row.id);
      const other = members.find(member => member.user_id !== currentUser.id);
      const otherProfile = other ? otherProfiles[other.user_id] : null;
      const mine = members.find(member => member.user_id === currentUser.id);
      const title = mine?.personal_name || row.title || (row.kind === 'direct' ? (otherProfile?.nickname || otherProfile?.username || 'Mensaje directo') : 'Grupo sin nombre');
      const avatar = row.icon_url || (row.kind === 'direct' ? otherProfile?.avatar_url : null);
      return {...row, displayTitle:title, displayAvatar:avatar};
    });
    $('#dm-count').textContent = conversations.length || '';
    $('#conversation-list').innerHTML = conversations.map(row => `
      <button class="conversation-item ${currentContext?.id === row.id ? 'active' : ''}" data-conversation="${row.id}">
        <span class="avatar" ${avatarStyle(row.displayAvatar)}>${row.displayAvatar ? '' : escapeHtml(initials(row.displayTitle))}</span>
        <span class="conversation-copy"><strong>${escapeHtml(row.displayTitle)}</strong><small>${row.kind === 'direct' ? 'Mensaje directo' : 'Grupo'}</small></span>
      </button>`).join('');
    $$('[data-conversation]').forEach(button => button.addEventListener('click', () => {
      const row = conversations.find(item => item.id === button.dataset.conversation);
      if (row) openConversation(row);
    }));
  }

  async function openConversation(row) {
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
        <div class="messages" id="messages-container"><div class="empty-state compact">Cargando mensajes…</div></div>
        ${voiceNotice ? '<div class="voice-placeholder"><strong>Canal de voz</strong><p>Este canal ya está creado y tiene su propio tipo. La conexión de audio en tiempo real se añadirá en una fase WebRTC independiente.</p></div>' : `
        <div class="composer-wrap ${readOnly ? 'composer-readonly' : ''} ${mediaOnly ? 'composer-media-only' : ''}">
          <div class="composer-tools"><button id="attach-file" ${readOnly ? 'disabled' : ''}>＋ Archivo</button>${mediaOnly ? '' : `<button id="create-poll" ${readOnly ? 'disabled' : ''}>▤ Encuesta</button><button id="insert-bold" ${readOnly ? 'disabled' : ''}><b>B</b></button><button id="insert-italic" ${readOnly ? 'disabled' : ''}><i>I</i></button><button id="insert-code" ${readOnly ? 'disabled' : ''}>&lt;/&gt;</button>`}<input id="chat-file" class="upload-input" type="file" accept="image/*,video/*,.pdf,.txt,.zip"></div>
          <form class="composer" id="message-form"><textarea id="message-input" rows="1" maxlength="12000" placeholder="${mediaOnly ? 'Este canal solo admite archivos…' : announcementLocked ? 'Publicar anuncios requiere un permiso…' : 'Escribe un mensaje… (Markdown disponible)'}" ${mediaOnly || readOnly ? 'disabled' : ''}></textarea><button class="composer-send" type="submit" aria-label="Enviar" ${mediaOnly || readOnly ? 'disabled' : ''}>➤</button></form><div class="composer-hint">${composerHint}</div>
        </div>`}
      </div>`;
    if (!voiceNotice) {
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

  function wrapSelection(mark) {
    const input = $('#message-input');
    const start = input.selectionStart, end = input.selectionEnd;
    const selected = input.value.slice(start, end);
    input.setRangeText(`${mark}${selected || 'texto'}${mark}`, start, end, 'select');
    input.focus();
  }

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
    container.innerHTML = '';
    if (!data?.length) container.innerHTML = '<div class="empty-state compact">Este espacio está tranquilo. Envía el primer mensaje.</div>';
    const profiles = await fetchProfiles((data || []).map(row => row.sender_id));
    for (const message of (data || [])) await appendMessage(message, profiles[message.sender_id]);
    container.scrollTop = container.scrollHeight;
  }

  async function getMessageIdentity(senderId) {
    const communityId = currentContext?.type === 'channel' ? currentCommunity?.id : null;
    const key = `${communityId || 'personal'}:${senderId}`;
    if (messageIdentityCache.has(key)) return messageIdentityCache.get(key);
    const result = {roles:[],badges:[]};
    try {
      if (communityId) {
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

  async function appendMessage(message, sender) {
    const container = $('#messages-container');
    if (!container || $(`[data-message-id="${message.id}"]`, container)) return;
    const template = $('#message-template').content.cloneNode(true);
    const article = $('.message', template);
    article.dataset.messageId = message.id;
    const avatar = $('.avatar-message', article);
    if (sender?.avatar_url) avatar.style.backgroundImage = `url('${sender.avatar_url}')`;
    else avatar.textContent = initials(sender?.nickname || sender?.username || 'U');
    const author = $('.message-author', article);
    author.textContent = sender?.nickname || sender?.username || 'Usuario';
    if (sender?.default_name_color) author.style.color = sender.default_name_color;
    const identity = await getMessageIdentity(message.sender_id);
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
    $('time', article).textContent = dateLabel(message.created_at);
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
      $('.message-meta',article).append(deleteButton);
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
    container.append(template);
    container.scrollTop = container.scrollHeight;
  }

  function subscribeMessages() {
    if (activeMessageChannel) client.removeChannel(activeMessageChannel);
    if (!currentContext) return;
    const field = currentContext.type === 'conversation' ? 'conversation_id' : 'channel_id';
    activeMessageChannel = client.channel(`nexus-${currentContext.type}-${currentContext.id}`)
      .on('postgres_changes', {event:'INSERT',schema:'public',table:'messages',filter:`${field}=eq.${currentContext.id}`}, async payload => {
        const profiles = await fetchProfiles([payload.new.sender_id]);
        await appendMessage(payload.new, profiles[payload.new.sender_id]);
      })
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
    const payload = {sender_id:currentUser.id, body};
    payload[currentContext.type === 'conversation' ? 'conversation_id' : 'channel_id'] = currentContext.id;
    const {error} = await client.from('messages').insert(payload);
    input.disabled = false;
    if (error) { showError(error, 'No se pudo enviar el mensaje.'); return; }
    input.value = '';
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
        attachment:{path,name:file.name || 'archivo',mimetype:file.type || 'application/octet-stream'}
      };
      payload[isConversation ? 'conversation_id' : 'channel_id'] = currentContext.id;
      const {error: messageError} = await client.from('messages').insert(payload);
      if (messageError) {
        // Avoid leaving an inaccessible object behind when its message cannot be created.
        await storage.remove([path]);
        uploaded = false;
        throw new Error(`El archivo se subió, pero no se pudo publicar el mensaje: ${messageError.message}`);
      }
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
    if (currentContext.type === 'channel' && currentContext.channelType === 'announcements' && !communityPermissions.post_announcements) { toast('Necesitas el permiso Publicar anuncios.','error'); return; }
    const raw = await ask('Crear encuesta','Escribe la pregunta y dos o más opciones separadas por |.','Pregunta y opciones','¿Qué hacemos? | Opción A | Opción B');
    if (!raw) return;
    const parts = raw.split('|').map(value => value.trim()).filter(Boolean);
    if (parts.length < 3) { toast('Incluye una pregunta y al menos dos opciones.','error'); return; }
    const payload = {sender_id:currentUser.id,body:`📊 ${parts[0]}`,message_type:'poll'};
    payload[currentContext.type === 'conversation' ? 'conversation_id' : 'channel_id'] = currentContext.id;
    const {data: message, error} = await client.from('messages').insert(payload).select().single();
    if (error) { showError(error); return; }
    const {error: pollError} = await client.from('polls').insert({message_id:message.id,question:parts[0],options:parts.slice(1),ends_at:null});
    if (pollError) showError(pollError); else { await loadMessages(); toast('Encuesta publicada.','success'); }
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
  $('#add-alliance').addEventListener('click', async () => {
    if (!currentCommunity) return;
    const target = await ask('Solicitar alianza','Pega el ID del megagrupo con el que quieres aliarte.','ID del megagrupo','xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    if (!target) return;
    if (target === currentCommunity.id) { toast('No puedes aliar un megagrupo consigo mismo.'); return; }
    const {error} = await client.from('alliance_requests').insert({source_community_id:currentCommunity.id,target_community_id:target,status:'pending'});
    if (error) showError(error,'No se pudo enviar la solicitud. Comprueba el ID y tus permisos.'); else toast('Solicitud de alianza enviada.','success');
  });
  async function loadAllies() {
    if (!currentCommunity) return;
    const {data:accepted,error} = await client.from('alliance_requests').select('*').eq('status','accepted').or(`source_community_id.eq.${currentCommunity.id},target_community_id.eq.${currentCommunity.id}`);
    if (error) { console.warn(error); return; }
    const {data:pending,error:pendingError} = await client.from('alliance_requests').select('*').eq('target_community_id',currentCommunity.id).eq('status','pending');
    if (pendingError) console.warn(pendingError);
    const ids = [
      ...(accepted || []).map(row => row.source_community_id === currentCommunity.id ? row.target_community_id : row.source_community_id),
      ...(pending || []).map(row => row.source_community_id)
    ];
    const {data:partners} = ids.length ? await client.from('communities').select('id,name').in('id',[...new Set(ids)]) : {data:[]};
    const partnerMap = Object.fromEntries((partners || []).map(row => [row.id,row]));
    const acceptedMarkup = (accepted || []).map(row => {
      const id = row.source_community_id === currentCommunity.id ? row.target_community_id : row.source_community_id;
      const partner = partnerMap[id];
      return partner ? `<button class="channel-item" data-ally="${id}"><span class="channel-hash">◇</span>${escapeHtml(partner.name)}</button>` : '';
    }).join('');
    const canAccept = currentCommunity.owner_id === currentUser.id;
    const pendingMarkup = (pending || []).map(row => `<div class="alliance-request"><span>${escapeHtml(partnerMap[row.source_community_id]?.name || 'Otro megagrupo')}</span>${canAccept ? `<button class="button button-primary" data-accept-alliance="${row.id}">Aceptar</button>` : '<span class="tag">Pendiente</span>'}</div>`).join('');
    $('#allied-list').innerHTML = `${pendingMarkup}${acceptedMarkup}` || '<p class="muted" style="font-size:10px;padding:0 10px">Sin alianzas todavía.</p>';
    $$('[data-ally]').forEach(button => button.addEventListener('click', async () => {
      const {data:community} = await client.from('communities').select('*').eq('id',button.dataset.ally).single();
      if (!community) return;
      // The alliance grants discovery; each account still joins the public community explicitly.
      const {error:joinError} = await client.from('community_members').insert({community_id:community.id,user_id:currentUser.id});
      if (joinError && !String(joinError.message).includes('duplicate')) { showError(joinError,'No se pudo entrar al megagrupo aliado.'); return; }
      selectCommunity(community);
    }));
    $$('[data-accept-alliance]').forEach(button => button.addEventListener('click', async () => {
      const {error:acceptError} = await client.from('alliance_requests').update({status:'accepted'}).eq('id',button.dataset.acceptAlliance).eq('target_community_id',currentCommunity.id);
      if (acceptError) showError(acceptError,'No se pudo aceptar la alianza.'); else {toast('Alianza aceptada.','success');loadAllies();}
    }));
  }

  // ---------- Profile and client settings ----------
  function fillProfileForm() {
    if (!profile) return;
    $('#profile-nickname').value = profile.nickname || '';
    $('#profile-pronouns').value = profile.pronouns || '';
    $('#profile-bio').value = profile.bio || '';
    $('#profile-color').value = profile.default_name_color || '#a99bff';
  }
  $('#profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const patch = {nickname:$('#profile-nickname').value.trim(),pronouns:$('#profile-pronouns').value.trim(),bio:$('#profile-bio').value.trim(),default_name_color:$('#profile-color').value};
    const {error} = await client.from('profiles').update(patch).eq('id',currentUser.id);
    if (error) { showError(error); return; }
    Object.assign(profile,patch); renderIdentity(); toast('Perfil actualizado.','success');
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
