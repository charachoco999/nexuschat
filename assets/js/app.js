/* Nexus front-end. The database rules in supabase/schema.sql are the security boundary. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const cfg = window.NEXUS_CONFIG || {};
  const hasConfig = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes('TU-PROYECTO') && !cfg.SUPABASE_ANON_KEY.includes('TU-PUBLISHABLE'));
  const client = hasConfig ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const authHashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const authQueryParams = new URLSearchParams(location.search);
  let recoveryMode = authHashParams.get('type') === 'recovery' || authQueryParams.get('recovery') === '1';
  const PENDING_INVITE_KEY = 'nexus-pending-community-invite';
  const readPendingInvite = () => { try { return localStorage.getItem(PENDING_INVITE_KEY); } catch { return null; } };
  const savePendingInvite = code => { try { localStorage.setItem(PENDING_INVITE_KEY, code); } catch {} };
  const clearPendingInvite = () => { try { localStorage.removeItem(PENDING_INVITE_KEY); } catch {} };
  const inviteCodeFromUrl = new URL(location.href).searchParams.get('invite');
  if (inviteCodeFromUrl && /^[A-F0-9]{12}$/i.test(inviteCodeFromUrl)) savePendingInvite(inviteCodeFromUrl.toUpperCase());

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
  let activeAltProfile = null;
  let messageNotificationChannel = null;
  let notificationAudioContext = null;
  let notificationItems = [];
  const notificationSeenIds = new Set();
  const mentionCandidateCache = new Map();
  const customEmojiCache = new Map();
  let customEmojiCacheKey = '';
  let assetPickerType = 'sticker';
  let voiceSession = null;
  let serviceWorkerRegistration = null;
  let pushEnabledLocal = false;
  let globalPresenceChannel = null;
  const onlineUserIds = new Set();
  const unreadCounts = new Map();
  let contextPresenceMembers = [];
  const STANDARD_EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','🥲','😊','😍','🥰','😘','😎','🤔','🫡','😭','😡','😴','🤯','🥳','🤩','🙃','😇','🙏','👏','👍','👎','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','🔥','✨','⭐','🌟','🎉','🎊','💯','🚀','💡','💻','🎮','🐱','🐶','🌈','☀️','🌙','🍀','🍕','🍪','☕'];
  const MESSAGE_PAGE_SIZE = 50;
  const MESSAGE_CACHE_LIMIT = 200;
  const MESSAGE_CACHE_CONTEXTS = 12;
  const messageCache = new Map();
  let oldestMessageTimestamp = null;
  let oldestMessageId = null;
  let hasOlderMessages = false;
  let loadingOlderMessages = false;
  let typingStopTimer = null;
  let lastTypingBroadcastAt = 0;
  let localTypingActive = false;
  const typingUsers = new Map();

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
  const avatarMarkup = (p, extra = '') => {
    const photo=safeHttpsUrl(p?.avatar_url);
    const effect=safeHttpsUrl(p?.profile_effect_url);
    const frame=safeHttpsUrl(p?.profile_frame_url);
    const styles=[];
    if(photo) styles.push(`background-image:url('${photo.replace(/["\\]/g,'')}')`,'color:transparent');
    if(effect) styles.push(`--profile-effect-image:url('${effect.replace(/["\\]/g,'')}')`);
    if(frame) styles.push(`--profile-frame-image:url('${frame.replace(/["\\]/g,'')}')`);
    const classes=[ 'avatar', extra, effect?'avatar-effect':'', frame?'avatar-frame':'' ].filter(Boolean).join(' ');
    return `<span class="${classes}" ${styles.length?`style="${styles.join(';')}"`:''}>${photo?'':escapeHtml(initials(p?.nickname || p?.username || '?'))}</span>`;
  };
  function applyProfileFrame(node, person) {
    if(!node) return;
    const frame=safeHttpsUrl(person?.profile_frame_url);
    node.classList.toggle('avatar-frame',Boolean(frame));
    if(frame) node.style.setProperty('--profile-frame-image',`url("${frame.replace(/["\\]/g,'')}")`);
    else node.style.removeProperty('--profile-frame-image');
  }
  const profilePlateOpacity = settings => {
    const value=Number(settings?.profilePlateOpacity);
    return Number.isFinite(value) ? Math.max(0,Math.min(.6,value)) : .13;
  };
  function applyProfilePlate(node, person) {
    if(!node) return;
    const url=safeHttpsUrl(person?.profile_plate_url);
    if(url) node.style.setProperty('--profile-plate-image',`url("${url.replace(/["\\]/g,'')}")`);
    else node.style.removeProperty('--profile-plate-image');
    node.style.setProperty('--profile-plate-opacity',String(profilePlateOpacity(person?.settings)));
  }
  const dateLabel = value => {
    try { return new Date(value).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}); }
    catch { return ''; }
  };
  const showAuth = () => { $('#auth-screen').classList.remove('hidden'); $('#app-screen').classList.add('hidden'); };
  const showApp = () => { $('#auth-screen').classList.add('hidden'); $('#app-screen').classList.remove('hidden'); };
  function showRecoveryScreen() {
    showAuth();
    $('#auth-form').classList.add('hidden');
    $('.auth-links').classList.add('hidden');
    $('#auth-recovery-form').classList.remove('hidden');
    $('#auth-title').textContent = 'Elige una nueva contraseña';
    $('#auth-subtitle').textContent = 'Verifica el cambio y vuelve a iniciar sesión.';
    $('#auth-note').textContent = 'El enlace de recuperación solo autoriza este cambio de contraseña.';
  }
  function showLoginScreen() {
    $('#auth-form').classList.remove('hidden');
    $('.auth-links').classList.remove('hidden');
    $('#auth-recovery-form').classList.add('hidden');
    setAuthMode('login');
    showAuth();
  }

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
        const pendingInvite = new URL(location.href).searchParams.get('invite') || readPendingInvite();
        const emailRedirect = new URL(`${location.origin}${location.pathname}`);
        if (pendingInvite && /^[A-F0-9]{12}$/i.test(pendingInvite)) emailRedirect.searchParams.set('invite',pendingInvite.toUpperCase());
        const signupOptions = {data:{username},emailRedirectTo:emailRedirect.toString()};
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

  $('#auth-recovery-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!requireClient()) return;
    const password = $('#recovery-password').value;
    const confirmation = $('#recovery-password-confirm').value;
    if (password.length < 8) { toast('La contraseña debe tener al menos 8 caracteres.', 'error'); return; }
    if (password !== confirmation) { toast('Las contraseñas no coinciden.', 'error'); return; }
    const button = $('#recovery-submit'); button.disabled = true;
    try {
      const {error} = await client.auth.updateUser({password});
      if (error) throw error;
      recoveryMode = false;
      history.replaceState(null, '', location.pathname);
      await client.auth.signOut();
      $('#auth-recovery-form').reset();
      showLoginScreen();
      toast('Contraseña actualizada. Inicia sesión con tu nueva contraseña.', 'success');
    } catch (error) {
      showAuthError(error, 'No se pudo actualizar la contraseña. Solicita un enlace nuevo.');
    } finally { button.disabled = false; }
  });
  $('#cancel-password-recovery').addEventListener('click', async () => {
    recoveryMode = false;
    history.replaceState(null, '', location.pathname);
    await client?.auth.signOut();
    showLoginScreen();
  });

  $('#auth-note').textContent = hasConfig
    ? 'Tus datos se guardan en tu propio proyecto de Supabase.'
    : 'Antes de usar la plataforma, configura tu proyecto Supabase en assets/js/config.js. La guía está en README.md.';

  async function startApp(user) {
    currentUser = user;
    showApp();
    applyClientPreferences();
    try {
      const {data, error} = await client.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      profile = data;
      applyClientPreferences();
      await loadActiveAltProfile();
      renderIdentity();
      subscribeAccountRealtime();
      subscribeGlobalPresence();
      subscribeMessageNotifications();
      await loadAltProfiles();
      await loadInitialData();
      await consumePendingCommunityInvite();
      await initializeServiceWorker();
      await refreshPushButtonState();
      await handlePushDeepLink();
      renderNotificationPanel();
    } catch (error) {
      showError(error, 'No se pudo cargar el perfil. Ejecuta primero supabase/schema.sql.');
    }
  }

  async function signOut() {
    if (!client) return;
    await leaveVoiceRoom({refresh:false});
    try { const reg=serviceWorkerRegistration||await initializeServiceWorker(); const sub=await reg?.pushManager.getSubscription(); if(sub){await client.from('push_subscriptions').delete().eq('endpoint',sub.endpoint).eq('user_id',currentUser.id);await sub.unsubscribe();pushEnabledLocal=false;} } catch(error) { console.warn('No se pudo retirar la suscripción push local:',error); }
    await client.auth.signOut();
    if (friendsRealtimeChannel) client.removeChannel(friendsRealtimeChannel);
    if (inboxRealtimeChannel) client.removeChannel(inboxRealtimeChannel);
    if (activeMessageChannel) client.removeChannel(activeMessageChannel);
    if (typingStopTimer) clearTimeout(typingStopTimer); typingStopTimer=null; localTypingActive=false;
    if (messageNotificationChannel) client.removeChannel(messageNotificationChannel);
    if (globalPresenceChannel) client.removeChannel(globalPresenceChannel);
    friendsRealtimeChannel = null; inboxRealtimeChannel = null; activeMessageChannel = null; messageNotificationChannel = null; globalPresenceChannel = null;
    onlineUserIds.clear();
    messageCache.clear(); typingUsers.clear();
    if (listRefreshTimer) clearTimeout(listRefreshTimer);
    pendingListRefreshes.clear();
    currentUser = null; profile = null; currentContext = null; replyTarget = null; activeAltProfile = null;
    notificationItems = []; notificationSeenIds.clear(); renderNotificationPanel();
    showAuth();
  }

  if (client) {
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || recoveryMode) {
        recoveryMode = true;
        showRecoveryScreen();
        return;
      }
      if (session?.user && !currentUser) startApp(session.user);
      if (!session?.user) { currentUser = null; profile = null; showLoginScreen(); }
    });
    client.auth.getSession().then(({data}) => {
      if (recoveryMode) showRecoveryScreen();
      else if (data.session?.user) startApp(data.session.user);
      else showLoginScreen();
    });
  } else showLoginScreen();

  // ---------- Navigation and identity ----------
  function switchView(view) {
    if(view!=='chats'&&voiceSession)leaveVoiceRoom({refresh:false});
    currentView = view;
    $('#app-screen').classList.toggle('community-focus',Boolean(profile?.settings?.compactPanels && currentCommunity && (view==='community' || (view==='chats' && currentContext?.type==='channel'))));
    $('#app-screen').classList.remove('mobile-chat-open');
    $('#app-screen').classList.remove('mobile-menu-open'); $('#mobile-menu-scrim')?.classList.add('hidden');
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
    if (view === 'profile') { fillProfileForm(); renderProfileWidgets(); fillCommunityNickname(); renderIdentityAssetLinks(); loadAltProfiles(); $('#profile-plate-opacity').value=String(profilePlateOpacity(profile?.settings)); $('#profile-plate-opacity-value').textContent=`${Math.round(profilePlateOpacity(profile?.settings)*100)}%`; }
    if (view === 'settings') fillSettingsForm();
  }
  $$('[data-view]').forEach(node => node.addEventListener('click', () => switchView(node.dataset.view)));
  function returnToPersonalInbox(){if(currentContext?.type==='channel'){if(voiceSession)leaveVoiceRoom({refresh:false});resetConversationPanel();}$('#app-screen').classList.remove('community-focus');}
  $$('.rail-logo, #sidebar-personal [data-view="chats"]').forEach(node=>node.addEventListener('click',returnToPersonalInbox));
  $('#rail-profile').addEventListener('click', () => switchView('profile'));
  $('#open-profile').addEventListener('click', () => switchView('profile'));
  $('#top-profile').addEventListener('click', () => switchView('profile'));
  $('#open-settings').addEventListener('click', () => switchView('settings'));
  $('#logout-button').addEventListener('click', signOut);
  $('#global-search').addEventListener('click', () => addFriendFlow());
  $('#mobile-menu-toggle')?.addEventListener('click',()=>{const app=$('#app-screen');app.classList.toggle('mobile-menu-open');$('#mobile-menu-scrim')?.classList.toggle('hidden',!app.classList.contains('mobile-menu-open'));});
  $('#mobile-menu-scrim')?.addEventListener('click',()=>{$('#app-screen').classList.remove('mobile-menu-open');$('#mobile-menu-scrim').classList.add('hidden');});
  $('#voice-session-dock-mute')?.addEventListener('click',toggleVoiceMute);
  $('#voice-session-dock-leave')?.addEventListener('click',()=>leaveVoiceRoom());
  $('#close-image-viewer')?.addEventListener('click',()=>$('#image-viewer-dialog')?.close());
  $('#image-viewer-dialog')?.addEventListener('click',event=>{if(event.target===$('#image-viewer-dialog'))$('#image-viewer-dialog').close();});
  $('#conversation-panel')?.addEventListener('click',event=>{
    const image=event.target.closest('.message-attachment img');
    if(!image)return;
    event.preventDefault();
    openImageViewer(image);
  });

  async function loadActiveAltProfile() {
    activeAltProfile=null;
    if (!currentUser) return;
    const stored=localStorage.getItem(`nexus-active-alt-${currentUser.id}`);
    if (!stored) return;
    const {data,error}=await client.from('alt_profiles').select('*').eq('id',stored).eq('owner_id',currentUser.id).maybeSingle();
    if (!error && data) activeAltProfile=data;
    else localStorage.removeItem(`nexus-active-alt-${currentUser.id}`);
  }

  async function loadAltProfiles() {
    if (!currentUser || !$('#alt-profile-list')) return;
    const {data,error}=await client.from('alt_profiles').select('*').eq('owner_id',currentUser.id).order('created_at',{ascending:true});
    if (error) { console.warn('No se pudieron cargar las alts:',error); return; }
    const host=$('#alt-profile-list');
    host.innerHTML=(data||[]).length ? (data||[]).map(item=>`<div class="alt-profile-card"><span class="alt-profile-avatar" ${safeHttpsUrl(item.avatar_url)?`style="background-image:url('${escapeHtml(safeHttpsUrl(item.avatar_url))}')"`:''}>${safeHttpsUrl(item.avatar_url)?'':escapeHtml(initials(item.nickname||item.username))}</span><span class="alt-profile-copy"><strong>${escapeHtml(item.nickname||item.username)}</strong><small>@${escapeHtml(item.username)}</small></span><button type="button" class="button ${activeAltProfile?.id===item.id?'button-primary':'button-secondary'}" data-use-alt="${item.id}">${activeAltProfile?.id===item.id?'Activa':'Usar'}</button><button type="button" class="icon-button" data-delete-alt="${item.id}" title="Eliminar alt">×</button></div>`).join('') : '<p class="muted small-muted">Todavía no has creado identidades alternativas.</p>';
    $$('[data-use-alt]').forEach(button=>button.addEventListener('click',()=>activateAltProfile(data.find(item=>item.id===button.dataset.useAlt)||null)));
    $$('[data-delete-alt]').forEach(button=>button.addEventListener('click',async()=>{
      const item=data.find(row=>row.id===button.dataset.deleteAlt); if (!item || !confirm(`¿Eliminar la identidad @${item.username}? Los mensajes anteriores dejarán de mostrar la marca ALT y usarán el perfil principal.`)) return;
      const {error:deleteError}=await client.from('alt_profiles').delete().eq('id',item.id).eq('owner_id',currentUser.id);
      if (deleteError) showError(deleteError,'No se pudo eliminar la identidad.');
      else { if(activeAltProfile?.id===item.id) await activateAltProfile(null); else await loadAltProfiles(); toast('Identidad alternativa eliminada.','success'); }
    }));
  }

  async function activateAltProfile(item) {
    activeAltProfile=item;
    if (item) localStorage.setItem(`nexus-active-alt-${currentUser.id}`,item.id);
    else localStorage.removeItem(`nexus-active-alt-${currentUser.id}`);
    renderIdentity(); await loadAltProfiles();
    toast(item?`Ahora escribes como @${item.username}.`:'Has vuelto a tu identidad principal.','success');
  }

  async function resolveAltSender(altId,baseProfile) {
    const {data,error}=await client.from('alt_profiles').select('id,username,nickname,avatar_url,owner_id').eq('id',altId).maybeSingle();
    if (error || !data || data.owner_id!==baseProfile?.id) return baseProfile || {};
    return {...baseProfile,username:data.username,nickname:data.nickname||data.username,avatar_url:data.avatar_url||baseProfile?.avatar_url,isAlt:true};
  }

  function applyProfileFontToNode(node,userId,fontUrl) {
    if (!node) return;
    const safe=safeHttpsUrl(fontUrl);
    if (!safe || !userId) { node.style.removeProperty('font-family'); return; }
    const family=`NexusProfile_${String(userId).replace(/[^a-z0-9]/gi,'')}`;
    const styleId=`nexus-profile-font-${String(userId).replace(/[^a-z0-9]/gi,'')}`;
    let style=document.getElementById(styleId);
    if (!style) { style=document.createElement('style'); style.id=styleId; document.head.append(style); }
    // Do not hard-code format("woff2"): the upload control also accepts WOFF and TTF.
    style.textContent=`@font-face{font-family:"${family}";src:url("${safe.replace(/["\\]/g,'')}");font-display:swap;}`;
    node.style.fontFamily=`"${family}", "Space Grotesk", sans-serif`;
  }

  function applyOwnProfileFont() {
    const node=$('#sidebar-username');
    if (node && profile) applyProfileFontToNode(node,currentUser.id,profile.name_font_url);
  }

  function renderIdentity() {
    const identity = activeAltProfile || profile || {};
    const username = identity.nickname || identity.username || currentUser?.email?.split('@')[0] || 'Usuario';
    const avatarUrl = safeHttpsUrl(identity.avatar_url || profile?.avatar_url);
    $('#sidebar-username').textContent = username;
    $('#sidebar-handle').textContent = `@${identity.username || profile?.username || 'usuario'}${activeAltProfile ? ' · ALT' : ''}`;
    $('#sidebar-avatar').style.backgroundImage = avatarUrl ? `url('${avatarUrl}')` : '';
    $('#sidebar-avatar').textContent = avatarUrl ? '' : initials(username);
    $('#rail-avatar').style.backgroundImage = avatarUrl ? `url('${avatarUrl}')` : '';
    $('#rail-avatar').textContent = avatarUrl ? '' : initials(username);
    for (const avatarNode of [$('#sidebar-avatar'),$('#rail-avatar')]) {
      const effect=safeHttpsUrl(profile?.profile_effect_url);
      avatarNode?.classList.toggle('avatar-effect',Boolean(effect));
      if(effect) avatarNode.style.setProperty('--profile-effect-image',`url("${effect.replace(/["\\]/g,'')}")`);
      else avatarNode?.style.removeProperty('--profile-effect-image');
      applyProfileFrame(avatarNode,profile);
    }
    const statusNode=$('#sidebar-custom-status');
    if(statusNode){statusNode.textContent=String(profile?.settings?.customStatus||'').slice(0,60);statusNode.title=statusNode.textContent;}
    if (/^#[0-9a-f]{6}$/i.test(profile?.settings?.accent || '')) document.documentElement.style.setProperty('--accent', profile.settings.accent);
    if (/^https:\/\//i.test(profile?.settings?.background || '')) document.body.style.backgroundImage = `url('${profile.settings.background}')`;
    applyOwnProfileFont();
  }

  async function loadInitialData() {
    await Promise.allSettled([loadConversations(), loadFriends(), loadCommunities(), checkAdmin()]);
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

    friendsRealtimeChannel = client.channel(`nexus-friends-${currentUser.id}`, {config:{private:true}})
      .on('postgres_changes', {event:'*', schema:'public', table:'friends'}, () => scheduleAccountListRefresh('friends'))
      .subscribe();

    inboxRealtimeChannel = client.channel(`nexus-inbox-${currentUser.id}`, {config:{private:true}})
      .on('postgres_changes', {event:'*', schema:'public', table:'conversation_members', filter:`user_id=eq.${currentUser.id}`}, () => scheduleAccountListRefresh('conversations'))
      .on('postgres_changes', {event:'*', schema:'public', table:'conversations'}, () => scheduleAccountListRefresh('conversations'))
      .subscribe();
  }

  function refreshFriendPresenceIndicators() {
    $$('.person-row[data-person-id]').forEach(node => {
      const online=onlineUserIds.has(node.dataset.personId);
      node.classList.toggle('is-online',online);
      const label=$('.person-presence',node);
      if(label) label.textContent=online?'En línea':'Desconectado';
    });
    $$('.conversation-row[data-direct-user-id]').forEach(node => {
      const online=onlineUserIds.has(node.dataset.directUserId);
      node.classList.toggle('direct-user-online',online);
      const label=$('.conversation-presence-dot',node);
      if(label){label.title=online?'En línea':'Desconectado';label.setAttribute('aria-label',label.title);}
    });
  }
  function syncGlobalPresence() {
    onlineUserIds.clear();
    const state=globalPresenceChannel?.presenceState?.()||{};
    for(const [key,metas] of Object.entries(state)){
      const userId=metas?.[0]?.user_id||key;
      if(userId) onlineUserIds.add(userId);
    }
    refreshFriendPresenceIndicators();
  }
  function subscribeGlobalPresence() {
    if(!client||!currentUser)return;
    if(globalPresenceChannel)client.removeChannel(globalPresenceChannel);
    globalPresenceChannel=client.channel('nexus-online',{config:{private:true,presence:{key:currentUser.id},broadcast:{self:false,ack:false}}})
      .on('presence',{event:'sync'},syncGlobalPresence)
      .on('presence',{event:'join'},syncGlobalPresence)
      .on('presence',{event:'leave'},syncGlobalPresence)
      .subscribe(async status=>{
        if(status==='SUBSCRIBED'&&globalPresenceChannel){
          try{
            await globalPresenceChannel.track({user_id:currentUser.id,username:profile?.username||'usuario',nickname:profile?.nickname||profile?.username||'Usuario',status_text:String(profile?.settings?.customStatus||'').slice(0,60),profile_frame_url:safeHttpsUrl(profile?.profile_frame_url),profile_plate_url:safeHttpsUrl(profile?.profile_plate_url),profile_plate_opacity:profilePlateOpacity(profile?.settings),joined_at:new Date().toISOString()});
            syncGlobalPresence();
          }catch(error){console.warn('No se pudo publicar presencia global:',error);}
        }
      });
  }

  // ---------- Message notifications ----------
  function primeNotificationAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!notificationAudioContext) notificationAudioContext = new AudioContextClass();
    if (notificationAudioContext.state === 'suspended') notificationAudioContext.resume().catch(() => {});
  }
  document.addEventListener('pointerdown', primeNotificationAudio, {once:true,passive:true});
  document.addEventListener('keydown', primeNotificationAudio, {once:true});

  function playNotificationSound() {
    if (profile?.settings?.notifySound === false || !notificationAudioContext || notificationAudioContext.state !== 'running') return;
    const ctx = notificationAudioContext;
    const now = ctx.currentTime;
    [660,880].forEach((frequency,index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency,now + index*0.095);
      gain.gain.setValueAtTime(0.0001,now + index*0.095);
      gain.gain.exponentialRampToValueAtTime(0.045,now + index*0.095 + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001,now + index*0.095 + 0.12);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(now + index*0.095); oscillator.stop(now + index*0.095 + 0.13);
    });
  }

  async function resolveNotificationSource(message) {
    if (message.conversation_id) {
      let row = conversations.find(item => item.id === message.conversation_id);
      if (!row) {
        const {data} = await client.from('conversations').select('*').eq('id',message.conversation_id).maybeSingle();
        if (!data) return {kind:'conversation',id:message.conversation_id,title:'Mensaje directo',subtitle:'Conversación',icon:'',conversationId:message.conversation_id};
        const {data:members} = await client.from('conversation_members').select('user_id,personal_name').eq('conversation_id',message.conversation_id);
        const otherIds = (members || []).map(item=>item.user_id).filter(id=>id!==currentUser.id);
        const profiles = await fetchProfiles(otherIds);
        const other = otherIds.length ? profiles[otherIds[0]] : null;
        const mine = (members || []).find(item=>item.user_id===currentUser.id);
        row = {...data,displayTitle:mine?.personal_name || data.title || other?.nickname || other?.username || 'Mensaje directo',displayAvatar:data.icon_url || (data.kind==='direct'?other?.avatar_url:null)};
      }
      let title = row.displayTitle || row.title || 'Mensaje directo';
      let icon = row.displayAvatar || row.icon_url || '';
      let subtitle = row.kind === 'group' ? 'Chat grupal' : 'Mensaje directo';
      if (row.kind === 'direct') {
        const {data:members} = await client.from('conversation_members').select('user_id,personal_name').eq('conversation_id',message.conversation_id);
        const otherId = (members || []).map(item=>item.user_id).find(id=>id!==currentUser.id);
        if (otherId) {
          const people = await fetchProfiles([otherId]);
          const other = people[otherId];
          title = (members || []).find(item=>item.user_id===currentUser.id)?.personal_name || other?.nickname || other?.username || title;
          icon = row.icon_url || other?.avatar_url || icon;
        }
      }
      return {kind:'conversation',id:message.conversation_id,title,subtitle,icon,conversationId:message.conversation_id};
    }
    if (message.channel_id) {
      const {data:channel} = await client.from('channels').select('id,name,type,community_id').eq('id',message.channel_id).maybeSingle();
      if (!channel) return {kind:'channel',id:message.channel_id,title:'Canal',subtitle:'Megagrupo',icon:'',communityId:null,channelId:message.channel_id};
      const {data:community} = await client.from('communities').select('id,name,icon_url').eq('id',channel.community_id).maybeSingle();
      return {kind:'channel',id:channel.id,title:`# ${channel.name}`,subtitle:community?.name || 'Megagrupo',icon:community?.icon_url || '',communityId:channel.community_id,channelId:channel.id};
    }
    return {kind:'conversation',id:'',title:'Nexus',subtitle:'Mensaje nuevo',icon:''};
  }

  async function isCurrentUserMentioned(message, source) {
    const mentions = Array.isArray(message.formatting?.mentions) ? message.formatting.mentions : [];
    if (mentions.some(item=>item.type==='user' && item.id===currentUser.id)) return true;
    const roleIds = mentions.filter(item=>item.type==='role').map(item=>item.id).filter(Boolean);
    if (!roleIds.length || !source.communityId) return false;
    const {data} = await client.from('member_roles').select('role_id').eq('community_id',source.communityId).eq('user_id',currentUser.id).in('role_id',roleIds);
    return Boolean(data?.length);
  }

  function renderNotificationPanel() {
    const list = $('#notification-list');
    if (!list) return;
    const count = $('#notification-count');
    if (count) {
      count.textContent = String(notificationItems.length);
      count.classList.toggle('hidden',notificationItems.length===0);
    }
    list.innerHTML = notificationItems.length ? notificationItems.slice(0,35).map((item,index)=>{
      const safeIcon = safeHttpsUrl(item.icon);
      const iconMarkup = safeIcon ? `<span class="notification-source-icon" style="background-image:url('${escapeHtml(safeIcon)}')"></span>` : `<span class="notification-source-icon notification-source-fallback">${item.kind==='channel'?'▦':item.subtitle==='Chat grupal'?'♧':'◉'}</span>`;
      return `<button class="notification-entry ${item.mention?'notification-entry-mention':''}" type="button" data-notification-index="${index}">${iconMarkup}<span class="notification-entry-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subtitle)}${item.mention?' · Te han mencionado':''}</small><span>${escapeHtml(item.body)}</span></span><time>${escapeHtml(item.time)}</time></button>`;
    }).join('') : '<p class="empty-state compact">Todavía no hay notificaciones.</p>';
    $('#notification-subtitle').textContent = notificationItems.length ? `${notificationItems.length} aviso${notificationItems.length===1?'':'s'} recientes` : 'Mensajes nuevos y menciones';
    $('#notification-permission-note').textContent = !('Notification' in window) ? 'Este navegador no admite avisos de escritorio.' : pushEnabledLocal ? 'Avisos push activados en este navegador.' : Notification.permission==='granted' ? 'Avisos de escritorio activados; push con navegador cerrado todavía desactivado.' : 'Sonido mientras Nexus está abierto. Activa los permisos para más avisos.';
    const pushButton=$('#enable-push-notifications');if(pushButton){pushButton.textContent=pushEnabledLocal?'Desactivar avisos push':'Activar avisos con Nexus cerrado';pushButton.disabled=!cfg.VAPID_PUBLIC_KEY;pushButton.title=cfg.VAPID_PUBLIC_KEY?'':'Configura VAPID_PUBLIC_KEY en config.js y los secretos/webhook de Supabase';}
    $$('[data-notification-index]').forEach(button=>button.addEventListener('click',async()=>{
      const item=notificationItems[Number(button.dataset.notificationIndex)];
      if (!item) return;
      $('#notification-panel').classList.add('hidden');
      $('#open-notifications').setAttribute('aria-expanded','false');
      await openNotificationTarget(item);
    }));
  }

  async function openNotificationTarget(item) {
    if (item.kind==='conversation') {
      await loadConversations();
      const row=conversations.find(entry=>entry.id===item.conversationId);
      if (row) await openConversation(row); else toast('Ya no tienes acceso a esa conversación.','error');
      return;
    }
    if (item.kind==='channel' && item.communityId) {
      const {data:community,error}=await client.from('communities').select('*').eq('id',item.communityId).maybeSingle();
      if (error || !community) { showError(error || new Error('Ya no tienes acceso a ese megagrupo.')); return; }
      await selectCommunity(community);
      const channel=currentCommunityChannels.find(row=>row.id===item.channelId);
      if (channel) await openCommunityChannel(channel);
      else toast('No se ha encontrado el canal.','error');
    }
  }

  async function handleIncomingNotification(message) {
    if (!currentUser || !message?.id || message.sender_id===currentUser.id || notificationSeenIds.has(message.id)) return;
    notificationSeenIds.add(message.id);
    const source=await resolveNotificationSource(message);
    const mention=await isCurrentUserMentioned(message,source);
    const sameContext=currentContext && ((message.conversation_id && currentContext.type==='conversation' && currentContext.id===message.conversation_id) || (message.channel_id && currentContext.type==='channel' && currentContext.id===message.channel_id));
    const visible=document.visibilityState==='visible';
    const showWhileOpen=profile?.settings?.notifyWhileOpen !== false;
    if (sameContext && visible && !showWhileOpen && !mention) return;
    const preview=String(message.body || message.attachment?.name || 'Ha enviado un archivo').replace(/\s+/g,' ').slice(0,120);
    const item={...source,body:preview,mention,time:dateLabel(message.created_at),createdAt:message.created_at};
    notificationItems.unshift(item); notificationItems=notificationItems.slice(0,50);
    playNotificationSound();
    renderNotificationPanel();
    refreshUnreadCounts();
    if (document.visibilityState==='hidden' && profile?.settings?.desktopNotifications===true && 'Notification' in window && Notification.permission==='granted') {
      const notice=new Notification(mention ? `Te han mencionado · ${source.title}` : source.title,{body:preview,icon:safeHttpsUrl(source.icon)||undefined,tag:`nexus-${message.id}`});
      notice.onclick=()=>{window.focus();openNotificationTarget(item);notice.close();};
    }
  }

  function subscribeMessageNotifications() {
    if (!client || !currentUser) return;
    if (messageNotificationChannel) client.removeChannel(messageNotificationChannel);
    messageNotificationChannel=client.channel(`nexus-notifications-${currentUser.id}`,{config:{private:true}})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},payload=>handleIncomingNotification(payload.new).catch(error=>console.warn('No se pudo procesar una notificación:',error)))
      .subscribe();
  }

  // ---------- Web Push (works after the browser has been subscribed) ----------
  function base64UrlToUint8Array(value){const padding='='.repeat((4-value.length%4)%4);const raw=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));}
  async function initializeServiceWorker(){
    if(!('serviceWorker' in navigator))return null;
    try{serviceWorkerRegistration=await navigator.serviceWorker.register('./nexus-sw.js',{scope:'./'});return serviceWorkerRegistration;}catch(error){console.warn('Service worker no disponible:',error);return null;}
  }
  async function enablePushNotifications(){
    if(!cfg.VAPID_PUBLIC_KEY){toast('Falta VAPID_PUBLIC_KEY en assets/js/config.js. Consulta la guía de notificaciones v0.7.','error');return;}
    if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){toast('Este navegador no admite Web Push.','error');return;}
    const permission=await Notification.requestPermission();if(permission!=='granted'){toast('El navegador no ha concedido permiso para notificaciones.');return;}
    const reg=serviceWorkerRegistration||await initializeServiceWorker();if(!reg){toast('No se pudo registrar el service worker.','error');return;}
    try{
      const subscription=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(cfg.VAPID_PUBLIC_KEY)});
      const payload=subscription.toJSON();
      const {error}=await client.from('push_subscriptions').upsert({user_id:currentUser.id,endpoint:subscription.endpoint,subscription:payload,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
      if(error)throw error;
      pushEnabledLocal=true;refreshPushButtonState();
      $('#notification-permission-note').textContent='Avisos push activados para este navegador.';toast('Notificaciones con Nexus cerrado activadas.','success');
    }catch(error){showError(error,'No se pudo activar Web Push. Comprueba la clave VAPID y la migración v0.7.');}
  }
  async function disablePushNotifications(){
    try{const reg=serviceWorkerRegistration||await initializeServiceWorker();const sub=await reg?.pushManager.getSubscription();if(sub){const {error}=await client.from('push_subscriptions').delete().eq('endpoint',sub.endpoint).eq('user_id',currentUser.id);if(error)throw error;await sub.unsubscribe();}pushEnabledLocal=false;refreshPushButtonState();toast('Notificaciones push desactivadas en este navegador.');}catch(error){showError(error);}
  }
  async function refreshPushButtonState(){
    const button=$('#enable-push-notifications');if(!button)return;
    let active=false;
    try{const reg=serviceWorkerRegistration||await initializeServiceWorker();const sub=await reg?.pushManager.getSubscription();if(sub&&currentUser){const {data,error}=await client.from('push_subscriptions').select('endpoint').eq('user_id',currentUser.id).eq('endpoint',sub.endpoint).maybeSingle();active=!error&&Boolean(data);}}catch(error){console.warn('Estado push:',error);}
    pushEnabledLocal=active;button.textContent=active?'Desactivar avisos push':'Activar avisos con Nexus cerrado';button.disabled=!cfg.VAPID_PUBLIC_KEY;button.title=cfg.VAPID_PUBLIC_KEY?'':'Configura VAPID_PUBLIC_KEY en config.js y los secretos/webhook de Supabase';
  }
  $('#enable-push-notifications')?.addEventListener('click',()=>pushEnabledLocal?disablePushNotifications():enablePushNotifications());
  async function handlePushDeepLink(){
    const url=new URL(location.href);const conversationId=url.searchParams.get('openConversation');const channelId=url.searchParams.get('openChannel');
    try{
      if(conversationId){await loadConversations();const row=conversations.find(item=>item.id===conversationId);if(row)await openConversation(row);}
      else if(channelId){const {data:channel}=await client.from('channels').select('*').eq('id',channelId).maybeSingle();if(channel){const {data:community}=await client.from('communities').select('*').eq('id',channel.community_id).maybeSingle();if(community){await selectCommunity(community);await openCommunityChannel(channel);}}}
      if(conversationId||channelId){url.searchParams.delete('openConversation');url.searchParams.delete('openChannel');history.replaceState({},'',url.pathname+url.search+url.hash);}
    }catch(error){console.warn('No se pudo abrir el destino de push:',error);}
  }

  $('#open-notifications').addEventListener('click',()=>{
    const panel=$('#notification-panel');
    const opening=panel.classList.contains('hidden');
    panel.classList.toggle('hidden',!opening);
    $('#open-notifications').setAttribute('aria-expanded',String(opening));
    if (opening) renderNotificationPanel();
  });
  $('#clear-notifications').addEventListener('click',()=>{notificationItems=[];renderNotificationPanel();});
  $('#enable-desktop-notifications').addEventListener('click',async()=>{
    if (!('Notification' in window)) { toast('Este navegador no admite notificaciones de escritorio.'); return; }
    try {
      const permission=await Notification.requestPermission();
      const settings={...(profile?.settings||{}),desktopNotifications:permission==='granted'};
      const {error}=await client.from('profiles').update({settings}).eq('id',currentUser.id);
      if (error) throw error;
      profile.settings=settings; renderNotificationPanel();
      toast(permission==='granted'?'Avisos de escritorio activados.':'No se concedió permiso para los avisos.');
    } catch(error) { showError(error,'No se pudo activar el permiso de notificaciones.'); }
  });

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
      return {...row, displayTitle:title, displayAvatar:avatar, directUserId:row.kind==='direct'?other?.user_id:null, displayFrame:row.kind==='direct'?otherProfile?.profile_frame_url:null, displayPlate:row.kind==='direct'?otherProfile?.profile_plate_url:null,displayPlateOpacity:profilePlateOpacity(otherProfile?.settings), hidden_at:mine?.hidden_at || null};
    });
    renderConversationList();
    refreshUnreadCounts();
  }

  async function refreshUnreadCounts(){
    if(!client||!currentUser)return;
    try{
      const {data,error}=await client.rpc('get_nexus_unread_counts');
      if(error)throw error;
      unreadCounts.clear();
      for(const row of data||[])unreadCounts.set(`${row.context_type}:${row.context_id}`,Number(row.unread_count)||0);
      renderConversationList();
      renderChannelUnreadBadges();
    }catch(error){console.warn('No se pudieron actualizar los contadores de mensajes pendientes:',error.message||error);}
  }
  function renderChannelUnreadBadges(){
    $$('[data-channel]').forEach(button=>{
      const count=unreadCounts.get(`channel:${button.dataset.channel}`)||0;
      let badge=$('.unread-badge',button);
      if(count){if(!badge){badge=document.createElement('span');badge.className='unread-badge';button.append(badge);}badge.textContent=count>99?'99+':String(count);}
      else badge?.remove();
    });
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
    $('#conversation-list').removeAttribute('aria-busy');
    if (!visible.length) {
      $('#conversation-list').innerHTML = showArchivedConversations
        ? '<div class="empty-state compact">No tienes conversaciones archivadas.</div>'
        : '<div class="empty-state compact">Todavía no tienes conversaciones.<br>Empieza añadiendo amigos.</div>';
      return;
    }
    $('#conversation-list').innerHTML = visible.map(row => `
      <div class="conversation-row ${row.directUserId&&onlineUserIds.has(row.directUserId)?'direct-user-online':''}" ${row.directUserId?`data-direct-user-id="${row.directUserId}"`:''} ${safeHttpsUrl(row.displayPlate)?`style="--profile-plate-image:url('${escapeHtml(safeHttpsUrl(row.displayPlate))}');--profile-plate-opacity:${row.displayPlateOpacity}"`:''}>
        <button class="conversation-item ${currentContext?.id === row.id ? 'active' : ''}" data-conversation="${row.id}">
          ${avatarMarkup({avatar_url:row.displayAvatar,profile_frame_url:row.displayFrame,nickname:row.displayTitle})}
          <span class="conversation-copy"><strong>${escapeHtml(row.displayTitle)}</strong><small>${row.kind === 'direct' ? 'Mensaje directo' : 'Grupo'}${row.hidden_at ? ' · Archivada' : ''}</small></span>${(unreadCounts.get(`conversation:${row.id}`)||0)>0?`<span class="unread-badge">${(unreadCounts.get(`conversation:${row.id}`)||0)>99?'99+':unreadCounts.get(`conversation:${row.id}`)}</span>`:''}${row.kind==='direct'?'<span class="conversation-presence-dot" aria-label="Desconectado" title="Desconectado"></span>':''}
        </button>
        <div class="conversation-actions">
          <button type="button" data-hide-conversation="${row.id}" title="${row.hidden_at ? 'Restaurar conversación' : 'Archivar conversación'}">${row.hidden_at ? '↥' : '⌑'}</button>
          ${row.kind === 'group' ? `<button type="button" data-leave-conversation="${row.id}" title="Salir del grupo">×</button>` : ''}
        </div>
      </div>`).join('');
    refreshFriendPresenceIndicators();
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
    if(voiceSession)await leaveVoiceRoom({refresh:false});
    switchView('chats');
    if(currentContext?.type==='conversation'&&currentContext.id===row.id&&$('#messages-container')){
      $('#app-screen').classList.add('mobile-chat-open');
      await syncMessageDelta({...currentContext},{render:true});
      $$('.conversation-item').forEach(button=>button.classList.toggle('active',button.dataset.conversation===row.id));
      return;
    }
    replyTarget = null;
    if (row.hidden_at) {
      const {error} = await client.from('conversation_members').update({hidden_at:null})
        .eq('conversation_id', row.id).eq('user_id', currentUser.id);
      if (error) { showError(error, 'No se pudo restaurar la conversación.'); return; }
      row.hidden_at = null;
      showArchivedConversations = false;
      renderConversationList();
    }
    currentContext = {type:'conversation', id:row.id, title:row.displayTitle, subtitle:row.kind === 'direct' ? 'Mensaje directo' : 'Chat grupal', icon:row.displayAvatar, frame:row.displayFrame};
    switchView('chats'); $('#app-screen').classList.remove('community-focus'); $('#app-screen').classList.add('mobile-chat-open');
    await showMessagePanel();
    await loadMessages();
    subscribeMessages();
    $$('.conversation-item').forEach(button => button.classList.toggle('active', button.dataset.conversation === row.id));
  }

  async function showMessagePanel() {
    const panel = $('#conversation-panel');
    const c = currentContext;
    panel.classList.toggle('community-chat-active',Boolean(c?.type==='channel'&&currentCommunity));
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
        <div class="conversation-head"><button type="button" class="conversation-back" id="conversation-back" aria-label="Volver a conversaciones">‹</button>${avatarMarkup({avatar_url:c.icon,profile_frame_url:c.frame,nickname:c.title})}<div class="conversation-head-copy"><strong>${escapeHtml(c.title)}</strong><small>${escapeHtml(c.subtitle || '')}${channelLabel}${c.channelDescription ? ` · ${escapeHtml(c.channelDescription)}` : ''}</small><div class="context-presence-controls"><button type="button" id="context-online-trigger" class="online-members-trigger" aria-haspopup="dialog" aria-controls="online-members-dialog"><span class="online-members-dot"></span><span id="context-online-count">0 en línea</span></button><span class="context-presence-status" id="context-presence-status"></span></div></div><div class="conversation-tools"><button class="icon-button" id="conversation-info" title="Información">ⓘ</button></div></div>
        <div id="pinned-messages" class="pinned-messages hidden"></div>
        ${voiceNotice ? '<div class="voice-placeholder voice-room"><div class="voice-placeholder-orb">◖</div><strong>Canal de voz</strong><p>Conéctate para hablar con los miembros presentes. El audio se transmite directamente entre navegadores cuando la red lo permite.</p><div id="voice-status" class="voice-status">Desconectado</div><div id="voice-participants" class="voice-participants"><span class="tag">Aún no hay participantes conectados</span></div><div class="voice-room-actions"><button type="button" class="button button-primary" id="join-voice-room">Conectar micrófono</button><button type="button" class="button button-secondary" id="voice-mute" disabled>Silenciar</button><button type="button" class="button button-secondary" id="leave-voice-room" disabled>Salir</button></div><div id="voice-audio-host" class="voice-audio-host"></div><small class="muted">La calidad de conexión depende de la red. Algunas redes necesitan un servidor TURN adicional.</small></div>' : `
        <div class="messages" id="messages-container" aria-busy="true"><button type="button" class="load-older-messages hidden" id="load-older-messages">Cargar mensajes anteriores</button><div class="message-loading" role="status" aria-label="Cargando mensajes"><div class="message-loading-heading"><span></span><span></span></div><div class="message-loading-line"></div><div class="message-loading-line short"></div><div class="message-loading-heading second"><span></span><span></span></div><div class="message-loading-line medium"></div><div class="message-loading-line short"></div></div></div>
        <div class="composer-wrap ${readOnly ? 'composer-readonly' : ''} ${mediaOnly ? 'composer-media-only' : ''}">
          <div id="reply-composer" class="reply-composer hidden"><div><small>Respondiendo a <strong id="reply-author"></strong></small><span id="reply-excerpt"></span></div><button type="button" id="cancel-reply" class="icon-button" aria-label="Cancelar respuesta">×</button></div>
          <div id="mention-suggestions" class="mention-suggestions hidden" role="listbox" aria-label="Menciones"></div>
          <div class="composer-tools"><button id="attach-file" ${readOnly ? 'disabled' : ''}>＋ Archivo</button><button type="button" id="open-asset-picker" ${readOnly ? 'disabled' : ''}>Emojis / Stickers</button><button type="button" id="open-gif-search" ${readOnly ? 'disabled' : ''}>GIF</button>${mediaOnly ? '' : `<button id="create-poll" ${readOnly ? 'disabled' : ''}>▤ Encuesta</button><button id="insert-bold" ${readOnly ? 'disabled' : ''}><b>B</b></button><button id="insert-italic" ${readOnly ? 'disabled' : ''}><i>I</i></button><button id="insert-code" ${readOnly ? 'disabled' : ''}>&lt;/&gt;</button>`}<input id="chat-file" class="upload-input" type="file" accept="image/*,video/*,.pdf,.txt,.zip"></div>
          <form class="composer" id="message-form"><textarea id="message-input" rows="1" maxlength="12000" placeholder="${mediaOnly ? 'Este canal solo admite archivos…' : announcementLocked ? 'Publicar anuncios requiere un permiso…' : 'Escribe un mensaje… (Markdown disponible)'}" ${mediaOnly || readOnly ? 'disabled' : ''}></textarea><button class="composer-send" type="submit" aria-label="Enviar" ${mediaOnly || readOnly ? 'disabled' : ''}>➤</button></form><div class="composer-hint">${composerHint}</div>
        </div>`}
      </div>`;
    applyChatCommunityBackground();
    $('#conversation-back')?.addEventListener('click',()=>{const app=$('#app-screen');app.classList.remove('mobile-chat-open');if(currentContext?.type==='channel'){app.classList.add('mobile-menu-open');$('#mobile-menu-scrim')?.classList.remove('hidden');}});
    $('#context-online-trigger')?.addEventListener('click',openOnlineMembersDialog);
    loadPinnedMessages();
    if (!voiceNotice) {
      $('#cancel-reply').addEventListener('click', clearReplyTarget);
      $('#message-form').addEventListener('submit', sendMessage);
      $('#message-input').addEventListener('input', handleComposerInput);
      $('#message-input').addEventListener('paste',handleComposerPaste);
      applyComposerFont($('#message-input'));
      autoResizeComposer($('#message-input'));
      $('#load-older-messages')?.addEventListener('click',loadOlderMessages);
      $('#message-input').addEventListener('keydown', event => {
        if (event.key === 'Escape') hideMentionSuggestions();
        if (event.key === 'Enter' && !event.shiftKey && !$('#mention-suggestions')?.querySelector('[data-mention-option].active')) { event.preventDefault(); $('#message-form').requestSubmit(); }
      });
      $('#attach-file').addEventListener('click', () => $('#chat-file').click());
      $('#chat-file').addEventListener('change', uploadAttachment);
      $('#open-asset-picker')?.addEventListener('click', () => openAssetPicker('standard'));
      $('#open-gif-search')?.addEventListener('click', openGifSearch);
      if (!mediaOnly && !announcementLocked) {
        $('#create-poll').addEventListener('click', createPoll);
        $('#insert-bold').addEventListener('click', () => wrapSelection('**'));
        $('#insert-italic').addEventListener('click', () => wrapSelection('*'));
        $('#insert-code').addEventListener('click', () => wrapSelection('`'));
      }
    }
    if (voiceNotice) {
      $('#join-voice-room')?.addEventListener('click', joinVoiceRoom);
      $('#voice-mute')?.addEventListener('click', toggleVoiceMute);
      $('#leave-voice-room')?.addEventListener('click', () => leaveVoiceRoom());
      if (voiceSession?.channelId===c.id) renderVoiceParticipants();
    }
    $('#conversation-info').addEventListener('click', () => {
      if (isCommunityChannel && c.channelDescription) toast(c.channelDescription);
      else toast('Los ajustes de nombre personal e icono por miembro se añadirán en el módulo de grupos.');
    });
  }

  function openImageViewer(image) {
    const dialog=$('#image-viewer-dialog'),preview=$('#image-viewer-image'),caption=$('#image-viewer-caption'),open=$('#image-viewer-open');
    const source=image?.currentSrc||image?.src||'';
    if(!dialog||!preview||!source)return;
    preview.src=source;preview.alt=image.alt||'Imagen adjunta';
    if(caption)caption.textContent=image.alt||'Imagen adjunta';
    if(open)open.href=source;
    if(!dialog.open)dialog.showModal();
  }

  function autoResizeComposer(input) {
    if(!input) return;
    input.style.height='auto';
    input.style.height=`${Math.min(input.scrollHeight,180)}px`;
    input.style.overflowY=input.scrollHeight>180?'auto':'hidden';
  }
  function applyComposerFont(input) {
    if(!input) return;
    const choice=profile?.settings?.composerFont||'default';
    if(choice==='profile' && safeHttpsUrl(profile?.name_font_url)) {
      applyProfileFontToNode(input,currentUser?.id,profile.name_font_url);
    } else {
      input.style.fontFamily=({
        default:'DM Sans, sans-serif',
        space:'Space Grotesk, sans-serif',
        serif:'Georgia, serif',
        mono:'ui-monospace, SFMono-Regular, Consolas, monospace'
      })[choice] || 'DM Sans, sans-serif';
    }
  }
  function handleComposerInput(event) {
    updateMentionSuggestions();
    autoResizeComposer(event.currentTarget);
    broadcastTypingState(Boolean(event.currentTarget.value.trim()));
  }
  function sendTypingState(typing) {
    if(!activeMessageChannel || !currentUser) return;
    try { const pending=activeMessageChannel.send({type:'broadcast',event:'typing',payload:{user_id:currentUser.id,typing:Boolean(typing),name:profile?.nickname||profile?.username||'Alguien'}}); pending?.catch?.(()=>{}); } catch (_) {}
  }
  function broadcastTypingState(typing) {
    if(!typing){
      if(typingStopTimer) clearTimeout(typingStopTimer);
      typingStopTimer=null;
      if(localTypingActive){localTypingActive=false;sendTypingState(false);}
      return;
    }
    const now=Date.now();
    if(!localTypingActive || now-lastTypingBroadcastAt>1400){
      lastTypingBroadcastAt=now;localTypingActive=true;sendTypingState(true);
    }
    if(typingStopTimer) clearTimeout(typingStopTimer);
    typingStopTimer=setTimeout(()=>broadcastTypingState(false),4200);
  }
  function renderContextPresence() {
    const node=$('#context-presence-status');
    const state=activeMessageChannel?.presenceState?.()||voiceSession?.channel?.presenceState?.()||{};
    const online=[];const seen=new Set();
    for(const [key,metas] of Object.entries(state)){
      const meta=metas?.[0]||{};const id=meta.user_id||key;
      if(!id||seen.has(id))continue;seen.add(id);
      online.push({id,name:meta.nickname||meta.username||'Miembro',username:meta.username||'',status:String(meta.status_text||'').slice(0,60),avatar:safeHttpsUrl(meta.avatar_url),frame:safeHttpsUrl(meta.profile_frame_url),plate:safeHttpsUrl(meta.profile_plate_url),plateOpacity:Number.isFinite(Number(meta.profile_plate_opacity))?Math.max(0,Math.min(.6,Number(meta.profile_plate_opacity))):.13});
    }
    contextPresenceMembers=online.sort((a,b)=>a.id===currentUser?.id?-1:b.id===currentUser?.id?1:a.name.localeCompare(b.name,'es'));
    const others=online.filter(item=>item.id!==currentUser?.id);
    const typing=[...typingUsers.values()].filter(item=>item.expires>Date.now());
    const trigger=$('#context-online-trigger');
    if(trigger){const count=$('#context-online-count');if(count)count.textContent=`${online.length} en línea`;trigger.title=online.map(item=>item.id===currentUser?.id?'Tú':item.name).join(', ')||'Sin miembros conectados';}
    const parts=[];
    if(typing.length)parts.push(`${typing.map(item=>item.name).slice(0,2).join(', ')} ${typing.length===1?'está':'están'} escribiendo…`);
    if(node)node.textContent=parts.join(' · ');
    const legacyHost=$('#context-online-members');if(legacyHost)legacyHost.replaceChildren();
    if($('#online-members-dialog')?.open)renderOnlineMembersDialog();
  }
  function openOnlineMembersDialog(){
    const dialog=$('#online-members-dialog');if(!dialog)return;
    renderOnlineMembersDialog();if(!dialog.open)dialog.showModal();
  }
  function renderOnlineMembersDialog(){
    const host=$('#online-members-grid');if(!host)return;
    const subtitle=$('#online-members-subtitle');if(subtitle)subtitle.textContent=`${contextPresenceMembers.length} ${contextPresenceMembers.length===1?'persona conectada':'personas conectadas'} a este chat`;
    host.replaceChildren();
    if(!contextPresenceMembers.length){host.innerHTML='<p class="empty-state compact">Todavía no hay miembros conectados.</p>';return;}
    for(const member of contextPresenceMembers){
      const card=document.createElement('button');card.type='button';card.className='online-member-card';
      if(member.plate){card.style.backgroundImage=`linear-gradient(135deg,#151b2bdd,#25223cdd),url("${member.plate.replace(/["\\]/g,'')}")`;card.style.setProperty('--profile-plate-opacity',String(member.plateOpacity));}
      const avatar=avatarMarkup({avatar_url:member.avatar,profile_frame_url:member.frame,nickname:member.name},'online-member-avatar');
      const copy=document.createElement('span');copy.className='online-member-copy';
      const name=document.createElement('strong');name.textContent=member.id===currentUser?.id?`${member.name} · Tú`:member.name;
      const status=document.createElement('small');status.textContent=member.status|| (member.id===currentUser?.id?'Tu sesión':'En línea');
      copy.append(name,status);card.insertAdjacentHTML('afterbegin',avatar);card.append(copy);
      if(member.id!==currentUser?.id)card.addEventListener('click',()=>{ $('#online-members-dialog').close();openPublicProfile(member.id); });
      else card.disabled=true;
      host.append(card);
    }
  }
  $('#close-online-members')?.addEventListener('click',()=>$('#online-members-dialog').close());
  $('#online-members-dialog')?.addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close();});
  function handleTypingBroadcast(event) {
    const payload=event?.payload||{};
    if(!payload.user_id||payload.user_id===currentUser?.id) return;
    if(!payload.typing){typingUsers.delete(payload.user_id);renderContextPresence();return;}
    const entry={name:String(payload.name||'Alguien').slice(0,40),expires:Date.now()+5000};
    typingUsers.set(payload.user_id,entry);
    setTimeout(()=>{const active=typingUsers.get(payload.user_id);if(active===entry){typingUsers.delete(payload.user_id);renderContextPresence();}},5100);
    renderContextPresence();
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
      .select('id,username,nickname,avatar_url,banner_url,bio,pronouns,aliases,default_name_color,widgets,name_font_url,name_effect_url,profile_effect_url,profile_plate_url,profile_frame_url,settings')
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
    if (safeHttpsUrl(person.profile_effect_url)) avatar.style.setProperty('--profile-effect-image',`url("${safeHttpsUrl(person.profile_effect_url).replace(/["\\]/g,'')}")`);
    applyProfileFrame(avatar,person);
    applyProfilePlate(header,person);
    const names = document.createElement('div'); names.className='public-profile-names';
    const display = document.createElement('strong'); display.textContent=communityNickname || person.nickname || person.username;
    if (safeHttpsUrl(person.name_effect_url)) display.style.setProperty('--name-effect-image',`url("${safeHttpsUrl(person.name_effect_url).replace(/["\\]/g,'')}")`);
    applyProfileFontToNode(display, person.id, person.name_font_url);
    const handle = document.createElement('small'); handle.textContent=`@${person.username}${communityNickname ? ` · ${person.nickname || person.username}` : ''}`;
    names.append(display,handle); header.append(avatar,names); host.append(banner,header);
    const publicStatus=String(person.settings?.customStatus||'').trim().slice(0,60);
    if(publicStatus){const status=document.createElement('p');status.className='public-profile-status';status.textContent=publicStatus;host.append(status);}
    if (person.pronouns) { const pronouns=document.createElement('span'); pronouns.className='profile-pronouns-tag'; pronouns.textContent=person.pronouns; host.append(pronouns); }
    if (person.bio) { const bio=document.createElement('p'); bio.className='public-profile-bio'; bio.textContent=person.bio; host.append(bio); }
    const aliases = Array.isArray(person.aliases) ? person.aliases.filter(Boolean).slice(0,10) : [];
    if (aliases.length) {
      const aliasWrap=document.createElement('div'); aliasWrap.className='public-profile-aliases';
      aliases.forEach(alias=>{const tag=document.createElement('span');tag.className='tag';tag.textContent=alias;aliasWrap.append(tag);});
      host.append(aliasWrap);
    }
    const widgets = Array.isArray(person.widgets) ? person.widgets.slice(0,32) : [];
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
        if(widget.type==='link'&&safeHttpsUrl(widget.url)){
          card.classList.add('public-profile-link-widget');
          const iconImage=document.createElement('img');iconImage.className='profile-widget-favicon';iconImage.alt='';iconImage.loading='lazy';
          try{iconImage.src=`https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(widget.url).hostname)}&sz=64`;iconImage.onerror=()=>{icon.replaceChildren(document.createTextNode('↗'));};}catch{icon.textContent='↗';}
          icon.replaceChildren(iconImage);
          const link=document.createElement('a');link.href=safeHttpsUrl(widget.url);link.target='_blank';link.rel='noopener noreferrer';link.className='profile-widget-open-link';link.textContent='Abrir enlace ↗';
          card.append(icon,title,desc,link);
        }else card.append(widgetBanner,icon,title,desc);
        grid.append(card);
      });
      host.append(grid);
    }
    $('#public-profile-dialog').showModal();
  }

  $('#close-public-profile').addEventListener('click',()=>$('#public-profile-dialog').close());

  async function fetchProfiles(ids) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) return {};
    const {data, error} = await client.from('profiles').select('id,username,nickname,avatar_url,default_name_color,name_font_url,name_effect_url,profile_effect_url,profile_plate_url,profile_frame_url,settings').in('id', unique);
    if (error) { console.warn(error); return {}; }
    return Object.fromEntries((data || []).map(row => [row.id,row]));
  }

  function messageContextKey(context=currentContext) {
    return context ? `${context.type}:${context.id}` : '';
  }
  function saveMessageCache(key, rows, olderFlag) {
    const previous=messageCache.get(key);
    const merged=new Map((previous?.rows||[]).map(row=>[row.id,row]));
    for(const row of rows||[]) merged.set(row.id,row);
    const sorted=[...merged.values()].sort((a,b)=>(new Date(a.created_at)-new Date(b.created_at))||String(a.id).localeCompare(String(b.id)));
    let older=typeof olderFlag==='boolean'?olderFlag:Boolean(previous?.hasOlder);
    if(sorted.length>MESSAGE_CACHE_LIMIT){sorted.splice(0,sorted.length-MESSAGE_CACHE_LIMIT);older=true;}
    messageCache.delete(key);messageCache.set(key,{rows:sorted,hasOlder:older});
    while(messageCache.size>MESSAGE_CACHE_CONTEXTS) messageCache.delete(messageCache.keys().next().value);
    return messageCache.get(key);
  }
  function cacheMessage(row) {
    const key=messageContextKey();if(!key||!row?.id)return;
    const state=messageCache.get(key)||{rows:[],hasOlder:false};
    const result=saveMessageCache(key,[row],state.hasOlder);
    // A live message is newer than the paging boundary. Never move the
    // oldest cursor forward just because the bounded cache trimmed entries.
    hasOlderMessages=result.hasOlder;
  }

  async function signedUrlLookup(bucket, paths) {
    const unique=[...new Set((paths||[]).filter(Boolean))];
    if(!unique.length)return new Map();
    const {data,error}=await client.storage.from(bucket).createSignedUrls(unique,3600);
    if(error){console.warn(`No se pudieron firmar archivos de ${bucket}:`,error);return new Map();}
    return new Map((data||[]).filter(item=>item?.path&&item?.signedUrl).map(item=>[item.path,item.signedUrl]));
  }
  function updateLoadOlderButton() {
    const button=$('#load-older-messages');
    if(!button)return;
    button.classList.toggle('hidden',!hasOlderMessages);
    button.disabled=loadingOlderMessages;
    button.textContent=loadingOlderMessages?'Cargando…':'Cargar mensajes anteriores';
  }
  async function renderMessageRows(rows) {
    if(!rows?.length)return;
    const renderContextKey=messageContextKey();
    const messageIds=rows.map(row=>row.id);
    const replyIds=[...new Set(rows.map(row=>row.reply_to).filter(Boolean))];
    const pollMessageIds=rows.filter(row=>row.message_type==='poll').map(row=>row.id);
    const stickerAssetIds=[...new Set(rows.map(row=>row.attachment?.custom_asset_id).filter(Boolean))];
    const emojiAssetIds=[...new Set(rows.flatMap(row=>Array.isArray(row.formatting?.custom_emojis)?row.formatting.custom_emojis:[]).filter(id=>typeof id==='string'))];
    const mediaPaths=[...new Set(rows.map(row=>row.attachment?.path).filter(Boolean))];
    const [profilesResponse,reactionsResponse,repliesResponse,pollsResponse,stickersResponse,emojisResponse]=await Promise.all([
      fetchProfiles(rows.map(row=>row.sender_id)),
      messageIds.length?client.from('message_reactions').select('message_id,emoji,user_id').in('message_id',messageIds):Promise.resolve({data:[],error:null}),
      replyIds.length?client.from('messages').select('id,body,sender_id,attachment').in('id',replyIds):Promise.resolve({data:[],error:null}),
      pollMessageIds.length?client.from('polls').select('*').in('message_id',pollMessageIds):Promise.resolve({data:[],error:null}),
      stickerAssetIds.length?client.from('custom_assets').select('id,name,asset_url').in('id',stickerAssetIds).eq('asset_type','sticker'):Promise.resolve({data:[],error:null}),
      emojiAssetIds.length?client.from('custom_assets').select('id,name,asset_url,animated').in('id',emojiAssetIds).eq('asset_type','emoji').is('archived_at',null):Promise.resolve({data:[],error:null})
    ]);
    const profiles={...profilesResponse};
    const replyRows=repliesResponse.data||[];
    const replyProfiles=replyRows.length?await fetchProfiles(replyRows.map(row=>row.sender_id)):{};
    Object.assign(profiles,replyProfiles);
    await preloadMessageIdentities([...rows.map(row=>row.sender_id),...replyRows.map(row=>row.sender_id)]);
    const reactionsByMessage=new Map();
    if(reactionsResponse.error)console.warn('No se pudieron cargar las reacciones:',reactionsResponse.error);
    else for(const reaction of reactionsResponse.data||[]){if(!reactionsByMessage.has(reaction.message_id))reactionsByMessage.set(reaction.message_id,[]);reactionsByMessage.get(reaction.message_id).push(reaction);}
    const pollsByMessage=new Map((pollsResponse.data||[]).map(poll=>[poll.message_id,poll]));
    const pollIds=(pollsResponse.data||[]).map(poll=>poll.id);
    const votesResponse=pollIds.length?await client.from('poll_votes').select('poll_id,option_index,user_id').in('poll_id',pollIds):{data:[],error:null};
    if(votesResponse.error)console.warn('No se pudieron cargar los votos de las encuestas:',votesResponse.error);
    const votesByPoll=new Map();
    for(const vote of votesResponse.data||[]){if(!votesByPoll.has(vote.poll_id))votesByPoll.set(vote.poll_id,[]);votesByPoll.get(vote.poll_id).push(vote);}
    const assetRows=[...(stickersResponse.data||[]),...(emojisResponse.data||[])];
    const assetById=new Map(assetRows.map(asset=>[asset.id,asset]));
    const assetUrls=await signedUrlLookup('nexus-assets',assetRows.map(asset=>asset.asset_url));
    for(const asset of emojisResponse.data||[]){const signedUrl=assetUrls.get(asset.asset_url);if(signedUrl)customEmojiCache.set(asset.name,{...asset,signedUrl});}
    const mediaUrls=await signedUrlLookup('chat-media',mediaPaths);
    const batchData={
      replies:new Map(replyRows.map(row=>[row.id,row])),
      replyProfiles,
      polls:pollsByMessage,
      pollVotes:votesByPoll,
      assets:assetById,
      assetUrls,
      mediaUrls,
      customEmojiReady:true
    };
    for(const message of rows){
      if(messageContextKey()!==renderContextKey) return;
      await appendMessage(message,profiles[message.sender_id],reactionsByMessage.get(message.id)||[],batchData);
    }
  }
  function messageLoadingMarkup(){
    return `<div class="message-loading" role="status" aria-label="Cargando mensajes"><div class="message-loading-heading"><span></span><span></span></div><div class="message-loading-line"></div><div class="message-loading-line short"></div><div class="message-loading-heading second"><span></span><span></span></div><div class="message-loading-line medium"></div><div class="message-loading-line short"></div><div class="message-loading-heading third"><span></span><span></span></div><div class="message-loading-line"></div></div>`;
  }
  function finishMessageLoading(container,{scrollBottom=true}={}){
    if(!container)return;
    container.querySelector('.message-loading')?.remove();
    container.removeAttribute('aria-busy');
    if(scrollBottom)requestAnimationFrame(()=>{if(container===$('#messages-container'))container.scrollTop=container.scrollHeight;});
  }

  async function loadMessages() {
    if(!currentContext)return;
    const context={...currentContext};
    const key=messageContextKey(context);
    const field=context.type==='conversation'?'conversation_id':'channel_id';
    const container=$('#messages-container');
    if(!container)return;
    await loadCustomEmojiCache(false);
    if(messageContextKey()!==key||container!==$('#messages-container'))return;
    renderedMessageIds.clear();renderingMessageIds.clear();
    typingUsers.clear();
    container.innerHTML='<button type="button" class="load-older-messages hidden" id="load-older-messages">Cargar mensajes anteriores</button>';
    $('#load-older-messages')?.addEventListener('click',loadOlderMessages);
    const cached=messageCache.get(key);
    if(cached){messageCache.delete(key);messageCache.set(key,cached);}
    let rows=cached?.rows||null;
    if(!rows?.length){container.insertAdjacentHTML('beforeend',messageLoadingMarkup());container.setAttribute('aria-busy','true');}
    if(rows?.length){
      hasOlderMessages=Boolean(cached.hasOlder);
      oldestMessageTimestamp=rows[0].created_at;
      oldestMessageId=rows[0].id;
      await renderMessageRows(rows);
      container.scrollTop=container.scrollHeight;
      // Reopening a chat renders the memory cache immediately, then catches up
      // from its compound (created_at,id) cursor without reloading the history.
      await syncMessageDelta(context,{render:true});
    } else {
      const {data,error}=await client.from('messages').select('*').eq(field,context.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(MESSAGE_PAGE_SIZE);
      if(error){finishMessageLoading(container,{scrollBottom:false});showError(error,'No se pudieron cargar los mensajes.');container.insertAdjacentHTML('beforeend','<div class="empty-state compact">No se pudieron cargar los mensajes. Comprueba tu conexión e inténtalo de nuevo.</div>');return;}
      rows=(data||[]).reverse();
      hasOlderMessages=(data||[]).length===MESSAGE_PAGE_SIZE;
      oldestMessageTimestamp=rows[0]?.created_at||null;
      oldestMessageId=rows[0]?.id||null;
      saveMessageCache(key,rows,hasOlderMessages);
      if(!rows.length)container.insertAdjacentHTML('beforeend','<div class="empty-state compact">Este espacio está tranquilo. Envía el primer mensaje.</div>');
      await renderMessageRows(rows);
      container.scrollTop=container.scrollHeight;
    }
    finishMessageLoading(container);
    updateLoadOlderButton();
    if(currentContext?.id!==context.id)return;
    const state=messageCache.get(key);
    if(context.type==='conversation'){
      await markConversationRead(state?.rows?.at(-1)?.id||null);
      await renderConversationReadReceipts();
    }else await markChannelRead(context.id);
    refreshUnreadCounts();
  }
  async function syncMessageDelta(context=currentContext,{render=true}={}) {
    if(!context||!client)return;
    const key=messageContextKey(context);const state=messageCache.get(key);
    if(!state?.rows?.length){if(render&&currentContext?.id===context.id)await loadMessages();return;}
    const field=context.type==='conversation'?'conversation_id':'channel_id';
    let cursor={created_at:state.rows.at(-1).created_at,id:state.rows.at(-1).id};
    const collected=[];let keepGoing=true;
    while(keepGoing){
      const {data,error}=await client.from('messages').select('*').eq(field,context.id)
        .or(`created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`)
        .order('created_at',{ascending:true}).order('id',{ascending:true}).limit(100);
      if(error){console.warn('No se pudieron sincronizar los mensajes nuevos:',error);break;}
      const page=data||[];if(!page.length)break;
      const known=new Set((messageCache.get(key)?.rows||[]).map(row=>row.id));
      const additions=page.filter(row=>!known.has(row.id));
      if(additions.length){const previousHasOlder=messageCache.get(key)?.hasOlder??false;saveMessageCache(key,additions,previousHasOlder);collected.push(...additions);}
      const last=page.at(-1);cursor={created_at:last.created_at,id:last.id};
      keepGoing=page.length===100;
      if(page.length<100)break;
    }
    if(render&&collected.length&&currentContext?.id===context.id&&currentContext?.type===context.type){
      const container=$('#messages-container');
      const wasNearBottom=container ? container.scrollHeight-container.scrollTop-container.clientHeight<120 : true;
      // Reuse the same batched renderer as the initial page. Reopening a busy
      // chat should not turn into one profile/role/reaction query per message.
      await renderMessageRows(collected);
      if(wasNearBottom&&container)container.scrollTop=container.scrollHeight;
      if(context.type==='conversation'){
        await markConversationRead(collected.at(-1).id);
        await renderConversationReadReceipts();
      }else await markChannelRead(context.id);
      refreshUnreadCounts();
    }
  }

  async function loadOlderMessages() {
    if(!currentContext||loadingOlderMessages||!hasOlderMessages||!oldestMessageTimestamp||!oldestMessageId)return;
    const context={...currentContext};const key=messageContextKey(context);const field=context.type==='conversation'?'conversation_id':'channel_id';
    const container=$('#messages-container');if(!container)return;
    loadingOlderMessages=true;updateLoadOlderButton();
    const previousHeight=container.scrollHeight;const previousTop=container.scrollTop;
    try{
      const {data,error}=await client.from('messages').select('*').eq(field,context.id).or(`created_at.lt.${oldestMessageTimestamp},and(created_at.eq.${oldestMessageTimestamp},id.lt.${oldestMessageId})`).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(MESSAGE_PAGE_SIZE);
      if(error)throw error;
      const older=(data||[]).reverse();
      if(older.length<MESSAGE_PAGE_SIZE)hasOlderMessages=false;
      if(older.length){
        saveMessageCache(key,older,hasOlderMessages);
        // Continue from the actual page boundary even if the in-memory cache
        // trimmed older entries to stay within its 200-message budget.
        oldestMessageTimestamp=older[0]?.created_at||oldestMessageTimestamp;
        oldestMessageId=older[0]?.id||oldestMessageId;
        await renderMessageRows(older);
        const button=$('#load-older-messages');
        const messageNodes=older.map(row=>$(`[data-message-id="${row.id}"]`,container)).filter(Boolean);
        const firstExisting=[...container.querySelectorAll('.message')].find(node=>!messageNodes.includes(node));
        for(const node of messageNodes)container.insertBefore(node,firstExisting||null);
        container.scrollTop=previousTop+(container.scrollHeight-previousHeight);
      }else hasOlderMessages=false;
    }catch(error){showError(error,'No se pudieron cargar mensajes anteriores.');}
    finally{loadingOlderMessages=false;updateLoadOlderButton();}
  }

  async function preloadMessageIdentities(userIds) {
    const communityId=currentContext?.type==='channel'?currentCommunity?.id:null;
    const unique=[...new Set((userIds||[]).filter(Boolean))];
    const missing=unique.filter(id=>!messageIdentityCache.has(`${communityId||'personal'}:${id}`));
    if(!missing.length)return;
    const empty=()=>({roles:[],badges:[],communityNickname:''});
    try{
      const [membersResponse,assignmentsResponse,badgeAssignmentsResponse]=await Promise.all([
        communityId?client.from('community_members').select('user_id,nickname').eq('community_id',communityId).in('user_id',missing):Promise.resolve({data:[],error:null}),
        communityId?client.from('member_roles').select('user_id,role_id').eq('community_id',communityId).in('user_id',missing):Promise.resolve({data:[],error:null}),
        (()=>{let query=client.from('member_badges').select('user_id,badge_id').in('user_id',missing);query=communityId?query.eq('community_id',communityId):query.is('community_id',null);return query;})()
      ]);
      for(const response of [membersResponse,assignmentsResponse,badgeAssignmentsResponse])if(response.error)console.warn('No se pudo precargar identidad de mensajes:',response.error);
      const roleIds=[...new Set((assignmentsResponse.data||[]).map(row=>row.role_id))];
      const badgeIds=[...new Set((badgeAssignmentsResponse.data||[]).map(row=>row.badge_id))];
      const [rolesResponse,badgesResponse]=await Promise.all([
        roleIds.length?client.from('community_roles').select('id,name,color,position').in('id',roleIds).order('position',{ascending:false}):Promise.resolve({data:[],error:null}),
        badgeIds.length?client.from('badges').select('id,name,icon_url,animated').in('id',badgeIds):Promise.resolve({data:[],error:null})
      ]);
      const roleById=new Map((rolesResponse.data||[]).map(row=>[row.id,row]));
      const badgeById=new Map((badgesResponse.data||[]).map(row=>[row.id,row]));
      const memberById=new Map((membersResponse.data||[]).map(row=>[row.user_id,row]));
      const rolesByUser=new Map();for(const row of assignmentsResponse.data||[]){const role=roleById.get(row.role_id);if(role){if(!rolesByUser.has(row.user_id))rolesByUser.set(row.user_id,[]);rolesByUser.get(row.user_id).push(role);}}
      const badgesByUser=new Map();for(const row of badgeAssignmentsResponse.data||[]){const badge=badgeById.get(row.badge_id);if(badge){if(!badgesByUser.has(row.user_id))badgesByUser.set(row.user_id,[]);badgesByUser.get(row.user_id).push(badge);}}
      for(const id of missing){const member=memberById.get(id);messageIdentityCache.set(`${communityId||'personal'}:${id}`,{...empty(),communityNickname:member?.nickname||'',roles:rolesByUser.get(id)||[],badges:badgesByUser.get(id)||[]});}
    }catch(error){console.warn('No se pudo precargar identidad de mensajes:',error);}
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

  async function appendMessage(message, sender, initialReactions = null, batchData = null) {
    if (!message?.id || renderingMessageIds.has(message.id) || renderedMessageIds.has(message.id)) return;
    const existingContainer = $('#messages-container');
    if (existingContainer && $(`[data-message-id="${message.id}"]`, existingContainer)) { renderedMessageIds.add(message.id); return; }
    renderingMessageIds.add(message.id);
    try { await appendMessageInternal(message, sender, initialReactions, batchData); }
    finally { renderingMessageIds.delete(message.id); }
  }

  async function appendMessageInternal(message, sender, initialReactions = null, batchData = null) {
    const container = $('#messages-container');
    const contextIdAtStart = currentContext?.id;
    if (!container || $(`[data-message-id="${message.id}"]`, container)) return;
    const template = $('#message-template').content.cloneNode(true);
    const article = $('.message', template);
    article.dataset.messageId = message.id;
    article.dataset.createdAt = message.created_at || '';
    article.__nexusMessage = message;
    const avatar = $('.avatar-message', article);
    const shownSender = message.alt_profile_id ? await resolveAltSender(message.alt_profile_id, sender) : (sender || {});
    const avatarUrl = safeHttpsUrl(shownSender.avatar_url);
    if (avatarUrl) avatar.style.backgroundImage = `url('${avatarUrl}')`;
    else avatar.textContent = initials(shownSender.nickname || shownSender.username || 'U');
    if (safeHttpsUrl(sender?.profile_effect_url)) avatar.style.setProperty('--profile-effect-image', `url("${safeHttpsUrl(sender.profile_effect_url).replace(/["\\]/g,'')}")`);
    applyProfileFrame(avatar,sender);
    const author = $('.message-author', article);
    const identity = await getMessageIdentity(message.sender_id);
    author.textContent = message.alt_profile_id ? (shownSender.nickname || shownSender.username || 'Alt') : (identity.communityNickname || sender?.nickname || sender?.username || 'Usuario');
    if (safeHttpsUrl(sender?.name_effect_url)) author.style.setProperty('--name-effect-image', `url("${safeHttpsUrl(sender.name_effect_url).replace(/["\\]/g,'')}")`);
    applyProfileFontToNode(author, sender?.id, sender?.name_font_url);
    applyProfilePlate(article,sender);
    author.classList.add('message-author-clickable');
    author.title = 'Ver perfil';
    author.addEventListener('click', () => openPublicProfile(message.sender_id));
    if (sender?.default_name_color) author.style.color = sender.default_name_color;
    if (identity.roles[0]?.color) author.style.color = identity.roles[0].color;
    if (identity.roles.length || identity.badges.length || message.alt_profile_id) {
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
      if (message.alt_profile_id) {
        const altBadge = document.createElement('span'); altBadge.className='alt-identity-tag'; altBadge.textContent='ALT'; altBadge.title='Identidad alternativa'; decorations.append(altBadge);
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
        else { const key=messageContextKey(); const state=messageCache.get(key); if(state)saveMessageCache(key,state.rows.filter(row=>row.id!==message.id),state.hasOlder); article.remove(); renderedMessageIds.delete(message.id); toast('Mensaje eliminado.','success'); }
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
      let original=batchData?.replies?.get(message.reply_to)||null;
      if(!batchData){const response=await client.from('messages').select('body,sender_id,attachment').eq('id',message.reply_to).maybeSingle();original=response.data||null;}
      if (original) {
        const replyProfiles = batchData?.replyProfiles || await fetchProfiles([original.sender_id]);
        const replyName = replyProfiles[original.sender_id]?.nickname || replyProfiles[original.sender_id]?.username || 'Usuario';
        quote.textContent = `${replyName}: ${String(original.body || original.attachment?.name || 'Mensaje').slice(0,150)}`;
      } else quote.textContent = 'Mensaje original no disponible';
    }

    const body = $('.message-body', article);
    const source = String(message.body || '');
    try {
      const rendered = window.marked ? marked.parse(source, {breaks:true, gfm:true}) : escapeHtml(source).replace(/\n/g,'<br>');
      body.innerHTML = window.DOMPurify ? DOMPurify.sanitize(rendered, {USE_PROFILES:{html:true}}) : escapeHtml(source);
      applyMentionMarkup(body, message.formatting?.mentions || []);
      if (Array.isArray(message.formatting?.custom_emojis) && message.formatting.custom_emojis.length) {
        if(!batchData?.customEmojiReady)await ensureCustomEmojiAssetsForMessage(message);
        renderCustomEmojiTokens(body);
      }
    } catch { body.textContent = source; }
    if (message.message_type === 'poll') {
      let poll=batchData?.polls?.get(message.id)||null;
      if(!batchData){const response=await client.from('polls').select('*').eq('message_id',message.id).maybeSingle();poll=response.data||null;}
      if (poll) {
        let votes=batchData?.pollVotes?.get(poll.id)||[];
        if(!batchData){const response=await client.from('poll_votes').select('option_index,user_id').eq('poll_id',poll.id);votes=response.data||[];}
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
          button.dataset.pollOption=String(index);
          button.textContent = `${option} · ${counts[index] || 0}`;
          button.disabled = Boolean(poll.ends_at && new Date(poll.ends_at) < new Date());
          button.addEventListener('click', async () => {
            const {error} = await client.from('poll_votes').upsert({poll_id:poll.id,user_id:currentUser.id,option_index:index},{onConflict:'poll_id,user_id'});
            if (error) showError(error); else refreshPollCard(message.id);
          });
          card.append(button);
        });
        $('.message-attachment', article).append(card);
      }
    }
    if (message.attachment?.kind === 'sticker' && message.attachment?.custom_asset_id) {
      let asset=batchData?.assets?.get(message.attachment.custom_asset_id)||null;
      let signedUrl=asset?.asset_url?batchData?.assetUrls?.get(asset.asset_url):null;
      if(!batchData){const response=await client.from('custom_assets').select('id,name,asset_url').eq('id',message.attachment.custom_asset_id).maybeSingle();asset=response.data||null;if(asset?.asset_url){const signed=await client.storage.from('nexus-assets').createSignedUrl(asset.asset_url,3600);signedUrl=signed.data?.signedUrl||null;}}
      if(asset?.asset_url&&signedUrl){const image=document.createElement('img');image.className='message-custom-sticker';image.src=signedUrl;image.alt=asset.name||'Sticker';image.loading='lazy';$('.message-attachment',article).append(image);}
    } else if (message.attachment?.kind === 'gif' && isGiphyMediaUrl(message.attachment.url)) {
      const image=document.createElement('img'); image.className='message-gif'; image.src=message.attachment.url; image.alt=String(message.attachment.alt||'GIF').slice(0,120); image.loading='lazy'; $('.message-attachment',article).append(image);
      const credit=document.createElement('small'); credit.className='gif-credit'; credit.textContent='Powered by GIPHY'; $('.message-attachment',article).append(credit);
    }
    if (message.attachment?.path) {
      let signedUrl=batchData?.mediaUrls?.get(message.attachment.path)||null;
      if(!batchData){const response=await client.storage.from('chat-media').createSignedUrl(message.attachment.path,3600);signedUrl=response.data?.signedUrl||null;}
      if (signedUrl) {
        const attachment = $('.message-attachment', article);
        const type = message.attachment.mimetype || '';
        const name = escapeHtml(message.attachment.name || 'archivo');
        if (type.startsWith('image/')) attachment.innerHTML = `<a class="message-image-link" href="${signedUrl}" target="_blank" rel="noopener noreferrer"><img class="message-media-image" src="${signedUrl}" alt="${name}" loading="lazy" decoding="async"></a>`;
        else if (type.startsWith('video/')) attachment.innerHTML = `<video class="message-media-video" controls preload="metadata" src="${signedUrl}"></video><a href="${signedUrl}" download="${name}">Descargar vídeo</a>`;
        else attachment.innerHTML = `<a href="${signedUrl}" download="${name}">Descargar ${name}</a>`;
      }
    }
    const reactionBar = $('.message-reactions', article);
    reactionBar.dataset.reactionMessage = message.id;
    if (container !== $('#messages-container') || currentContext?.id !== contextIdAtStart) return;
    const stickToBottom=container.scrollHeight-container.scrollTop-container.clientHeight<120;
    container.append(template);
    renderedMessageIds.add(message.id);
    const keepBottomIfNeeded=()=>{
      if(container!==$('#messages-container'))return;
      const distance=container.scrollHeight-container.scrollTop-container.clientHeight;
      if(distance<160)container.scrollTop=container.scrollHeight;
    };
    article.querySelectorAll('.message-attachment img').forEach(media=>{media.addEventListener('load',keepBottomIfNeeded,{once:true});media.addEventListener('error',()=>media.classList.add('media-load-error'),{once:true});});
    article.querySelectorAll('.message-attachment video').forEach(media=>media.addEventListener('loadedmetadata',keepBottomIfNeeded,{once:true}));
    await refreshMessageReactions(article, message.id, initialReactions);
    if(stickToBottom) container.scrollTop = container.scrollHeight;
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
    const mentions=await collectMessageMentions(body);
    await loadCustomEmojiCache();
    const customEmojis=collectCustomEmojiIds(body);
    const editedId=editingMessageId;
    const {error} = await client.rpc('edit_message_with_mentions',{p_message_id:editedId,p_body:body,p_mentions:mentions,p_custom_emojis:customEmojis});
    save.disabled = false;
    if (error) { showError(error,'No se pudo editar el mensaje.'); return; }
    $('#edit-message-dialog').close();
    editingMessageId = null;
    const {data:updatedMessage}=await client.from('messages').select('*').eq('id',editedId).maybeSingle();
    if(updatedMessage) await refreshSingleMessage(updatedMessage);
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
  async function markChannelRead(channelId){
    if(!channelId||!client)return;
    const {error}=await client.rpc('mark_channel_read',{p_channel_id:channelId});
    if(error)console.warn('No se pudo marcar el canal como leído:',error.message);
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

  async function refreshPollCard(messageId) {
    const article=$(`[data-message-id="${messageId}"]`,$('#messages-container'));
    if(!article)return;
    const {data:poll,error:pollError}=await client.from('polls').select('*').eq('message_id',messageId).maybeSingle();
    if(pollError||!poll)return;
    const {data:votes,error:votesError}=await client.from('poll_votes').select('option_index,user_id').eq('poll_id',poll.id);
    if(votesError)return;
    const counts=(poll.options||[]).map((_,index)=>(votes||[]).filter(vote=>vote.option_index===index).length);
    const mine=(votes||[]).find(vote=>vote.user_id===currentUser.id);
    const ended=Boolean(poll.ends_at&&new Date(poll.ends_at)<new Date());
    $$('[data-poll-option]',article).forEach(button=>{
      const index=Number(button.dataset.pollOption);
      if(!Number.isInteger(index)||index<0||index>=poll.options.length)return;
      button.textContent=`${poll.options[index]} · ${counts[index]||0}`;
      button.classList.toggle('selected',mine?.option_index===index);
      button.disabled=ended;
    });
  }
  async function refreshPollFromRealtime(payload) {
    if (!currentContext) return;
    const pollId = payload.new?.poll_id || payload.old?.poll_id;
    if (!pollId) return;
    const {data:poll} = await client.from('polls').select('id,message_id').eq('id',pollId).maybeSingle();
    if (!poll) return;
    const {data:message} = await client.from('messages').select('conversation_id,channel_id').eq('id',poll.message_id).maybeSingle();
    if (!message) return;
    const isCurrent = currentContext.type === 'conversation'
      ? message.conversation_id === currentContext.id
      : message.channel_id === currentContext.id;
    if (isCurrent) await refreshPollCard(poll.message_id);
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

  async function refreshSingleMessage(message) {
    if(!message?.id||!currentContext)return;
    cacheMessage(message);
    const container=$('#messages-container');
    const old=$(`[data-message-id="${message.id}"]`,container);
    if(!old)return;
    const nearBottom=container.scrollHeight-container.scrollTop-container.clientHeight<90;
    old.remove();renderedMessageIds.delete(message.id);
    const profiles=await fetchProfiles([message.sender_id]);
    await appendMessage(message,profiles[message.sender_id]);
    const nodes=[...container.querySelectorAll('.message')].sort((a,b)=>new Date(a.dataset.createdAt)-new Date(b.dataset.createdAt));
    for(const node of nodes)container.append(node);
    if(nearBottom)container.scrollTop=container.scrollHeight;
  }
  function subscribeMessages() {
    if(activeMessageChannel)client.removeChannel(activeMessageChannel);
    if(!currentContext)return;
    const context={...currentContext};
    const field=context.type==='conversation'?'conversation_id':'channel_id';
    typingUsers.clear();localTypingActive=false;if(typingStopTimer)clearTimeout(typingStopTimer);typingStopTimer=null;
    activeMessageChannel=client.channel(`nexus-${context.type}-${context.id}`,{config:{private:true,presence:{key:currentUser.id},broadcast:{self:false,ack:false}}})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`${field}=eq.${context.id}`},async payload=>{
        if(currentContext?.id!==context.id)return;
        cacheMessage(payload.new);
        // A live insert is a one-row batch too: this keeps reaction, identity,
        // reply and media resolution on the same path as paginated history.
        await renderMessageRows([payload.new]);
        if(context.type==='conversation'){
          scheduleAccountListRefresh('conversations');
          if(payload.new.sender_id!==currentUser.id){await markConversationRead(payload.new.id);await renderConversationReadReceipts();}
        }else if(payload.new.sender_id!==currentUser.id){await markChannelRead(context.id);}
        refreshUnreadCounts();
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages',filter:`${field}=eq.${context.id}`},payload=>{if(currentContext?.id===context.id)refreshSingleMessage(payload.new);})
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages',filter:`${field}=eq.${context.id}`},payload=>{
        if(currentContext?.id!==context.id)return;
        const id=payload.old?.id;if(!id)return;
        const key=messageContextKey(context);const state=messageCache.get(key);
        if(state)saveMessageCache(key,state.rows.filter(row=>row.id!==id),state.hasOlder);
        $(`[data-message-id="${id}"]`,$('#messages-container'))?.remove();renderedMessageIds.delete(id);
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},async payload=>{
        const messageId=payload.new?.message_id||payload.old?.message_id;if(!messageId)return;
        const article=$(`[data-message-id="${messageId}"]`,$('#messages-container'));
        if(article)await refreshMessageReactions(article,messageId);
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'poll_votes'},async payload=>refreshPollFromRealtime(payload))
      .on('postgres_changes',{event:'*',schema:'public',table:'pinned_messages'},async payload=>refreshPinsFromRealtime(payload))
      .on('postgres_changes',{event:'*',schema:'public',table:'conversation_reads',filter:context.type==='conversation'?`conversation_id=eq.${context.id}`:'conversation_id=eq.00000000-0000-0000-0000-000000000000'},async()=>renderConversationReadReceipts())
      .on('presence',{event:'sync'},renderContextPresence)
      .on('presence',{event:'join'},renderContextPresence)
      .on('presence',{event:'leave'},renderContextPresence)
      .on('broadcast',{event:'typing'},handleTypingBroadcast)
      .subscribe(async status=>{
        const node=$('#connection-status');
        if(node){node.classList.toggle('online',status==='SUBSCRIBED');node.innerHTML=`<i></i> ${status==='SUBSCRIBED'?'En directo':status==='CHANNEL_ERROR'?'Sin conexión':'Conectando'}`;}
        if(status==='SUBSCRIBED'&&currentContext?.id===context.id){
          try{await activeMessageChannel.track({user_id:currentUser.id,username:profile?.username||'usuario',nickname:profile?.nickname||profile?.username||'Usuario',avatar_url:safeHttpsUrl(profile?.avatar_url),profile_frame_url:safeHttpsUrl(profile?.profile_frame_url),profile_plate_url:safeHttpsUrl(profile?.profile_plate_url),profile_plate_opacity:profilePlateOpacity(profile?.settings),status_text:String(profile?.settings?.customStatus||'').slice(0,60),joined_at:new Date().toISOString()});renderContextPresence();}
          catch(error){console.warn('No se pudo publicar presencia:',error);}
        }
      });
  }

  async function getMentionCandidates() {
    if (!currentContext) return [];
    const cacheKey=`${currentContext.type}:${currentContext.id}`;
    if (mentionCandidateCache.has(cacheKey)) return mentionCandidateCache.get(cacheKey);
    let userIds=[]; let candidates=[];
    if (currentContext.type==='channel' && currentCommunity) {
      const {data:members}=await client.from('community_members').select('user_id').eq('community_id',currentCommunity.id);
      userIds=(members||[]).map(row=>row.user_id);
      const {data:roles}=await client.from('community_roles').select('id,name,color').eq('community_id',currentCommunity.id).order('position',{ascending:true});
      candidates.push(...(roles||[]).map(role=>({type:'role',id:role.id,label:role.name,token:`@role:${role.id}`,color:role.color})));
    } else {
      const {data:members}=await client.from('conversation_members').select('user_id').eq('conversation_id',currentContext.id);
      userIds=(members||[]).map(row=>row.user_id);
    }
    const profiles=await fetchProfiles(userIds);
    candidates.push(...Object.values(profiles).filter(person=>person.id!==currentUser.id).map(person=>({type:'user',id:person.id,label:person.nickname||person.username,username:person.username,token:`@${person.username}`})));
    mentionCandidateCache.set(cacheKey,candidates);
    return candidates;
  }

  function hideMentionSuggestions() {
    const box=$('#mention-suggestions');
    if (box) { box.classList.add('hidden'); box.innerHTML=''; }
  }

  async function updateMentionSuggestions() {
    const input=$('#message-input'); const box=$('#mention-suggestions');
    if (!input || !box) return;
    const caret=input.selectionStart;
    const before=input.value.slice(0,caret);
    const at=before.lastIndexOf('@');
    if (at<0 || (at>0 && /[\w@]/.test(before[at-1])) || /\s/.test(before.slice(at+1))) { hideMentionSuggestions(); return; }
    const query=before.slice(at+1).toLowerCase();
    const candidates=await getMentionCandidates();
    const filtered=candidates.filter(item=>item.label.toLowerCase().includes(query) || item.username?.toLowerCase().includes(query)).slice(0,8);
    if (!filtered.length) { hideMentionSuggestions(); return; }
    box.innerHTML=filtered.map((item,index)=>`<button type="button" role="option" data-mention-option="${index}"><span class="mention-option-kind">${item.type==='role'?'ROL':'USUARIO'}</span><strong>${item.type==='role'?'@':'@'}${escapeHtml(item.type==='role'?item.label:item.username)}</strong><small>${item.type==='role'?'Mención al rol':'Mención a una persona'}</small></button>`).join('');
    box.classList.remove('hidden');
    $$('[data-mention-option]',box).forEach(button=>button.addEventListener('click',()=>{
      const item=filtered[Number(button.dataset.mentionOption)];
      if (!item) return;
      const end=input.selectionStart; const start=input.value.lastIndexOf('@',end-1);
      if (start<0) return;
      input.setRangeText(`${item.token} `,start,end,'end');
      hideMentionSuggestions(); input.focus();
    }));
  }

  async function collectMessageMentions(body) {
    const candidates=await getMentionCandidates();
    const mentions=[];
    for (const item of candidates) {
      const escaped=item.token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      if (new RegExp(`(^|[^\\w])${escaped}(?=$|[^\\w])`,'i').test(body)) {
        mentions.push({type:item.type,id:item.id,token:item.token,label:item.label});
        if (mentions.length>=30) break;
      }
    }
    return mentions;
  }

  function applyMentionMarkup(container, mentions) {
    const valid=(Array.isArray(mentions)?mentions:[]).filter(item=>item && ['user','role'].includes(item.type) && typeof item.token==='string' && typeof item.label==='string');
    if (!valid.length) return;
    const tokenMap=new Map(valid.map(item=>[item.token,item]));
    const tokens=[...tokenMap.keys()].sort((a,b)=>b.length-a.length);
    const regex=new RegExp(`(${tokens.map(token=>token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`,'gi');
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement?.closest('code,pre')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!regex.test(node.nodeValue)) { regex.lastIndex=0; continue; }
      regex.lastIndex=0;
      const fragment=document.createDocumentFragment();
      const parts=node.nodeValue.split(regex);
      for (const part of parts) {
        const item=tokenMap.get(part) || [...tokenMap.entries()].find(([token])=>token.toLowerCase()===part.toLowerCase())?.[1];
        if (!item) fragment.append(document.createTextNode(part));
        else { const span=document.createElement('span'); span.className=`message-mention message-mention-${item.type}`; span.textContent=`@${item.label}`; span.title=item.type==='role'?'Mención a un rol':'Mención a un miembro'; fragment.append(span); }
      }
      node.parentNode?.replaceChild(fragment,node);
    }
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
    const mentions = await collectMessageMentions(body);
    await loadCustomEmojiCache();
    const customEmojis=collectCustomEmojiIds(body);
    const payload = {sender_id:currentUser.id, body, formatting:{mentions,custom_emojis:customEmojis}, ...(activeAltProfile ? {alt_profile_id:activeAltProfile.id} : {}), ...(replyTarget ? {reply_to:replyTarget.id} : {})};
    payload[currentContext.type === 'conversation' ? 'conversation_id' : 'channel_id'] = currentContext.id;
    const {error} = await client.from('messages').insert(payload);
    input.disabled = false;
    if (error) { showError(error, 'No se pudo enviar el mensaje.'); return; }
    input.value = '';
    autoResizeComposer(input);
    broadcastTypingState(false);
    clearReplyTarget();
    input.focus();
  }

  // ---------- Stickers, custom emoji and GIPHY GIFs ----------
  async function listCustomAssets(type){
    const scopes=[{scope:'personal',id:null}];
    if(currentContext?.type==='conversation')scopes.push({scope:'conversation',id:currentContext.id});
    if(currentContext?.type==='channel'&&currentCommunity)scopes.push({scope:'community',id:currentCommunity.id});
    const rows=[];
    for(const entry of scopes){let query=client.from('custom_assets').select('id,owner_id,asset_type,scope,scope_id,name,asset_url,animated,archived_at').eq('asset_type',type).eq('scope',entry.scope).is('archived_at',null);query=entry.id?query.eq('scope_id',entry.id):query.is('scope_id',null);const {data,error}=await query.order('created_at',{ascending:false});if(error){console.warn('Assets:',error);continue;}rows.push(...(data||[]));}
    const urls=await signedUrlLookup('nexus-assets',rows.map(row=>row.asset_url));
    return rows.map(row=>({...row,signedUrl:urls.get(row.asset_url)||''}));
  }
  async function loadCustomEmojiCache(force=false){
    if(!currentContext)return;
    const key=`${currentContext.type}:${currentContext.id}:${currentCommunity?.id||''}`;
    if(!force&&customEmojiCacheKey===key)return;
    customEmojiCache.clear();customEmojiCacheKey=key;
    const rows=await listCustomAssets('emoji');
    for(const row of rows)if(row.signedUrl)customEmojiCache.set(row.name,{...row});
  }
  function collectCustomEmojiIds(body){
    const ids=[];const regex=/:([a-z0-9_-]{2,32}):/gi;let match;
    while((match=regex.exec(String(body||'')))&&ids.length<30){const item=customEmojiCache.get(match[1].toLowerCase());if(item&&!ids.includes(item.id))ids.push(item.id);}
    return ids;
  }
  async function ensureCustomEmojiAssetsForMessage(message){
    const ids=Array.isArray(message?.formatting?.custom_emojis)?message.formatting.custom_emojis.filter(id=>typeof id==='string').slice(0,30):[];
    if(!ids.length)return;
    const {data,error}=await client.from('custom_assets').select('id,name,asset_url,animated').in('id',ids).eq('asset_type','emoji');
    if(error){console.warn('No se pudieron resolver los emojis de un mensaje:',error);return;}
    const assets=data||[];const urls=await signedUrlLookup('nexus-assets',assets.map(asset=>asset.asset_url));
    for(const asset of assets){const signedUrl=urls.get(asset.asset_url);if(signedUrl)customEmojiCache.set(asset.name,{...asset,signedUrl});}
  }
  function renderCustomEmojiTokens(container){
    if(!container||!customEmojiCache.size)return;
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement?.closest('code,pre,a')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){const text=node.nodeValue||'';const regex=/:([a-z0-9_-]{2,32}):/gi;let match,last=0,changed=false;const fragment=document.createDocumentFragment();
      while((match=regex.exec(text))){const asset=customEmojiCache.get(match[1].toLowerCase());if(!asset?.signedUrl)continue;changed=true;fragment.append(document.createTextNode(text.slice(last,match.index)));const img=document.createElement('img');img.className='custom-message-emoji';img.src=asset.signedUrl;img.alt=`:${asset.name}:`;img.title=img.alt;img.loading='lazy';fragment.append(img);last=match.index+match[0].length;}
      if(changed){fragment.append(document.createTextNode(text.slice(last)));node.parentNode?.replaceChild(fragment,node);}
    }
  }
  function openAssetPicker(type='sticker'){
    if(!currentContext){toast('Abre primero una conversación o canal.');return;}
    assetPickerType=type;if(type!=='standard')$('#custom-asset-type').value=type;
    const scope=$('#custom-asset-scope');scope.querySelector('[value="conversation"]').disabled=currentContext.type!=='conversation';scope.querySelector('[value="community"]').disabled=currentContext.type!=='channel'||!currentCommunity;
    scope.value='personal';$$('[data-asset-tab]').forEach(tab=>tab.classList.toggle('active',tab.dataset.assetTab===type));$('#asset-picker-dialog').showModal();loadAssetPicker();
  }
  async function loadAssetPicker(){
    const host=$('#asset-picker-grid');if(!host)return;
    if(assetPickerType==='standard'){
      $('#asset-upload-form')?.classList.add('hidden');
      host.innerHTML=`<div class="standard-emoji-grid">${STANDARD_EMOJIS.map(emoji=>`<button type="button" class="standard-emoji" data-standard-emoji="${emoji}" aria-label="Insertar ${emoji}">${emoji}</button>`).join('')}</div>`;
      $$('[data-standard-emoji]').forEach(button=>button.addEventListener('click',()=>{const input=$('#message-input');if(!input)return;input.setRangeText(button.dataset.standardEmoji,input.selectionStart,input.selectionEnd,'end');input.focus();autoResizeComposer(input);broadcastTypingState(true);}));
      return;
    }
    $('#asset-upload-form')?.classList.remove('hidden');
    $('#custom-asset-type').value=assetPickerType;
    host.innerHTML='<p class="empty-state compact">Cargando recursos…</p>';
    const rows=await listCustomAssets(assetPickerType);
    host.innerHTML=rows.length?rows.map(row=>`<article class="custom-asset-card"><img src="${escapeHtml(row.signedUrl)}" alt="${escapeHtml(row.name)}" loading="lazy"><strong>${escapeHtml(row.name)}</strong><small>${row.scope==='personal'?'Personal':row.scope==='conversation'?'Conversación':'Megagrupo'}${row.animated?' · GIF':''}</small><div><button type="button" class="button button-primary" data-use-custom-asset="${row.id}">${assetPickerType==='emoji'?'Insertar':'Enviar'}</button>${row.owner_id===currentUser.id?`<button type="button" class="button button-secondary" data-archive-custom-asset="${row.id}">Archivar</button>`:''}</div></article>`).join(''):'<p class="empty-state compact">No hay recursos en este ámbito. Sube el primero.</p>';
    $$('[data-use-custom-asset]').forEach(button=>button.addEventListener('click',()=>{const item=rows.find(row=>row.id===button.dataset.useCustomAsset);if(!item)return;if(assetPickerType==='emoji'){const input=$('#message-input');const token=`:${item.name}: `;const start=input.selectionStart,end=input.selectionEnd;input.setRangeText(token,start,end,'end');input.focus();loadCustomEmojiCache(true);}else sendStickerMessage(item);}));
    $$('[data-archive-custom-asset]').forEach(button=>button.addEventListener('click',()=>archiveCustomAsset(button.dataset.archiveCustomAsset)));
  }
  $('#close-asset-picker').addEventListener('click',()=>$('#asset-picker-dialog').close());
  $$('[data-asset-tab]').forEach(button=>button.addEventListener('click',()=>{assetPickerType=button.dataset.assetTab;if(assetPickerType!=='standard')$('#custom-asset-type').value=assetPickerType;$$('[data-asset-tab]').forEach(tab=>tab.classList.toggle('active',tab===button));loadAssetPicker();}));
  $('#asset-upload-form').addEventListener('submit',uploadCustomAsset);
  async function uploadCustomAsset(event){
    event.preventDefault();if(!currentContext||!currentUser)return;
    const file=$('#custom-asset-file').files?.[0];const name=$('#custom-asset-name').value.trim().toLowerCase();const type=$('#custom-asset-type').value;const scope=$('#custom-asset-scope').value;
    if(!file||!/^([a-z0-9_-]){2,32}$/.test(name)){toast('Usa un nombre de 2 a 32 caracteres: minúsculas, números, _ o -.','error');return;}
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024){toast('Usa PNG, JPG, WebP o GIF de hasta 5 MB.','error');return;}
    const scopeId=scope==='conversation'?currentContext.type==='conversation'?currentContext.id:null:scope==='community'?currentContext.type==='channel'?currentCommunity?.id:null:null;
    if(scope!=='personal'&&!scopeId){toast('Ese ámbito no corresponde al chat actual.','error');return;}
    const ext=({ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'})[file.type];
    const path=scope==='personal'?`personal/${currentUser.id}/${crypto.randomUUID()}.${ext}`:`${scope}/${scopeId}/${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    const button=$('#upload-custom-asset');button.disabled=true;
    try{
      const {error:upError}=await client.storage.from('nexus-assets').upload(path,file,{contentType:file.type,upsert:false});if(upError)throw upError;
      const {error:rowError}=await client.from('custom_assets').insert({owner_id:currentUser.id,asset_type:type,scope,scope_id:scopeId,name,asset_url:path,animated:file.type==='image/gif'});
      if(rowError){await client.storage.from('nexus-assets').remove([path]);throw rowError;}
      $('#custom-asset-name').value='';$('#custom-asset-file').value='';await loadAssetPicker();await loadCustomEmojiCache(true);toast('Recurso subido.','success');
    }catch(error){showError(error,'No se pudo subir el recurso. Comprueba la migración v0.7 y las políticas de Storage.');}
    finally{button.disabled=false;}
  }
  async function archiveCustomAsset(id){
    const {error}=await client.from('custom_assets').update({archived_at:new Date().toISOString()}).eq('id',id).eq('owner_id',currentUser.id);
    if(error)showError(error,'No se pudo archivar el recurso.');else{await loadAssetPicker();await loadCustomEmojiCache(true);toast('Recurso archivado. Los mensajes anteriores lo conservan.','success');}
  }
  async function sendStickerMessage(asset){
    if(!currentContext)return;
    if(currentContext.type==='channel'&&currentContext.channelType==='announcements'&&!communityPermissions.post_announcements){toast('Necesitas permiso para publicar aquí.','error');return;}
    const payload={sender_id:currentUser.id,body:`Sticker: ${asset.name}`,message_type:'media',attachment:{kind:'sticker',custom_asset_id:asset.id,name:asset.name},...(activeAltProfile?{alt_profile_id:activeAltProfile.id}:{})};
    payload[currentContext.type==='conversation'?'conversation_id':'channel_id']=currentContext.id;
    const {error}=await client.from('messages').insert(payload);if(error)showError(error,'No se pudo enviar el sticker.');else{$('#asset-picker-dialog').close();toast('Sticker enviado.','success');}
  }
  $('#close-gif-search').addEventListener('click',()=>$('#gif-search-dialog').close());
  $('#gif-search-form').addEventListener('submit',async event=>{event.preventDefault();await searchGiphyGifs($('#gif-search-query').value.trim());});
  function openGifSearch(){
    if(!currentContext)return;
    $('#gif-search-dialog').showModal();
    $('#gif-search-query').focus();
    if(!$('#gif-search-results').dataset.loaded){$('#gif-search-results').dataset.loaded='1';searchGiphyGifs('trending');}
  }
  function isGiphyMediaUrl(value){
    const safe=safeHttpsUrl(value);if(!safe)return false;
    try{const host=new URL(safe).hostname.toLowerCase();return host==='giphy.com'||host.endsWith('.giphy.com');}catch{return false;}
  }
  function getGiphyCustomerId(){
    const key='nexus-giphy-customer-id';
    try{let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}return id;}catch{return 'nexus-'+crypto.randomUUID();}
  }
  function trackGiphyEvent(url){
    if(!url)return;
    try{const target=new URL(url);target.searchParams.set('ts',String(Date.now()));target.searchParams.set('customer_id',getGiphyCustomerId());const beacon=new Image();beacon.referrerPolicy='no-referrer';beacon.src=target.toString();}catch{}
  }
  async function searchGiphyGifs(query){
    const host=$('#gif-search-results');
    const apiKey=String(cfg.GIPHY_API_KEY||'').trim();
    if(!apiKey){host.innerHTML='<p class="empty-state compact">Falta la clave pública GIPHY_API_KEY en assets/js/config.js. Consulta UPGRADE-v0.7.</p>';return;}
    host.innerHTML='<p class="empty-state compact">Buscando GIFs…</p>';
    try{
      const trending=!query||query.toLowerCase()==='trending';
      const endpoint=trending?'https://api.giphy.com/v1/gifs/trending':'https://api.giphy.com/v1/gifs/search';
      const params=new URLSearchParams({api_key:apiKey,limit:'18',rating:'pg',country_code:'ES',lang:'es',bundle:'messaging_non_clips'});
      if(!trending)params.set('q',query.slice(0,50));
      const response=await fetch(`${endpoint}?${params.toString()}`,{headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(response.status===429?'GIPHY ha alcanzado el límite de búsquedas por hora.':`GIPHY respondió con HTTP ${response.status}.`);
      const payload=await response.json();
      const results=(payload.data||[]).flatMap(item=>{
        const images=item.images||{};
        const url=images.original?.url||images.downsized?.url||'';
        const preview=images.fixed_width_small?.url||images.fixed_width?.url||images.downsized_small?.url||url;
        if(!isGiphyMediaUrl(url)||!isGiphyMediaUrl(preview))return[];
        return [{id:String(item.id||''),url,preview_url:preview,alt:String(item.alt_text||item.title||'GIF').slice(0,120),analytics:item.analytics||{}}];
      });
      if(!results.length){host.innerHTML='<p class="empty-state compact">No se encontraron GIFs.</p>';return;}
      host.innerHTML=results.map((item,index)=>`<button type="button" class="gif-result" data-gif-index="${index}"><img src="${escapeHtml(item.preview_url)}" alt="${escapeHtml(item.alt)}" loading="lazy"></button>`).join('');
      const images=$$('img',host);
      images.forEach((image,index)=>image.addEventListener('load',()=>trackGiphyEvent(results[index]?.analytics?.onload?.url),{once:true}));
      $$('[data-gif-index]',host).forEach(button=>button.addEventListener('click',()=>{
        const item=results[Number(button.dataset.gifIndex)];
        trackGiphyEvent(item?.analytics?.onclick?.url);
        sendGiphyGif(item);
      }));
    }catch(error){host.innerHTML=`<p class="empty-state compact">${escapeHtml(error.message||'No se pudo conectar con GIPHY. Comprueba la API key.')}</p>`;}
  }
  async function sendGiphyGif(item){
    if(!item||!isGiphyMediaUrl(item.url)||!isGiphyMediaUrl(item.preview_url)){toast('GIF no válido.','error');return;}
    const payload={sender_id:currentUser.id,body:'GIF de GIPHY',message_type:'media',attachment:{kind:'gif',provider:'giphy',url:item.url,preview_url:item.preview_url,alt:String(item.alt||'GIF').slice(0,120)},...(activeAltProfile?{alt_profile_id:activeAltProfile.id}:{})};
    payload[currentContext.type==='conversation'?'conversation_id':'channel_id']=currentContext.id;
    const {error}=await client.from('messages').insert(payload);
    if(error)showError(error,'No se pudo enviar el GIF.');
    else{trackGiphyEvent(item.analytics?.onsent?.url);$('#gif-search-dialog').close();toast('GIF enviado.','success');}
  }

  async function uploadAttachment(event) {
    const file=event.target.files?.[0];
    event.target.value='';
    await uploadAttachmentFile(file);
  }

  async function handleComposerPaste(event) {
    const items=[...(event.clipboardData?.items||[])];
    const fromItems=items.filter(item=>item.kind==='file'&&(/^(image\/|video\/(mp4|webm)$)/i.test(item.type||'')))
      .map(item=>item.getAsFile()).filter(Boolean);
    const fromFiles=[...(event.clipboardData?.files||[])].filter(file=>/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/i.test(file.type||''));
    const files=fromItems.length?fromItems:fromFiles;
    if(!files.length)return;
    event.preventDefault();
    for(let index=0;index<files.length;index++){
      const source=files[index];
      const ext=source.type==='image/jpeg'?'jpg':source.type==='image/webp'?'webp':source.type==='image/gif'?'gif':source.type==='video/webm'?'webm':source.type==='video/mp4'?'mp4':'png';
      const file=new File([source],source.name||`pegado-${Date.now()}-${index+1}.${ext}`,{type:source.type||'image/png',lastModified:Date.now()});
      await uploadAttachmentFile(file);
    }
  }

  async function uploadAttachmentFile(file) {
    if (!file || !currentContext || !currentUser) return;
    const context={...currentContext};
    const replySnapshot=replyTarget?{...replyTarget}:null;
    const altSnapshot=activeAltProfile?{...activeAltProfile}:null;
    if (context.type === 'channel' && context.channelType === 'announcements' && !communityPermissions.post_announcements) { toast('Necesitas el permiso Publicar anuncios.','error'); return; }
    if (file.size > 50 * 1024 * 1024) { toast('El límite inicial de archivos es 50 MB.', 'error'); return; }
    const extension=(file.name.split('.').pop()||'').toLowerCase();
    let isZip=false;
    if(extension==='zip'&&(!file.type||['application/zip','application/x-zip-compressed','application/octet-stream'].includes(file.type))){
      const signature=new Uint8Array(await file.slice(0,4).arrayBuffer());
      isZip=signature.length===4&&signature[0]===0x50&&signature[1]===0x4b&&(
        (signature[2]===0x03&&signature[3]===0x04)||
        (signature[2]===0x05&&signature[3]===0x06)||
        (signature[2]===0x07&&signature[3]===0x08)
      );
      if(!isZip){toast('El archivo tiene extensión ZIP, pero su contenido no parece un ZIP válido.','error');return;}
    }
    const normalizedMime=isZip?'application/zip':(file.type||'application/octet-stream');
    const allowed = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|application\/(pdf|zip)|text\/plain)$/i;
    if (normalizedMime!=='application/octet-stream'&&!allowed.test(normalizedMime)) { toast('Este tipo de archivo no está permitido.', 'error'); return; }
    if(normalizedMime==='application/octet-stream'&&!isZip){toast('No se pudo identificar el tipo de archivo.','error');return;}

    const isConversation = context.type === 'conversation';
    const folder = isConversation ? 'dm' : 'community';
    const safeExtension = (file.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi,'').slice(0,8) || 'bin';
    const path = `${folder}/${context.id}/${crypto.randomUUID()}.${safeExtension}`;
    const storage = client.storage.from('chat-media');
    toast('Subiendo archivo…');

    try {
      const {error: uploadError} = await storage.upload(path, file, {contentType:normalizedMime,upsert:false});
      if (uploadError) {
        if (/row-level security|security policy/i.test(uploadError.message || '')) {
          throw new Error('Supabase ha bloqueado la subida por sus políticas de Storage. Ejecuta el parche supabase/fix-chat-media-rls.sql en el SQL Editor y vuelve a intentarlo.');
        }
        throw uploadError;
      }
      const payload = {
        sender_id:currentUser.id,
        body:file.name || 'Archivo adjunto',
        message_type:'media',
        ...(altSnapshot ? {alt_profile_id:altSnapshot.id} : {}),
        attachment:{path,name:file.name || 'archivo',mimetype:normalizedMime},
        ...(replySnapshot ? {reply_to:replySnapshot.id} : {})
      };
      payload[isConversation ? 'conversation_id' : 'channel_id'] = context.id;
      const {error: messageError} = await client.from('messages').insert(payload);
      if (messageError) {
        await storage.remove([path]);
        throw new Error(`El archivo se subió, pero no se pudo publicar el mensaje: ${messageError.message}`);
      }
      if(currentContext?.id===context.id&&replyTarget?.id===replySnapshot?.id)clearReplyTarget();
      toast('Archivo enviado.', 'success');
    } catch (error) {
      showError(error, 'No se pudo subir el archivo.');
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
    refreshFriendPresenceIndicators();
    $$('[data-dm]').forEach(button => button.addEventListener('click', () => startDirect(button.dataset.dm)));
    $$('[data-accept]').forEach(button => button.addEventListener('click', () => acceptFriend(button.dataset.accept)));
  }
  function personRow(person, actions = '') {
    if (!person) return '';
    const plate=safeHttpsUrl(person.profile_plate_url);
    const plateStyle=plate?`style="--profile-plate-image:url('${escapeHtml(plate)}');--profile-plate-opacity:${profilePlateOpacity(person.settings)}"`:'';
    const online=onlineUserIds.has(person.id);
    return `<div class="person-row ${online?'is-online':''}" data-person-id="${escapeHtml(person.id)}" ${plateStyle}>${avatarMarkup(person)}<div class="person-row-copy"><strong>${escapeHtml(person.nickname || person.username)}</strong><small>@${escapeHtml(person.username)}</small><small class="person-presence">${online?'En línea':'Desconectado'}</small></div><div class="person-actions">${actions}</div></div>`;
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
    const css=String(source||'').trim();
    if(!css)return '';
    if(css.length>8000||/@import|@font-face|url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding|<|>|\\/i.test(css)){
      throw new Error('El CSS contiene una regla no permitida. Usa únicamente estilos visuales locales.');
    }
    const allowedSelectors=new Set([
      '#view-community','#sidebar-community','#conversation-panel',
      '.active-conversation','.conversation-head','.conversation-head strong','.conversation-head small','.messages','.message','.message-body','.message-author','.message-meta',
      '.message-reply-quote','.message-reactions','.message-attachment','.composer-wrap','.composer','.composer textarea','.composer-send','.pinned-messages','.poll-card','.poll-option',
      '.context-online-members','.presence-member-chip',
      '.community-hero','.community-hero-copy','.community-hero .eyebrow','.community-hero h1','.community-hero p','.community-hero .button','.community-hero .button:hover',
      '.community-info-grid','.community-info-grid .surface','.community-info-grid .surface h2','.community-info-grid .surface p','.community-info-grid .eyebrow','.community-info-grid h2',
      '#community-name','#community-description','.settings-surface','.settings-surface .surface-heading',
      '#community-roles-area','#community-badges-area','.role-card','.role-card:hover','.role-card-head','.role-card-actions','.permission-grid','.member-role-card','.member-role-card:hover','.badge-create-form',
      '.community-invite-result','.invite-tools',
      '.channel-row','#sidebar-community .channel-item','#sidebar-community .channel-item.active','#sidebar-community .channel-item:hover','#sidebar-community .channel-item:focus-visible',
      '#sidebar-community .channel-hash','#sidebar-community .channel-item-name','#sidebar-community .channel-type-mini',
      '#sidebar-community .channel-admin-actions','#sidebar-community .section-label'
    ]);
    const allowedProperties=new Set([
      'color','background','background-color','background-image','border','border-color','border-radius','border-width','border-style',
      'border-top','border-right','border-bottom','border-left','box-shadow','text-shadow','outline','outline-color','outline-width','outline-style',
      'font-family','font-size','font-weight','letter-spacing','line-height','text-align','text-transform','text-decoration',
      'padding','margin','opacity','width','max-width','min-width','height','min-height','gap','row-gap','column-gap','grid-template-columns',
      'display','align-items','justify-content','flex-direction','flex-wrap','overflow','white-space','text-overflow',
      'filter','backdrop-filter','transform','transition','cursor','background-position','background-size','background-repeat',
      'box-sizing','vertical-align','flex','flex-grow','flex-shrink','place-items','isolation',
      '--community-accent','--community-accent-soft','--community-panel','--community-panel-alt','--community-text','--community-muted','--community-border','--community-glow','--community-radius'
    ]);
    const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    if(!rules.length||rules.map(rule=>rule[0]).join('').replace(/\s/g,'')!==css.replace(/\s/g,'')){
      throw new Error('El CSS debe contener reglas sencillas con selector y llaves.');
    }
    const output=[];
    for(const match of rules){
      const selectors=match[1].split(',').map(value=>value.trim());
      if(!selectors.length||selectors.some(selector=>!allowedSelectors.has(selector))){
        throw new Error('Selector no permitido. Consulta la guía de CSS de megagrupos para ver los selectores disponibles.');
      }
      const declarations=[];
      for(const declaration of match[2].split(';')){
        if(!declaration.trim())continue;
        const splitAt=declaration.indexOf(':');
        if(splitAt<1)throw new Error('Hay una declaración CSS no válida.');
        const property=declaration.slice(0,splitAt).trim().toLowerCase();
        const value=declaration.slice(splitAt+1).trim();
        if(!allowedProperties.has(property)||!value||!/^[a-zA-Z0-9#(),.%+\s'"-]+$/.test(value)){
          throw new Error(`La propiedad CSS «${property}» o su valor no está permitido.`);
        }
        declarations.push(`${property}:${value}`);
      }
      if(declarations.length){
        const scoped=selectors.map(selector=>{
          if(selector==='#view-community'||selector==='#sidebar-community'||selector.startsWith('#sidebar-community '))return selector;
          if(selector==='#conversation-panel')return '#conversation-panel.community-chat-active';
          if(selector.startsWith('.active-conversation')||selector.startsWith('.conversation-head')||selector==='.messages'||selector.startsWith('.message')||selector.startsWith('.composer')||selector==='.pinned-messages'||selector.startsWith('.poll-')||selector==='.context-online-members'||selector==='.presence-member-chip')return `#conversation-panel.community-chat-active ${selector}`;
          if(selector==='.channel-row')return `#sidebar-community ${selector}`;
          return `#view-community ${selector}`;
        });
        output.push(`${scoped.join(',')} { ${declarations.join(';')} }`);
      }
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
    if(voiceSession)await leaveVoiceRoom({refresh:false});
    currentCommunity = community;
    await loadCommunities();
    $('#community-name').textContent = community.name;
    $('#community-description').textContent = community.description || 'Sin descripción.';
    $('#community-id-short').textContent = community.id.slice(0,8);
    applyCommunityAppearance(community);
    switchView('community');
    const permissionNames = ['manage_roles','manage_badges','manage_messages','manage_channels','post_announcements','create_invites'];
    const permissionResults = await Promise.all(permissionNames.map(p_permission => client.rpc('has_community_permission',{p_community_id:community.id,p_permission})));
    permissionNames.forEach((name,index) => { communityPermissions[name] = Boolean(permissionResults[index].data); });
    $('#community-settings').classList.toggle('hidden',community.owner_id !== currentUser.id && !communityPermissions.create_invites);
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
      const plate=safeHttpsUrl(person.profile_plate_url);
      const plateStyle=plate?`style="--profile-plate-image:url('${escapeHtml(plate)}');--profile-plate-opacity:${profilePlateOpacity(person.settings)}"`:'';
      return `<div class="member-role-card" ${plateStyle}><div class="member-role-person">${avatarMarkup(person)}<span><strong>${escapeHtml(member.nickname || person.nickname || person.username)}</strong><small>@${escapeHtml(person.username || 'usuario')}${member.user_id === currentCommunity.owner_id ? ' · propietario' : ''}</small></span></div><div class="member-role-toggles">${toggles || '<span class="muted">Crea un rol para poder asignarlo.</span>'}</div></div>`;
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
    renderChannelUnreadBadges();
    refreshUnreadCounts();
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

  // ---------- Peer-to-peer voice rooms using private Supabase Realtime signalling ----------
  function voiceStatus(text){const node=$('#voice-status');if(node)node.textContent=text;const dock=$('#voice-session-dock-subtitle');if(dock&&voiceSession)dock.textContent=text;}
  function renderVoiceDock(){
    const dock=$('#voice-session-dock');if(!dock)return;
    const session=voiceSession;
    const show=Boolean(session&&currentContext?.type==='channel'&&currentContext?.id!==session.channelId);
    dock.classList.toggle('hidden',!show);
    if(!show)return;
    const title=$('#voice-session-dock-title');if(title)title.textContent=`En llamada · ${session.channelName||'Canal de voz'}`;
    const subtitle=$('#voice-session-dock-subtitle');if(subtitle)subtitle.textContent=session.localJoined?(session.muted?'Micrófono silenciado · la llamada sigue activa':'La llamada continúa mientras navegas por Nexus.'):'Conectando a la sala de voz…';
    const mute=$('#voice-session-dock-mute');if(mute){mute.disabled=!session.localJoined;mute.textContent=session.muted?'Activar micrófono':'Silenciar';}
    const leave=$('#voice-session-dock-leave');if(leave)leave.disabled=!session.localJoined;
  }
  function renderVoiceParticipants(){
    const host=$('#voice-participants');if(!host||!voiceSession)return;
    const state=voiceSession.channel?.presenceState?.()||{};const participants=[];
    for(const key of Object.keys(state)){const first=state[key]?.[0]||{};participants.push({id:first.user_id||key,name:first.nickname||first.username||'Miembro',avatar_url:safeHttpsUrl(first.avatar_url),profile_frame_url:safeHttpsUrl(first.profile_frame_url),profile_plate_url:safeHttpsUrl(first.profile_plate_url),profile_plate_opacity:Math.max(0,Math.min(.6,Number(first.profile_plate_opacity??.13))),self:(first.user_id||key)===currentUser.id});}
    if(!participants.length&&voiceSession.localJoined)participants.push({id:currentUser.id,name:profile?.nickname||profile?.username||'Tú',avatar_url:safeHttpsUrl(profile?.avatar_url),profile_frame_url:safeHttpsUrl(profile?.profile_frame_url),profile_plate_url:safeHttpsUrl(profile?.profile_plate_url),profile_plate_opacity:profilePlateOpacity(profile?.settings),self:true});
    const compact=Boolean(profile?.settings?.voiceCompactMode);
    host.classList.toggle('voice-participants-compact',compact);
    if(compact){host.innerHTML=participants.map(item=>`<span class="voice-participant ${item.self?'self':''}"><i></i>${escapeHtml(item.name)}${item.self?' · Tú':''}</span>`).join('')||'<span class="tag">Aún no hay participantes conectados</span>';}
    else{
      host.innerHTML=participants.map(item=>{
        const avatar=avatarMarkup({avatar_url:item.avatar_url,profile_frame_url:item.profile_frame_url,nickname:item.name},'voice-participant-avatar');
        const plate=item.profile_plate_url?`style="--voice-card-plate:url('${escapeHtml(item.profile_plate_url)}');--voice-card-plate-opacity:${item.profile_plate_opacity}"`:'';
        return `<article class="voice-participant-card ${item.self?'self':''}" ${plate}><div class="voice-participant-photo">${avatar}</div><strong>${escapeHtml(item.name)}${item.self?' · Tú':''}</strong><span class="voice-speaking-indicator">● Conectado</span></article>`;
      }).join('')||'<span class="tag">Aún no hay participantes conectados</span>';
    }
    const join=$('#join-voice-room'),mute=$('#voice-mute'),leave=$('#leave-voice-room');if(join)join.disabled=Boolean(voiceSession.localJoined);if(mute)mute.disabled=!voiceSession.localJoined;if(leave)leave.disabled=!voiceSession.localJoined;
    if(mute)mute.textContent=voiceSession.muted?'Activar micrófono':'Silenciar';
    renderVoiceDock();
  }
  function getVoicePeer(peerId){
    if(voiceSession.peers.has(peerId))return voiceSession.peers.get(peerId);
    if(voiceSession.peers.size>=5){voiceStatus('Sala llena: el modo P2P admite hasta 6 personas por navegador.');return null;}
    const pc=new RTCPeerConnection({iceServers:Array.isArray(cfg.VOICE_ICE_SERVERS)?cfg.VOICE_ICE_SERVERS:[{urls:'stun:stun.l.google.com:19302'}]});
    const peer={pc,candidates:[],audio:null};voiceSession.peers.set(peerId,peer);
    voiceSession.stream.getAudioTracks().forEach(track=>pc.addTrack(track,voiceSession.stream));
    pc.onicecandidate=event=>{if(event.candidate)sendVoiceSignal(peerId,{candidate:event.candidate.toJSON()});};
    pc.ontrack=event=>{const stream=event.streams?.[0];if(!stream)return;let audio=peer.audio;if(!audio){audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;audio.dataset.voicePeer=peerId;($('#global-voice-audio-host')||$('#voice-audio-host'))?.append(audio);peer.audio=audio;}audio.srcObject=stream;audio.play().catch(()=>voiceStatus('Toca la página para permitir la reproducción de audio.'));};
    pc.onconnectionstatechange=()=>{if(['failed','disconnected','closed'].includes(pc.connectionState))console.warn('Conexión de voz:',peerId,pc.connectionState);};
    return peer;
  }
  async function sendVoiceSignal(to,payload){if(!voiceSession?.channel)return;await voiceSession.channel.send({type:'broadcast',event:'signal',payload:{from:currentUser.id,to,...payload}});}
  async function createVoiceOffer(peerId){
    const peer=getVoicePeer(peerId);if(!peer||peer.offered)return;peer.offered=true;
    try{const offer=await peer.pc.createOffer();await peer.pc.setLocalDescription(offer);await sendVoiceSignal(peerId,{description:peer.pc.localDescription.toJSON()});}catch(error){console.warn('No se pudo crear oferta de voz:',error);}
  }
  async function handleVoiceSignal(message){
    const data=message?.payload;if(!voiceSession||!data||data.to!==currentUser.id||data.from===currentUser.id)return;
    const peer=getVoicePeer(data.from);if(!peer)return;
    try{
      if(data.description){await peer.pc.setRemoteDescription(data.description);if(data.description.type==='offer'){const answer=await peer.pc.createAnswer();await peer.pc.setLocalDescription(answer);await sendVoiceSignal(data.from,{description:peer.pc.localDescription.toJSON()});}for(const candidate of peer.candidates.splice(0))await peer.pc.addIceCandidate(candidate);}
      if(data.candidate){const candidate=new RTCIceCandidate(data.candidate);if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(candidate);else peer.candidates.push(candidate);}
    }catch(error){console.warn('Señal de voz descartada:',error);}
  }
  async function syncVoicePeers(){
    if(!voiceSession?.localJoined)return;const state=voiceSession.channel.presenceState()||{};
    for(const peerId of Object.keys(state)){if(peerId===currentUser.id||voiceSession.peers.has(peerId))continue;if(currentUser.id.localeCompare(peerId)<0)await createVoiceOffer(peerId);}
    renderVoiceParticipants();renderContextPresence();
  }
  async function joinVoiceRoom(){
    if(voiceSession?.localJoined||!currentContext||currentContext.type!=='channel'||currentContext.channelType!=='voice')return;
    const button=$('#join-voice-room');if(button)button.disabled=true;voiceStatus('Solicitando acceso al micrófono…');
    try{
      if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw new Error('Este navegador no admite WebRTC o no está usando HTTPS.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      const channelId=currentContext.id;const topic=`nexus-voice:${channelId}`;
      const realtime=client.channel(topic,{config:{private:true,presence:{key:currentUser.id},broadcast:{ack:true,self:false}}});
      voiceSession={channelId,channelName:String(currentContext.title||'Canal de voz').replace(/^◖\s*/,''),channel:realtime,stream,peers:new Map(),localJoined:false,muted:false};
      renderVoiceDock();
      realtime.on('broadcast',{event:'signal'},handleVoiceSignal);
      realtime.on('presence',{event:'sync'},syncVoicePeers);
      realtime.on('presence',{event:'join'},syncVoicePeers);
      realtime.on('presence',{event:'leave'},event=>{const key=event?.key||event?.leftPresences?.[0]?.user_id;if(key&&voiceSession?.peers.has(key)){const peer=voiceSession.peers.get(key);peer.pc.close();peer.audio?.remove();voiceSession.peers.delete(key);}renderVoiceParticipants();renderContextPresence();});
      realtime.subscribe(async status=>{
        if(status==='SUBSCRIBED'){
          try{await realtime.track({user_id:currentUser.id,username:profile?.username||'usuario',nickname:profile?.nickname||profile?.username||'Usuario',avatar_url:safeHttpsUrl(profile?.avatar_url),profile_frame_url:safeHttpsUrl(profile?.profile_frame_url),profile_plate_url:safeHttpsUrl(profile?.profile_plate_url),profile_plate_opacity:profilePlateOpacity(profile?.settings),status_text:String(profile?.settings?.customStatus||'').slice(0,60),joined_at:new Date().toISOString()});voiceSession.localJoined=true;voiceStatus('Conectado · micrófono activo');renderVoiceParticipants();renderVoiceDock();renderContextPresence();await syncVoicePeers();}
          catch(error){voiceStatus('No se pudo entrar en la sala.');showError(error,'No se pudo activar la señalización de voz.');}
        }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){voiceStatus('No se pudo conectar a la sala. Comprueba las políticas Realtime privadas.');}
      });
    }catch(error){if(voiceSession?.stream)voiceSession.stream.getTracks().forEach(track=>track.stop());voiceSession=null;renderVoiceDock();voiceStatus(error.name==='NotAllowedError'?'Permiso de micrófono denegado.':error.message||'No se pudo activar el micrófono.');showError(error,'No se pudo entrar en el canal de voz.');renderVoiceParticipants();}
  }
  function toggleVoiceMute(){if(!voiceSession?.stream)return;voiceSession.muted=!voiceSession.muted;voiceSession.stream.getAudioTracks().forEach(track=>track.enabled=!voiceSession.muted);const button=$('#voice-mute');if(button)button.textContent=voiceSession.muted?'Activar micrófono':'Silenciar';voiceStatus(voiceSession.muted?'Conectado · micrófono silenciado':'Conectado · micrófono activo');renderVoiceDock();}
  async function leaveVoiceRoom(options={}){
    const session=voiceSession;if(!session)return;voiceSession=null;renderVoiceDock();
    // Stop local capture immediately; do not leave the microphone active while waiting for Realtime.
    session.stream?.getTracks().forEach(track=>track.stop());
    try{await session.channel?.untrack();}catch{};
    for(const peer of session.peers.values()){peer.pc.close();peer.audio?.remove();}
    if(session.channel)await client.removeChannel(session.channel);
    renderContextPresence();
    if(options.refresh!==false&&currentContext?.type==='channel'&&currentContext.channelType==='voice')await showMessagePanel();
  }

  async function openCommunityChannel(channel) {
    if (voiceSession && channel.type==='voice' && voiceSession.channelId!==channel.id) await leaveVoiceRoom({refresh:false});
    switchView('chats');
    if(currentContext?.type==='channel'&&currentContext.id===channel.id){
      $('#app-screen').classList.add('mobile-chat-open');
      if(channel.type==='voice'&&$('#voice-status')){renderVoiceParticipants();return;}
      if($('#messages-container')){await syncMessageDelta({...currentContext},{render:true});$$('.channel-item').forEach(button=>button.classList.toggle('active',button.dataset.channel===channel.id));return;}
    }
    replyTarget = null;
    if (channel.type === 'voice') {
      if (activeMessageChannel) { client.removeChannel(activeMessageChannel); activeMessageChannel = null; }
      currentContext = {type:'channel',id:channel.id,title:`◖ ${channel.name}`,subtitle:`${currentCommunity.name} · ${channelTypeLabel(channel.type)}`,channelType:channel.type,channelDescription:channel.description || ''};
      renderVoiceDock();
      switchView('chats'); $('#app-screen').classList.toggle('community-focus',Boolean(profile?.settings?.compactPanels)); $('#app-screen').classList.add('mobile-chat-open');
      await showMessagePanel();
      $$('.channel-item').forEach(button => button.classList.toggle('active',button.dataset.channel === channel.id));
      return;
    }
    currentContext = {type:'channel',id:channel.id,title:`${channelTypeIcon(channel.type)} ${channel.name}`,subtitle:currentCommunity.name,channelType:channel.type,channelDescription:channel.description || ''};
    renderVoiceDock();
    switchView('chats'); $('#app-screen').classList.toggle('community-focus',Boolean(profile?.settings?.compactPanels)); $('#app-screen').classList.add('mobile-chat-open');
    await showMessagePanel();
    if (channel.type === 'media') $('#message-input').placeholder = 'Este canal solo admite archivos…';
    await loadMessages();
    subscribeMessages();
    $$('.channel-item').forEach(button => button.classList.toggle('active',button.dataset.channel === channel.id));
  }
  $('#add-channel').addEventListener('click', () => openChannelEditor());
  $('#community-settings').addEventListener('click', () => {
    if (!currentCommunity) return;
    const isOwner=currentCommunity.owner_id===currentUser.id;
    if (!isOwner && !communityPermissions.create_invites) return;
    $('#community-owner-settings').classList.toggle('hidden',!isOwner);
    $('#save-community-settings').classList.toggle('hidden',!isOwner);
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
  $('#create-community-invite').addEventListener('click', createCommunityInvite);
  async function createCommunityInvite() {
    if (!currentCommunity) { toast('Selecciona primero un megagrupo.','error'); return; }
    if (currentCommunity.owner_id!==currentUser.id && !communityPermissions.create_invites) { toast('No tienes permiso para crear invitaciones en este megagrupo.','error'); return; }
    const button = $('#create-community-invite');
    button.disabled = true; button.textContent = 'Creando…';
    try {
      const {data,error} = await client.rpc('create_community_invite',{p_community_id:currentCommunity.id,p_expires_hours:168,p_max_uses:0});
      if (error) throw error;
      const code = typeof data === 'string' ? data : (data?.code || data?.invite_code || '');
      if (!/^[A-F0-9]{12}$/i.test(code)) throw new Error(`Supabase no devolvió un código válido de invitación: ${JSON.stringify(data)}`);
      const inviteUrl = new URL(location.href);
      inviteUrl.search = '';
      inviteUrl.searchParams.set('invite',code.toUpperCase());
      inviteUrl.hash = '';
      $('#community-invite-url').value = inviteUrl.toString();
      $('#community-invite-result').classList.remove('hidden');
      $('#community-invite-url').focus(); $('#community-invite-url').select();
      try { await navigator.clipboard.writeText(inviteUrl.toString()); toast('Invitación creada y copiada. También puedes copiar el enlace del cuadro.','success'); }
      catch { toast('Invitación creada. Copia el enlace del cuadro.','success'); }
    } catch (error) {
      showError(error,'No se pudo crear la invitación. Comprueba la migración v0.6 y el permiso «Crear invitaciones».');
    } finally { button.disabled = false; button.textContent = 'Crear enlace de invitación'; }
  }
  $('#copy-community-invite').addEventListener('click', async () => {
    const input = $('#community-invite-url');
    if (!input.value) return;
    try { await navigator.clipboard.writeText(input.value); toast('Enlace copiado.','success'); }
    catch { input.focus(); input.select(); toast('Selecciona y copia el enlace.'); }
  });

  async function consumePendingCommunityInvite() {
    const url = new URL(location.href);
    const code = url.searchParams.get('invite') || readPendingInvite();
    if (!code) return;
    if (!/^[A-F0-9]{12}$/i.test(code)) { clearPendingInvite(); return; }
    const {data:communityId,error} = await client.rpc('join_community_by_invite',{p_code:code.toUpperCase()});
    if (error) { showError(error,'No se pudo aceptar la invitación. El enlace seguirá guardado para que puedas volver a intentarlo.'); return; }
    const {data:community, error:communityError} = await client.from('communities').select('*').eq('id',communityId).single();
    if (communityError) { showError(communityError); return; }
    url.searchParams.delete('invite');
    history.replaceState(null,'',url.pathname + url.search + url.hash);
    clearPendingInvite();
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
    const widgets = Array.isArray(profile?.widgets) ? profile.widgets.slice(0,32) : [];
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
      if(widget.type==='link' && safeHttpsUrl(widget.url)){
        card.classList.add('profile-widget-link-card');
        const link=document.createElement('a');link.className='profile-widget-open-link';link.href=safeHttpsUrl(widget.url);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir enlace ↗';
        const iconImage=document.createElement('img');iconImage.className='profile-widget-favicon';iconImage.alt='';iconImage.loading='lazy';
        try{const hostName=new URL(widget.url).hostname;iconImage.src=`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostName)}&sz=64`;iconImage.onerror=()=>{icon.replaceChildren(document.createTextNode('↗'));};}catch{icon.textContent='↗';}
        icon.replaceChildren(iconImage);card.append(icon, title, desc, link, remove);
      }else card.append(banner,icon,title,desc,remove);
      list.append(card);
    });
    const count = $('#profile-widget-count'); if (count) count.textContent = `${widgets.length}/32`;
  }

  $('#profile-widget-form').addEventListener('submit', async event => {
    event.preventDefault();
    const widgets = Array.isArray(profile?.widgets) ? [...profile.widgets] : [];
    if (widgets.length >= 32) { toast('Tu perfil ya tiene el máximo de 32 widgets.','error'); return; }
    let title = $('#widget-title').value.trim();
    const description = $('#widget-description').value.trim();
    const type=$('#widget-type')?.value||'card';
    const icon = $('#widget-icon').value.trim() || '✦';
    const banner = $('#widget-banner').value.trim() || '#34304f';
    const url=$('#widget-url')?.value.trim()||'';
    if (title.length > 50 || description.length > 220) { toast('Revisa el título o la descripción del widget.','error'); return; }
    if(type==='link'){
      if(!safeHttpsUrl(url)){toast('El widget de enlace necesita una URL HTTPS válida.','error');return;}
      if(!title){try{title=new URL(safeHttpsUrl(url)).hostname;}catch{title='Enlace';}}
      widgets.push({id:crypto.randomUUID(),type:'link',title,description,url:safeHttpsUrl(url)});
    }else{
      if(!title){toast('Las tarjetas necesitan un título.','error');return;}
      if (icon.length > 300 || (icon.startsWith('http') && !safeHttpsUrl(icon))) { toast('El icono debe ser un emoji o una URL HTTPS.','error'); return; }
      if (!/^#[0-9a-f]{6}$/i.test(banner) && !safeHttpsUrl(banner)) { toast('El banner debe ser un color HEX o una URL HTTPS.','error'); return; }
      widgets.push({id:crypto.randomUUID(),type:'card',title,description,icon,banner});
    }
    const {error} = await client.from('profiles').update({widgets}).eq('id',currentUser.id);
    if (error) { showError(error,'No se pudo guardar el widget.'); return; }
    profile.widgets = widgets; $('#profile-widget-form').reset(); $('#widget-banner').value='#34304f'; $('#widget-url-field')?.classList.add('hidden'); $('#widget-banner-field')?.classList.remove('hidden'); renderProfileWidgets();
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

  function ownProfileStoragePath(value) {
    const safe=safeHttpsUrl(value);
    if(!safe || !cfg.SUPABASE_URL) return null;
    try {
      const assetUrl=new URL(safe), projectUrl=new URL(cfg.SUPABASE_URL);
      if(assetUrl.host!==projectUrl.host) return null;
      const marker='/storage/v1/object/public/profile-media/';
      const index=assetUrl.pathname.indexOf(marker);
      if(index<0) return null;
      const objectPath=decodeURIComponent(assetUrl.pathname.slice(index+marker.length));
      return objectPath.startsWith(`${currentUser.id}/`) ? objectPath : null;
    } catch { return null; }
  }
  async function removeOwnProfileAsset(value) {
    const path=ownProfileStoragePath(value);
    if(!path) return;
    const {error}=await client.storage.from('profile-media').remove([path]);
    if(error) console.warn('No se pudo limpiar un archivo de perfil antiguo:',error.message);
  }

  async function detectProfileAssetMime(file, extension, isFont) {
    // Do not trust File.type: some Linux/browser combinations return
    // application/octet-stream for perfectly valid images and fonts.
    // Validate the file signature and set the MIME ourselves instead.
    const imageMimeByExtension = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      webp: 'image/webp', gif: 'image/gif'
    };
    const fontMimeByExtension = {
      woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf'
    };
    const mime = (isFont ? fontMimeByExtension : imageMimeByExtension)[extension];
    if (!mime) throw new Error(isFont
      ? 'La fuente debe ser .woff, .woff2 o .ttf.'
      : 'Usa una imagen PNG, JPG, WebP o GIF.');

    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const ascii = (start, length) => String.fromCharCode(...header.slice(start, start + length));
    let valid = false;
    if (extension === 'png') {
      valid = header.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((b,i) => header[i] === b);
    } else if (extension === 'jpg' || extension === 'jpeg') {
      valid = header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    } else if (extension === 'gif') {
      valid = header.length >= 6 && ['GIF87a','GIF89a'].includes(ascii(0,6));
    } else if (extension === 'webp') {
      valid = header.length >= 12 && ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP';
    } else if (extension === 'woff') {
      valid = header.length >= 4 && ascii(0,4) === 'wOFF';
    } else if (extension === 'woff2') {
      valid = header.length >= 4 && ascii(0,4) === 'wOF2';
    } else if (extension === 'ttf') {
      valid = header.length >= 4 && ((header[0] === 0x00 && header[1] === 0x01 && header[2] === 0x00 && header[3] === 0x00) || ascii(0,4) === 'true');
    }
    if (!valid) throw new Error('El contenido del archivo no coincide con su extensión. Prueba a exportarlo de nuevo como PNG, JPG, WebP, GIF o fuente compatible.');
    return mime;
  }

  async function uploadProfileAsset(file, kind) {
    if (!file) return;
    const isFont = kind === 'name_font_url';
    const inputSelectorByKind = {
      name_font_url: '#profile-font-file',
      name_effect_url: '#profile-name-effect-file',
      profile_effect_url: '#profile-avatar-effect-file',
      profile_plate_url: '#profile-plate-file',
      profile_frame_url: '#profile-frame-file',
      avatar_url: '#profile-avatar-file',
      banner_url: '#profile-banner-file'
    };
    const input = document.querySelector(inputSelectorByKind[kind] || '');
    const rawExtension = (file.name.split('.').pop() || '').toLowerCase();
    const extension = rawExtension.replace(/[^a-z0-9]/g, '').slice(0, 8);

    if (file.size > 8 * 1024 * 1024) {
      toast('El archivo debe pesar menos de 8 MB.', 'error');
      if (input) input.value = '';
      return;
    }

    let contentType;
    try {
      contentType = await detectProfileAssetMime(file, extension, isFont);
    } catch (error) {
      toast(error.message || 'El formato del archivo no es válido.', 'error');
      if (input) input.value = '';
      return;
    }

    // Upload a Blob with an explicit MIME for images AND fonts. This avoids
    // leaking the browser's generic application/octet-stream File.type to Storage.
    const uploadBody = new Blob([file], { type: contentType });
    const path = `${currentUser.id}/identity-${kind}-${Date.now()}.${extension}`;
    const storage = client.storage.from('profile-media');

    try {
      const { error: uploadError } = await storage.upload(path, uploadBody, {
        contentType,
        upsert: false,
        cacheControl: '3600'
      });
      if (uploadError) {
        const message = String(uploadError.message || '');
        if (/mime type .* not supported/i.test(message)) {
          throw new Error(`Supabase todavía no permite ${contentType} en el bucket profile-media. Ejecuta la migración 20261101_nexus_v072_profile_asset_mime.sql y vuelve a intentarlo.`);
        }
        throw uploadError;
      }

      const { data } = storage.getPublicUrl(path);
      const previousUrl = profile?.[kind];
      const { error } = await client.from('profiles').update({ [kind]: data.publicUrl }).eq('id', currentUser.id);
      if (error) {
        await storage.remove([path]);
        throw error;
      }

      profile[kind] = data.publicUrl;
      if (previousUrl && previousUrl !== data.publicUrl) await removeOwnProfileAsset(previousUrl);
      messageIdentityCache.clear();
      renderIdentity();
      renderIdentityAssetLinks();
      if (currentContext) await loadMessages();
      await loadConversations();
      toast(isFont ? 'Fuente personalizada actualizada.' : kind==='profile_frame_url' ? 'Marco de perfil actualizado.' : 'Efecto de perfil actualizado.', 'success');
    } catch (error) {
      showError(error, 'No se pudo subir el archivo.');
    } finally {
      if (input) input.value = '';
    }
  }
  async function uploadProfileImage(file, kind) {
    if (!file) return;
    const field=kind==='avatar'?'avatar_url':'banner_url';
    await uploadProfileAsset(file,field);
  }
  $('#profile-avatar-file').addEventListener('change',event => uploadProfileImage(event.target.files?.[0],'avatar'));
  $('#profile-banner-file').addEventListener('change',event => uploadProfileImage(event.target.files?.[0],'banner'));
  $('#profile-plate-opacity').value=String(profilePlateOpacity(profile?.settings));
  $('#profile-plate-opacity-value').textContent=`${Math.round(profilePlateOpacity(profile?.settings)*100)}%`;
  $('#profile-plate-opacity').addEventListener('input',event=>$('#profile-plate-opacity-value').textContent=`${Math.round(Number(event.target.value)*100)}%`);
  $('#save-profile-plate-opacity').addEventListener('click',async()=>{
    const settings={...(profile?.settings||{}),profilePlateOpacity:profilePlateOpacity({profilePlateOpacity:$('#profile-plate-opacity').value})};
    const {error}=await client.from('profiles').update({settings}).eq('id',currentUser.id);
    if(error){showError(error);return;}
    profile.settings=settings; messageIdentityCache.clear();
    if(currentContext) await loadMessages();
    await loadConversations();
    toast('Opacidad del efecto de placa guardada.','success');
  });
  $('#profile-name-effect-file').addEventListener('change',event=>uploadProfileAsset(event.target.files?.[0],'name_effect_url'));
  $('#profile-avatar-effect-file').addEventListener('change',event=>uploadProfileAsset(event.target.files?.[0],'profile_effect_url'));
  $('#profile-plate-file').addEventListener('change',event=>uploadProfileAsset(event.target.files?.[0],'profile_plate_url'));
  $('#profile-frame-file').addEventListener('change',event=>uploadProfileAsset(event.target.files?.[0],'profile_frame_url'));
  $('#profile-font-file').addEventListener('change',event=>uploadProfileAsset(event.target.files?.[0],'name_font_url'));

  function renderIdentityAssetLinks() {
    const host=$('#identity-current-assets'); if(!host || !profile) return;
    const labels={name_effect_url:'Efecto del nombre',profile_effect_url:'Efecto del avatar',profile_plate_url:'Efecto de placa',profile_frame_url:'Marco del avatar',name_font_url:'Fuente personalizada'};
    host.innerHTML=Object.entries(labels).map(([field,label])=>profile[field]?`<div class="identity-asset-row"><span>${escapeHtml(label)}</span><a href="${escapeHtml(safeHttpsUrl(profile[field]))}" target="_blank" rel="noopener">Ver archivo</a><button type="button" class="button button-secondary" data-remove-identity-asset="${field}">Quitar</button></div>`:'').join('') || '<p class="muted small-muted">Todavía no hay efectos personalizados.</p>';
    $$('[data-remove-identity-asset]').forEach(button=>button.addEventListener('click',async()=>{
      const field=button.dataset.removeIdentityAsset;
      const previousUrl=profile[field];
      const {error}=await client.from('profiles').update({[field]:null}).eq('id',currentUser.id);
      if(error) showError(error); else {profile[field]=null;await removeOwnProfileAsset(previousUrl);renderIdentity();renderIdentityAssetLinks();messageIdentityCache.clear();if(currentContext) await loadMessages();await loadConversations();toast('Personalización retirada.','success');}
    }));
  }

  $('#alt-create-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const username=$('#alt-username').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
    const nickname=$('#alt-nickname').value.trim();
    const avatar=$('#alt-avatar').value.trim();
    if(username.length<3||username.length>24) {toast('El usuario alternativo debe tener entre 3 y 24 caracteres.','error');return;}
    if(avatar && !safeHttpsUrl(avatar)){toast('El avatar debe ser una dirección HTTPS válida.','error');return;}
    const {data,error}=await client.from('alt_profiles').insert({owner_id:currentUser.id,username,nickname:nickname||username,avatar_url:avatar||null}).select('*').single();
    if(error){showError(error,'No se pudo crear la alt. Comprueba que no exista otra con ese usuario.');return;}
    $('#alt-create-form').reset(); await activateAltProfile(data);
  });
  $('#use-main-identity').addEventListener('click',()=>activateAltProfile(null));
  function fillSettingsForm() {
    const settings = profile?.settings || {};
    $('#setting-accent').value = settings.accent || '#8d7cff';
    $('#setting-density').value = settings.density || 'comfortable';
    $('#setting-background').value = settings.background || '';
    $('#setting-notify-sound').checked = settings.notifySound !== false;
    $('#setting-notify-while-open').checked = settings.notifyWhileOpen !== false;
    $('#setting-composer-font').value = settings.composerFont || 'default';
    $('#setting-custom-status').value = String(settings.customStatus || '').slice(0,60);
    $('#setting-compact-panels').checked=Boolean(settings.compactPanels);
    $('#setting-voice-compact').checked=Boolean(settings.voiceCompactMode);
    applyClientPreferences();
  }
  function applyClientPreferences(){
    const settings=profile?.settings||{};
    $('#app-screen')?.classList.toggle('compact-panels',Boolean(settings.compactPanels));
    $('#app-screen')?.classList.toggle('community-focus',Boolean(settings.compactPanels&&currentCommunity&&(currentView==='community'||(currentView==='chats'&&currentContext?.type==='channel'))));
  }
  $('#widget-type')?.addEventListener('change',()=>{const link=$('#widget-type').value==='link';$('#widget-url-field')?.classList.toggle('hidden',!link);$('#widget-banner-field')?.classList.toggle('hidden',link);$('#widget-icon')?.closest('.field')?.classList.toggle('hidden',link);});
  $('#settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    const settings = {...(profile?.settings||{}),accent:$('#setting-accent').value,density:$('#setting-density').value,background:$('#setting-background').value.trim(),notifySound:$('#setting-notify-sound').checked,notifyWhileOpen:$('#setting-notify-while-open').checked,composerFont:$('#setting-composer-font').value,customStatus:$('#setting-custom-status').value.trim().slice(0,60),compactPanels:$('#setting-compact-panels').checked,voiceCompactMode:$('#setting-voice-compact').checked};
    const {error} = await client.from('profiles').update({settings}).eq('id',currentUser.id);
    if (error) showError(error); else { profile.settings = settings; renderIdentity(); applyClientPreferences(); applyComposerFont($('#message-input')); if(voiceSession)renderVoiceParticipants(); if(activeMessageChannel)activeMessageChannel.track({user_id:currentUser.id,username:profile.username||'usuario',nickname:profile.nickname||profile.username||'Usuario',avatar_url:safeHttpsUrl(profile.avatar_url),profile_frame_url:safeHttpsUrl(profile.profile_frame_url),profile_plate_url:safeHttpsUrl(profile.profile_plate_url),profile_plate_opacity:profilePlateOpacity(settings),status_text:settings.customStatus,joined_at:new Date().toISOString()}).then(renderContextPresence).catch(()=>{}); if(globalPresenceChannel)globalPresenceChannel.track({user_id:currentUser.id,username:profile.username||'usuario',nickname:profile.nickname||profile.username||'Usuario',avatar_url:safeHttpsUrl(profile.avatar_url),profile_frame_url:safeHttpsUrl(profile.profile_frame_url),profile_plate_url:safeHttpsUrl(profile.profile_plate_url),profile_plate_opacity:profilePlateOpacity(settings),status_text:settings.customStatus,joined_at:new Date().toISOString()}).then(syncGlobalPresence).catch(()=>{}); toast('Apariencia guardada.','success'); }
  });
  $('#change-password').addEventListener('click', async () => {
    const recoveryRedirect=new URL(location.href); recoveryRedirect.search=''; recoveryRedirect.hash=''; recoveryRedirect.searchParams.set('recovery','1');
    const {error} = await client.auth.resetPasswordForEmail(currentUser.email,{redirectTo:recoveryRedirect.toString()});
    if (error) showError(error); else toast('Enlace de recuperación enviado a tu correo.','success');
  });

  // ---------- Workshop ----------
  $('#publish-preset').addEventListener('click', publishPreset);
  async function loadPresets() {
    const {data,error}=await client.from('presets').select('id,name,description,preset_type,config,owner_id,created_at').eq('is_public',true).order('created_at',{ascending:false}).limit(60);
    if(error){console.warn(error);return;}
    const rows=data||[]; const ownerMap=await fetchProfiles(rows.map(row=>row.owner_id));
    const ids=rows.map(row=>row.id); let reviews=[];
    if(ids.length){const response=await client.from('preset_reviews').select('preset_id,reviewer_id,rating,review').in('preset_id',ids);if(!response.error)reviews=response.data||[];}
    const stats=new Map();
    for(const row of reviews){const v=stats.get(row.preset_id)||{sum:0,count:0,mine:null};v.sum+=row.rating;v.count++;if(row.reviewer_id===currentUser.id)v.mine=row.rating;stats.set(row.preset_id,v);}
    $('#preset-grid').innerHTML=rows.length?rows.map(row=>{
      const cfg=row.config||{};const stat=stats.get(row.id)||{sum:0,count:0,mine:null};
      const accent=/^#[0-9a-f]{6}$/i.test(cfg.accent||'')?cfg.accent:/^#[0-9a-f]{6}$/i.test(cfg.name_color||'')?cfg.name_color:'#8d7cff';
      const kind=row.preset_type==='profile'?'Perfil':row.preset_type==='community'?'Megagrupo':'Cliente';
      const stars=[1,2,3,4,5].map(n=>`<button type="button" class="preset-star ${stat.mine&&n<=stat.mine?'selected':''}" data-rate-preset="${row.id}" data-rating="${n}" ${row.owner_id===currentUser.id?'disabled title="No puedes valorar tu propio preset"':''} aria-label="Valorar ${n} de 5">★</button>`).join('');
      return `<article class="preset-card"><div class="preset-swatch" style="background:linear-gradient(125deg,${escapeHtml(accent)},#252d42)"></div><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.description||'Sin descripción.')}</p><small class="muted">${kind} · @${escapeHtml(ownerMap[row.owner_id]?.username||'usuario')}</small><div class="preset-rating"><span>${stat.count?(stat.sum/stat.count).toFixed(1):'—'} · ${stat.count} valoración${stat.count===1?'':'es'}</span><div>${stars}</div></div><button class="button button-secondary" data-apply-preset="${row.id}">Aplicar preset</button></article>`;
    }).join(''):'<div class="empty-state">Todavía no hay presets publicados. Puedes ser la primera persona en compartir uno.</div>';
    $$('[data-rate-preset]').forEach(button=>button.addEventListener('click',()=>ratePreset(button.dataset.ratePreset,Number(button.dataset.rating))));
    $$('[data-apply-preset]').forEach(button=>button.addEventListener('click',async()=>{
      const row=rows.find(item=>item.id===button.dataset.applyPreset);if(!row)return;const cfg=row.config||{};
      if(row.preset_type==='profile'){
        const allowed=['default_name_color','name_font_url','name_effect_url','profile_effect_url','profile_plate_url','profile_frame_url'];
        const patch=Object.fromEntries(allowed.filter(key=>Object.prototype.hasOwnProperty.call(cfg,key)).map(key=>[key,cfg[key]]));
        if(patch.name_font_url&&!safeHttpsUrl(patch.name_font_url))delete patch.name_font_url;
        for(const key of ['name_effect_url','profile_effect_url','profile_plate_url'])if(patch[key]&&!safeHttpsUrl(patch[key]))delete patch[key];
        const {error:saveError}=await client.from('profiles').update(patch).eq('id',currentUser.id);
        if(saveError)showError(saveError);else{Object.assign(profile,patch);renderIdentity();renderIdentityAssetLinks();toast('Preset de perfil aplicado.','success');}
      }else if(row.preset_type==='community'){
        if(!currentCommunity||currentCommunity.owner_id!==currentUser.id){toast('Selecciona un megagrupo del que seas propietario para aplicar este preset.','error');return;}
        const patch={};for(const key of ['icon_url','banner_url','background_url'])if(cfg[key]===null||safeHttpsUrl(cfg[key]))patch[key]=cfg[key]||null;
        if(/^#[0-9a-f]{6}$/i.test(cfg.name_color||''))patch.name_color=cfg.name_color;
        const {error:saveError}=await client.from('communities').update(patch).eq('id',currentCommunity.id).eq('owner_id',currentUser.id);
        if(saveError)showError(saveError);else{currentCommunity={...currentCommunity,...patch};applyCommunityAppearance(currentCommunity);toast('Preset de megagrupo aplicado.','success');}
      }else{
        const patch={};if(/^#[0-9a-f]{6}$/i.test(cfg.accent||''))patch.accent=cfg.accent;if(['compact','comfortable','spacious'].includes(cfg.density))patch.density=cfg.density;if(cfg.background===null||safeHttpsUrl(cfg.background))patch.background=cfg.background||'';
        const settings={...(profile.settings||{}),...patch};const {error:saveError}=await client.from('profiles').update({settings}).eq('id',currentUser.id);
        if(saveError)showError(saveError);else{profile.settings=settings;renderIdentity();fillSettingsForm();toast('Preset de cliente aplicado.','success');}
      }
    }));
  }
  async function ratePreset(presetId,rating){
    if(!Number.isInteger(rating)||rating<1||rating>5)return;
    const {data:target,error:readError}=await client.from('presets').select('owner_id,is_public').eq('id',presetId).maybeSingle();
    if(readError||!target){showError(readError||new Error('El preset ya no existe.'));return;}
    if(!target.is_public||target.owner_id===currentUser.id){toast('No puedes valorar este preset.','error');return;}
    const review=await ask('Valorar preset','Puedes añadir una opinión breve (opcional).','Opinión','');
    if(review===null)return;
    const {error}=await client.from('preset_reviews').upsert({preset_id:presetId,reviewer_id:currentUser.id,rating,review:review.slice(0,500),updated_at:new Date().toISOString()},{onConflict:'preset_id,reviewer_id'});
    if(error)showError(error,'No se pudo guardar la valoración. Ejecuta la migración v0.7.');else{toast('Valoración guardada.','success');loadPresets();}
  }
  $('#publish-preset').addEventListener('click',publishPreset);
  async function publishPreset(){
    const typeRaw=await ask('Tipo de preset','Escribe cliente, perfil o megagrupo. Para megagrupo debes ser su propietario.','Tipo','cliente','cliente');if(!typeRaw)return;
    const presetType=/^perfil$/i.test(typeRaw)?'profile':/^megagrupo|comunidad$/i.test(typeRaw)?'community':/^cliente$/i.test(typeRaw)?'client':'';
    if(!presetType){toast('Tipo no válido. Escribe cliente, perfil o megagrupo.','error');return;}
    if(presetType==='community'&&(!currentCommunity||currentCommunity.owner_id!==currentUser.id)){toast('Selecciona primero un megagrupo del que seas propietario.','error');return;}
    const name=await ask('Publicar preset','No se compartirán datos privados.','Nombre','Mi preset');if(!name||name.length<2||name.length>60)return;
    const description=await ask('Descripción','Explica brevemente qué incluye.','Descripción','Un estilo Nexus personalizado.');
    const config=presetType==='profile'
      ?{default_name_color:profile.default_name_color||'#a99bff',name_font_url:safeHttpsUrl(profile.name_font_url)||null,name_effect_url:safeHttpsUrl(profile.name_effect_url)||null,profile_effect_url:safeHttpsUrl(profile.profile_effect_url)||null,profile_plate_url:safeHttpsUrl(profile.profile_plate_url)||null,profile_frame_url:safeHttpsUrl(profile.profile_frame_url)||null}
      :presetType==='community'
        ?{icon_url:safeHttpsUrl(currentCommunity.icon_url)||null,banner_url:safeHttpsUrl(currentCommunity.banner_url)||null,background_url:safeHttpsUrl(currentCommunity.background_url)||null,name_color:currentCommunity.name_color||'#a99bff'}
        :{accent:profile.settings?.accent||'#8d7cff',density:profile.settings?.density||'comfortable',background:safeHttpsUrl(profile.settings?.background)||''};
    const {error}=await client.from('presets').insert({owner_id:currentUser.id,name,description:description||'',preset_type:presetType,config,is_public:true});
    if(error)showError(error);else{toast('Preset publicado en Workshop.','success');loadPresets();}
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
  document.addEventListener('visibilitychange', () => {
    if(document.hidden||!currentUser||!currentContext)return;
    const key=messageContextKey();
    if(messageCache.has(key))syncMessageDelta({...currentContext},{render:true});
    else loadMessages();
  });

  // Replace the initial data loader after all module functions are defined.
  const originalLoadInitialData = loadInitialData;
  loadInitialData = async function() {
    await originalLoadInitialData();
    await loadInitialDataSafe();
  };

  // Helpful inline formatting shortcuts.
  $('#message-template').setAttribute('aria-hidden','true');
})();
