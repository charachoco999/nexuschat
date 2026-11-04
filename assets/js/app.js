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
  let customizationGuideReturnView = 'chats';
  let markdownGuideReturnView = 'chats';
  let forwardingMessage = null;
  let activeFeedbackType = 'suggestion';
  let pendingAttachments = [];
  let messageImageObserver = null;
  let messageImageObserverRoot = null;
  let activeSystemPopupQueue = [];
  let systemPopupShowing = false;
  let stickerWorkshopRows = [];
  let activeCommunityProfile = null;
  let activeProfileMode = 'main';
  let communityProfileWidgets = [];
  let pendingForwardMessage = null;
  let platformFeedbackFilter = 'open';
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
  let currentCommunity = null;
  let currentCommunityChannels = [];
  let friendsCache = [];
  let isAdmin = false;
  let communityRoles = [];
  let communityMembers = [];
  let communityMemberRoles = [];
  let communityPermissions = {manage_roles:false,manage_badges:false,manage_messages:false,manage_channels:false,post_announcements:false};
  const messageIdentityCache = new Map();
  const globalBadgeCache = new Map();
  let activeAltProfile = null;
  let messageNotificationChannel = null;
  let notificationAudioContext = null;
  let notificationItems = [];
  const notificationSeenIds = new Set();
  const mentionCandidateCache = new Map();
  const customEmojiCache = new Map();
  const customReactionCache = new Map();
  let assetPickerMode = 'composer';
  let reactionTargetMessageId = null;
  let customEmojiCacheKey = '';
  let assetPickerType = 'sticker';
  let assetPickerRows = [];
  let assetPickerRowsType = '';
  let voiceSession = null;
  let serviceWorkerRegistration = null;
  let pushEnabledLocal = false;
  let globalPresenceChannel = null;
  const onlineUserIds = new Set();
  const onlineDeviceTypes = new Map();
  const unreadCounts = new Map();
  let contextPresenceMembers = [];
  const STANDARD_EMOJIS = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🫣", "🤭", "🫢", "🫡", "🤫", "🫠", "🤥", "😶", "😐", "😑", "😬", "🫨", "🫥", "😮", "😯", "😲", "🥱", "😴", "🤤", "😪", "😵", "😵‍💫", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "💀", "☠️", "👻", "👽", "👾", "🤖", "💩", "🙈", "🙉", "🙊", "🐵", "🐒", "🦍", "🦧", "🐶", "🐕", "🦮", "🐕‍🦺", "🐩", "🐺", "🦊", "🦝", "🐱", "🐈", "🐈‍⬛", "🦁", "🐯", "🐅", "🐆", "🐴", "🫎", "🫏", "🐎", "🦄", "🦓", "🦌", "🦬", "🐮", "🐂", "🐃", "🐄", "🐷", "🐖", "🐗", "🐽", "🐏", "🐑", "🐐", "🐪", "🐫", "🦙", "🦒", "🐘", "🦣", "🦏", "🦛", "🐭", "🐁", "🐀", "🐹", "🐰", "🐇", "🐿️", "🦫", "🦔", "🦇", "🐻", "🐻‍❄️", "🐨", "🐼", "🦥", "🦦", "🦨", "🦘", "🦡", "🐾", "🦃", "🐔", "🐓", "🐣", "🐤", "🐥", "🐦", "🐧", "🕊️", "🦅", "🦆", "🦢", "🦉", "🦤", "🪶", "🦩", "🦚", "🦜", "🪽", "🐸", "🐊", "🐢", "🦎", "🐍", "🐲", "🐉", "🦕", "🦖", "🐳", "🐋", "🐬", "🦭", "🐟", "🐠", "🐡", "🦈", "🐙", "🐚", "🪸", "🪼", "🦀", "🦞", "🦐", "🦑", "🦪", "🐌", "🦋", "🐛", "🐜", "🐝", "🪲", "🐞", "🦗", "🪳", "🕷️", "🕸️", "🦂", "🦟", "🪰", "🪱", "🦠", "💐", "🌸", "💮", "🪷", "🏵️", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🪻", "🌱", "🪴", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🪹", "🪺", "🍄", "🪨", "🌰", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶️", "🫑", "🥒", "🥬", "🥦", "🧄", "🧅", "🥜", "🫘", "🍞", "🥐", "🥖", "🫓", "🥨", "🥯", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆", "🍳", "🥘", "🍲", "🫕", "🥣", "🥗", "🍿", "🧈", "🧂", "🥫", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🥮", "🍡", "🥟", "🥠", "🥡", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯", "🍼", "🥛", "☕", "🫖", "🍵", "🍶", "🍾", "🥤", "🧋", "🧃", "🧉", "🧊", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🍴", "🥄", "🔪", "🫙", "🏺", "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🏋️", "🤼", "🤸", "⛹️", "🤺", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🎗️", "🎫", "🎟️", "🎪", "🤹", "🎭", "🩰", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻", "🪈", "🎲", "♟️", "🎯", "🎳", "🎮", "🕹️", "🧩", "🧸", "🪅", "🪩", "🪆", "🖼️", "🎰", "🧮", "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🛵", "🏍️", "🚲", "🛴", "🛺", "🚨", "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "✈️", "🛫", "🛬", "🛩️", "💺", "🚁", "🚀", "🛸", "🚢", "⛵", "🚤", "🛥️", "🛳️", "⛴️", "⚓", "🛟", "⛽", "🚧", "🚦", "🚥", "🗺️", "🗿", "🗽", "🗼", "🏰", "🏯", "🏟️", "🎡", "🎢", "🎠", "⛲", "⛱️", "🏖️", "🏝️", "🏜️", "🌋", "⛰️", "🏔️", "🗻", "🏕️", "⛺", "🛖", "🏠", "🏡", "🏘️", "🏚️", "🏗️", "🏭", "🏢", "🏬", "🏣", "🏤", "🏥", "🏦", "🏨", "🏪", "🏫", "🏩", "💒", "🏛️", "⛪", "🕌", "🛕", "🕍", "⛩️", "🕋", "🌅", "🌄", "🌠", "🎇", "🎆", "🌇", "🌆", "🏙️", "🌃", "🌌", "🌉", "🌁", "🌈", "🌂", "☂️", "☔", "⛅", "☀️", "🌤️", "🌥️", "🌦️", "🌧️", "⛈️", "🌩️", "🌨️", "❄️", "☃️", "⛄", "🌬️", "💨", "🌪️", "🌫️", "🌊", "💧", "💦", "☁️", "🔥", "🌟", "⭐", "✨", "⚡", "☄️", "💥", "🌀", "💤", "💢", "💬", "🗯️", "💭", "🕳️", "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "🫷", "🫸", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄", "🫦", "💋", "🩸", "🩹", "🩺", "🩻", "🧬", "🌡️", "🎈", "🎀", "💎", "💍", "🧿", "🪬", "🔮", "🪄", "🎁", "🎉", "🎊", "🧨", "💫", "💯", "💡", "💻", "📱", "🖥️", "⌨️", "🖱️", "🖨️", "💾", "💿", "📀", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "🔋", "🪫", "🔌", "🔦", "🕯️", "🪔", "🧯", "🛢️", "💸", "💵", "💴", "💶", "💷", "🪙", "💰", "💳", "🧾", "💹", "📈", "📉", "📊", "🧳", "🌍", "🌎", "🌏", "🌐", "🧭", "🏳️", "🏴", "🏁", "🚩", "🎌", "🏳️‍🌈", "🏳️‍⚧️", "🇪🇸", "🇬🇧", "🇫🇷", "🇩🇪", "🇮🇹", "🇯🇵", "🇺🇸", "🇨🇦", "🇧🇷", "🇲🇽", "🇦🇷", "🇨🇳", "🇰🇷", "🇮🇳", "🇦🇺", "🇳🇿", "🇺🇦", "🇵🇹", "🇳🇱", "🇸🇪", "🇳🇴", "🇫🇮", "🇵🇱", "🇹🇷", "🇬🇷", "🇮🇪", "🇨🇭", "🇧🇪", "🇦🇹", "🇨🇿", "🇩🇰", "🇮🇸", "❤️", "🩷", "🧡", "💛", "💚", "💙", "🩵", "💜", "🤎", "🖤", "🩶", "🤍", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️", "🪯", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "🆔", "⚛️", "🉑", "☢️", "☣️", "📴", "📳", "🈶", "🈚", "🈸", "🈺", "🈷️", "✴️", "🆚", "🉐", "㊙️", "㊗️", "🈴", "🈵", "🈹", "🈲", "🅰️", "🅱️", "🆎", "🅾️", "🆑", "🅿️", "🆘", "🆗", "🆙", "🆒", "🆕", "🆓", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜", "◼️", "◻️", "▪️", "▫️", "🔶", "🔷", "🔸", "🔹", "🔺", "🔻", "💠", "🔘", "🔳", "🔲", "🏧", "🚮", "🚰", "♿", "🚹", "🚺", "🚻", "🚼", "🚾", "🛂", "🛃", "🛄", "🛅", "🚸", "⛔", "🚫", "🚳", "🚭", "🚯", "🚱", "🚷", "📵", "🔞", "⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️", "↕️", "↔️", "🔃", "🔄", "🔙", "🔚", "🔛", "🔜", "🔝", "⚠️", "🔰", "⭕", "✅", "☑️", "✔️", "❌", "❎", "➕", "➖", "➗", "✖️", "♾️", "‼️", "⁉️", "❓", "❔", "❕", "❗", "〰️", "💱", "💲", "⚕️", "♻️", "⚜️", "🔱", "📛", "➰", "➿", "✳️", "❇️", "©️", "®️", "™️", "🔠", "🔡", "🔢", "🔣", "🔤", "🆖", "🔟", "#️⃣", "*️⃣", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "⏏️", "⏩", "⏪", "⏫", "⏬", "⏭️", "⏮️", "⏯️", "⏸️", "⏹️", "⏺️", "🎦", "🔅", "🔆", "📶", "🛜"];
  const STANDARD_EMOJI_ALIASES = Object.freeze({
    grinning:'😀',smile:'😄',smiley:'😃',grin:'😁',joy:'😂',rofl:'🤣',sweat_smile:'😅',wink:'😉',blush:'😊',innocent:'😇',slight_smile:'🙂',upside_down:'🙃',heart_eyes:'😍',kissing_heart:'😘',thinking:'🤔',thinking_face:'🤔',neutral_face:'😐',expressionless:'😑',grimacing:'😬',rolling_eyes:'🙄',relieved:'😌',sunglasses:'😎',star_struck:'🤩',partying_face:'🥳',smirk:'😏',unamused:'😒',disappointed:'😞',worried:'😟',pleading:'🥺',cry:'😢',sob:'😭',angry:'😠',rage:'😡',cursing:'🤬',mind_blown:'🤯',flushed:'😳',scream:'😱',fearful:'😨',thinking_cloud:'💭',sleeping:'😴',mask:'😷',sick:'🤒',poop:'💩',skull:'💀',ghost:'👻',alien:'👽',robot:'🤖',cat:'🐱',dog:'🐶',fox:'🦊',unicorn:'🦄',bee:'🐝',butterfly:'🦋',frog:'🐸',turtle:'🐢',whale:'🐳',dolphin:'🐬',octopus:'🐙',rose:'🌹',sunflower:'🌻',clover:'🍀',mushroom:'🍄',apple:'🍎',avocado:'🥑',banana:'🍌',pizza:'🍕',hamburger:'🍔',fries:'🍟',taco:'🌮',sushi:'🍣',cake:'🎂',cookie:'🍪',coffee:'☕',tea:'🍵',beer:'🍺',soccer:'⚽',basketball:'🏀',football:'🏈',tennis:'🎾',trophy:'🏆',medal:'🏅',video_game:'🎮',music:'🎵',guitar:'🎸',car:'🚗',taxi:'🚕',bus:'🚌',train:'🚆',airplane:'✈️',rocket:'🚀',ship:'🚢',house:'🏠',earth_americas:'🌎',earth_africa:'🌍',moon:'🌙',sunny:'☀️',cloud:'☁️',rain:'🌧️',snowflake:'❄️',rainbow:'🌈',fire:'🔥',star:'⭐',sparkles:'✨',zap:'⚡',wave:'👋',raised_hand:'✋',ok_hand:'👌',victory:'✌️',love_you:'🤟',point_up:'☝️',point_right:'👉',thumbsup:'👍',thumbs_up:'👍','+1':'👍',thumbsdown:'👎',thumbs_down:'👎','-1':'👎',fist:'✊',clap:'👏',raised_hands:'🙌',pray:'🙏',handshake:'🤝',muscle:'💪',eyes:'👀',brain:'🧠',heart:'❤️',red_heart:'❤️',orange_heart:'🧡',yellow_heart:'💛',green_heart:'💚',blue_heart:'💙',purple_heart:'💜',black_heart:'🖤',broken_heart:'💔',two_hearts:'💕',gift_heart:'💝',check:'✅',white_check_mark:'✅',heavy_check_mark:'✔️',x:'❌',cross_mark:'❌',warning:'⚠️',question:'❓',grey_question:'❔',exclamation:'❗',100:'💯',fireworks:'🎆',tada:'🎉',confetti_ball:'🎊',balloon:'🎈',crown:'👑',gem:'💎',bulb:'💡',computer:'💻',phone:'📱',camera:'📷',moneybag:'💰',chart_up:'📈',recycle:'♻️',infinity:'♾️',gato:'🐱',perro:'🐶',zorro:'🦊',sonrisa:'😄',feliz:'😊',risa:'😂',carcajada:'🤣',guino:'😉',pensando:'🤔',llorar:'😭',triste:'😢',enfadado:'😠',enojado:'😡',sorprendido:'😮',fiesta:'🥳',corazon:'❤️',corazones:'💕',pulgar_arriba:'👍',pulgar_abajo:'👎',aplaudir:'👏',fuego:'🔥',estrella:'⭐',brillo:'✨',cohete:'🚀',cafe:'☕',pizza:'🍕',musica:'🎵',ojo:'👀',ojos:'👀',gracias:'🙏',ok:'👌',si:'✅',no:'❌'
  });
  const STANDARD_EMOJI_BY_ALIAS = new Map(Object.entries(STANDARD_EMOJI_ALIASES));
  const STANDARD_EMOJI_ALIASES_BY_CHARACTER = new Map();
  for(const [name,emoji] of Object.entries(STANDARD_EMOJI_ALIASES)){
    if(!STANDARD_EMOJI_ALIASES_BY_CHARACTER.has(emoji))STANDARD_EMOJI_ALIASES_BY_CHARACTER.set(emoji,[]);
    STANDARD_EMOJI_ALIASES_BY_CHARACTER.get(emoji).push(name);
  }
  const DEFAULT_MESSAGE_PAGE_SIZE = 50;
  const messagePageSize = () => Math.max(25, Math.min(100, Number(profile?.settings?.messagePageSize) || DEFAULT_MESSAGE_PAGE_SIZE));
  let audioRecorder = null;
  let audioRecordStream = null;
  let audioRecordChunks = [];
  let audioRecordContext = null;
  let audioRecordAudioContext = null;
  let audioRecordSource = null;
  let audioRecordProcessor = null;
  let audioRecordSilentGain = null;
  let audioRecordSampleCount = 0;
  let audioRecordAltProfile = null;
  let audioRecordReply = null;
  let audioRecordPostAnnouncementsAllowed = false;
  let customNotificationAudio = null;
  let customNotificationAudioLoaded = false;
  let platformAdmin = false;
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
      const friendly = 'El servicio de correo de esta instalación ha alcanzado su límite temporal de verificación. No es un problema de tu contraseña. El administrador debe revisar la configuración SMTP.';
      $('#auth-note').textContent = friendly;
      toast('Se ha alcanzado el límite de correos de registro. El administrador debe configurar SMTP.', 'error');
      return;
    }
    if (normalized.includes('email address not authorized') || normalized.includes('email_address_not_authorized')) {
      const friendly = 'El correo no está autorizado por el servicio de prueba. El administrador debe configurar un proveedor SMTP para permitir registros públicos.';
      $('#auth-note').textContent = friendly;
      toast(friendly, 'error');
      return;
    }
    toast(error?.message || fallback, 'error');
  };
  const requireClient = () => {
    if (!client) {
      toast('Falta configurar la conexión del servidor en esta instalación de Nexus.', 'error');
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
        toast('Cuenta creada. Revisa tu correo si el servicio solicita confirmación.', 'success');
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
    ? 'Tus conversaciones y ajustes se sincronizan de forma segura.'
    : 'Nexus necesita una conexión configurada para activar cuentas y conversaciones.';

  async function startApp(user) {
    currentUser = user;
    showNexusLoading(true);
    showApp();
    applyClientPreferences();
    try {
      const {data, error} = await client.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      profile = data;
      await loadSystemInboxMessages();
      // Store a privacy-conscious last-seen timestamp for platform moderation/search.
      // This is updated at sign-in and when the tab returns to the foreground.
      client.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',user.id).then(({error:lastSeenError})=>{if(lastSeenError)console.debug('No se pudo actualizar la última actividad:',lastSeenError.message);});
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
      showNexusLoading(false);
      loadMyBadgeRequests();
      loadMyReputationStats();
    } catch (error) {
      showNexusLoading(false);
      showError(error, 'No se pudo cargar el perfil. Comprueba la conexión y que la base de datos esté actualizada.');
    }
  }

  async function signOut() {
    if(audioRecorder&&audioRecorder.state==='recording')audioRecorder.stop();
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
    if(view==='admin'&&!platformAdmin){toast('Este panel está reservado a administradores de plataforma.','error');return;}
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
      'sticker-workshop':['Sticker Workshop','Stickers publicados por la comunidad.','▧'],
      'markdown-guide':['Guía de Markdown','Sintaxis, ejemplos y buenas prácticas.','ⓜ'],
      admin:['Panel de administración','Herramientas del equipo de Nexus.','✦'],
      profile:['Tu perfil','Tu identidad en Nexus.','●'],
      settings:['Configuración','Preferencias y administración.','⚙'],
      'customization-guide':['Guía de personalización','Aprende a ajustar Nexus paso a paso.','ⓘ'],
      community:[currentCommunity?.name || 'Megagrupo','Canales y comunidad.','▦']
    };
    const [title, subtitle, icon] = labels[view] || labels.chats;
    $('#context-title').textContent = title;
    $('#context-subtitle').textContent = subtitle;
    $('#context-icon').textContent = icon;
    $('#sidebar-community').classList.toggle('hidden', !currentCommunity || !['community','chats'].includes(view));
    if (view === 'profile') { fillProfileForm(); switchProfileMode('main'); renderProfileWidgets(); fillCommunityNickname(); loadCommunityProfileEditor(); renderIdentityAssetLinks(); loadAltProfiles(); $('#profile-plate-opacity').value=String(profilePlateOpacity(profile?.settings)); $('#profile-plate-opacity-value').textContent=`${Math.round(profilePlateOpacity(profile?.settings)*100)}%`; }
    if (view === 'settings') fillSettingsForm();
    if (view === 'admin' && platformAdmin) { loadPlatformAdminUsers(); loadPlatformFeedback(); loadPlatformBadges(); }
    if (view === 'sticker-workshop') loadStickerWorkshopPage();
  }
  $$('[data-view]').forEach(node => node.addEventListener('click', () => switchView(node.dataset.view)));
  function returnToPersonalInbox(){if(currentContext?.type==='channel'){if(voiceSession)leaveVoiceRoom({refresh:false});resetConversationPanel();}$('#app-screen').classList.remove('community-focus');}
  $$('.rail-logo, #sidebar-personal [data-view="chats"]').forEach(node=>node.addEventListener('click',returnToPersonalInbox));
  $('#rail-profile').addEventListener('click', () => switchView('profile'));
  $('#open-profile').addEventListener('click', () => switchView('profile'));
  $('#top-profile').addEventListener('click', () => switchView('profile'));
  $('#open-settings').addEventListener('click', () => switchView('settings'));
  function openCustomizationGuide() {
    customizationGuideReturnView = currentView === 'customization-guide' ? 'chats' : currentView;
    switchView('customization-guide');
  }
  function returnFromCustomizationGuide() {
    const target = customizationGuideReturnView && customizationGuideReturnView !== 'customization-guide'
      ? customizationGuideReturnView
      : 'chats';
    switchView(target);
  }
  $('#open-customization-guide')?.addEventListener('click', openCustomizationGuide);
  $('#open-customization-guide-settings')?.addEventListener('click', openCustomizationGuide);
  $('#guide-return-to-nexus')?.addEventListener('click', returnFromCustomizationGuide);
  $('#guide-footer-return')?.addEventListener('click', returnFromCustomizationGuide);
  $('#guide-open-settings')?.addEventListener('click', () => switchView('settings'));
  $('#guide-footer-settings')?.addEventListener('click', () => switchView('settings'));
  $$('.guide-open-settings').forEach(button => button.addEventListener('click', () => switchView('settings')));
  $('#guide-open-profile')?.addEventListener('click', () => switchView('profile'));
  $('#guide-open-community')?.addEventListener('click', () => {
    if (!currentCommunity) { toast('Primero selecciona un megagrupo.','error'); return; }
    switchView('community');
    $('#community-settings')?.click();
  });
  $('#guide-open-markdown')?.addEventListener('click', openMarkdownGuidePage);
  $('#markdown-guide-return')?.addEventListener('click', returnFromMarkdownGuide);
  $('#logout-button').addEventListener('click', signOut);
  $('#global-search').addEventListener('click', () => addFriendFlow());
  $('#mobile-menu-toggle')?.addEventListener('click',()=>{const app=$('#app-screen');app.classList.toggle('mobile-menu-open');$('#mobile-menu-scrim')?.classList.toggle('hidden',!app.classList.contains('mobile-menu-open'));});
  $('#mobile-menu-scrim')?.addEventListener('click',()=>{$('#app-screen').classList.remove('mobile-menu-open');$('#mobile-menu-scrim').classList.add('hidden');});
  $('#voice-session-dock-mute')?.addEventListener('click',toggleVoiceMute);
  $('#voice-session-dock-leave')?.addEventListener('click',()=>leaveVoiceRoom());
  $('#voice-session-dock-share')?.addEventListener('click',toggleVoiceScreenShare);
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
    applyClientTheme(profile?.settings||{});
    document.body.style.backgroundImage = /^https:\/\//i.test(profile?.settings?.background || '') ? `url('${profile.settings.background}')` : '';
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
  function getDeviceType(){
    const ua=navigator.userAgent||'';
    return /Android|iPhone|iPad|iPod|Mobile|IEMobile/i.test(ua)?'mobile':'desktop';
  }
  function syncGlobalPresence() {
    onlineUserIds.clear();
    onlineDeviceTypes.clear();
    const state=globalPresenceChannel?.presenceState?.()||{};
    for(const [key,metas] of Object.entries(state)){
      const meta=metas?.[0]||{};
      const userId=meta.user_id||key;
      if(userId){onlineUserIds.add(userId);onlineDeviceTypes.set(userId,meta.device_type==='mobile'?'mobile':'desktop');}
    }
    refreshFriendPresenceIndicators();
    if(conversations.length)renderConversationList();
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
            await globalPresenceChannel.track({user_id:currentUser.id,username:profile?.username||'usuario',nickname:profile?.nickname||profile?.username||'Usuario',status_text:String(profile?.settings?.customStatus||'').slice(0,60),profile_frame_url:safeHttpsUrl(profile?.profile_frame_url),profile_plate_url:safeHttpsUrl(profile?.profile_plate_url),profile_plate_opacity:profilePlateOpacity(profile?.settings),device_type:getDeviceType(),hidden_global_badge_ids:Array.isArray(profile?.settings?.hiddenGlobalBadgeIds)?profile.settings.hiddenGlobalBadgeIds:[],joined_at:new Date().toISOString()});
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

  function openLocalSettingsDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open('nexus-local-settings',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('assets'))request.result.createObjectStore('assets');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function saveLocalNotificationSound(file){if(!file)return;if(file.size>1024*1024){toast('El sonido personalizado debe pesar menos de 1 MB.','error');return;}if(!file.type.startsWith('audio/')){toast('Selecciona un archivo de audio.','error');return;}const db=await openLocalSettingsDb();await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(file,'notification-sound');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();customNotificationAudio=file;customNotificationAudioLoaded=true;$('#notify-audio-status').textContent=`Sonido personalizado: ${file.name}`;}
  async function loadLocalNotificationSound(){if(customNotificationAudioLoaded)return customNotificationAudio;try{const db=await openLocalSettingsDb();const value=await new Promise((resolve,reject)=>{const req=db.transaction('assets','readonly').objectStore('assets').get('notification-sound');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});db.close();customNotificationAudio=value;customNotificationAudioLoaded=true;return value;}catch{return null;}}
  async function clearLocalNotificationSound(){try{const db=await openLocalSettingsDb();await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').delete('notification-sound');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();customNotificationAudio=null;customNotificationAudioLoaded=true;$('#notify-audio-status').textContent='Se utiliza el sonido predeterminado.';}catch(error){showError(error);}}
  $('#setting-notify-audio-file')?.addEventListener('change',async event=>{try{await saveLocalNotificationSound(event.target.files?.[0]);}catch(error){showError(error,'No se pudo guardar el sonido local.');}finally{event.target.value='';}});
  $('#clear-notify-audio')?.addEventListener('click',clearLocalNotificationSound);
  async function playNotificationSound() {
    if (profile?.settings?.notifySound === false) return;
    const custom=await loadLocalNotificationSound();
    if(custom){const url=URL.createObjectURL(custom);const audio=new Audio(url);audio.volume=.75;audio.addEventListener('ended',()=>URL.revokeObjectURL(url),{once:true});audio.play().catch(()=>URL.revokeObjectURL(url));return;}
    if (!notificationAudioContext || notificationAudioContext.state !== 'running') return;
    const ctx = notificationAudioContext;const now = ctx.currentTime;
    [660,880].forEach((frequency,index)=>{const oscillator=ctx.createOscillator();const gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,now+index*.095);gain.gain.setValueAtTime(.0001,now+index*.095);gain.gain.exponentialRampToValueAtTime(.045,now+index*.095+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+index*.095+.12);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(now+index*.095);oscillator.stop(now+index*.095+.13);});
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
    const pushButton=$('#enable-push-notifications');if(pushButton){pushButton.textContent=pushEnabledLocal?'Desactivar avisos push':'Activar avisos con Nexus cerrado';pushButton.disabled=!cfg.VAPID_PUBLIC_KEY;pushButton.title=cfg.VAPID_PUBLIC_KEY?'':'Las notificaciones con Nexus cerrado requieren configuración adicional del servidor.';}
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
    const prefs=profile?.settings||{};
    const override=prefs.notificationOverrides?.[`${message.channel_id?'channel':'conversation'}:${message.channel_id||message.conversation_id}`];
    if(override==='mute'||(override==='mentions'&&!mention))return;
    if(override!=='all'&&override!=='mentions'){
      if(source.kind==='channel'&&(prefs.notifyCommunity===false||(prefs.communityMentionsOnly&&!mention)))return;
      if(source.kind==='conversation'&&source.subtitle==='Mensaje directo'&&prefs.notifyDirect===false)return;
      if(source.kind==='conversation'&&source.subtitle==='Chat grupal'&&prefs.notifyGroup===false)return;
    }
    const sameContext=currentContext && ((message.conversation_id && currentContext.type==='conversation' && currentContext.id===message.conversation_id) || (message.channel_id && currentContext.type==='channel' && currentContext.id===message.channel_id));
    const visible=document.visibilityState==='visible';
    const showWhileOpen=profile?.settings?.notifyWhileOpen !== false;
    if (sameContext && visible && !showWhileOpen && !mention) return;
    const preview=String(message.body || message.attachment?.name || 'Ha enviado un archivo').replace(/\s+/g,' ').slice(0,120);
    const item={...source,body:preview,mention,time:dateLabel(message.created_at),createdAt:message.created_at};
    notificationItems.unshift(item); notificationItems=notificationItems.slice(0,50);
    playNotificationSound().catch(error=>console.debug('No se pudo reproducir el sonido de notificación:',error));
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
    pushEnabledLocal=active;button.textContent=active?'Desactivar avisos push':'Activar avisos con Nexus cerrado';button.disabled=!cfg.VAPID_PUBLIC_KEY;button.title=cfg.VAPID_PUBLIC_KEY?'':'Las notificaciones con Nexus cerrado requieren configuración adicional del servidor.';
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
    const globalBadgesByUser=await fetchGlobalBadgesByUser(otherIds);
    conversations = (rows || []).map(row => {
      const members = (participants || []).filter(member => member.conversation_id === row.id);
      const other = members.find(member => member.user_id !== currentUser.id);
      const otherProfile = other ? otherProfiles[other.user_id] : null;
      const mine = members.find(member => member.user_id === currentUser.id);
      const title = mine?.personal_name || row.title || (row.kind === 'direct' ? (otherProfile?.nickname || otherProfile?.username || 'Mensaje directo') : 'Grupo sin nombre');
      const avatar = row.icon_url || (row.kind === 'direct' ? otherProfile?.avatar_url : null);
      return {...row, displayTitle:title, displayAvatar:avatar, directUserId:row.kind==='direct'?other?.user_id:null, displayFrame:row.kind==='direct'?otherProfile?.profile_frame_url:null, displayPlate:row.kind==='direct'?otherProfile?.profile_plate_url:null,displayPlateOpacity:profilePlateOpacity(otherProfile?.settings),displayGlobalBadges:row.kind==='direct'?(globalBadgesByUser.get(other?.user_id)||[]):[],displayHiddenGlobalBadgeIds:row.kind==='direct'?(otherProfile?.settings?.hiddenGlobalBadgeIds||[]):[], hidden_at:mine?.hidden_at || null};
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
          <span class="conversation-copy"><strong>${escapeHtml(row.displayTitle)}</strong>${row.displayGlobalBadges?.length?`<span class="conversation-global-badges">${row.displayGlobalBadges.filter(badge=>!row.displayHiddenGlobalBadgeIds.includes(badge.id)).map(badge=>/^https:\/\//i.test(badge.icon_url||'')?`<img src="${escapeHtml(badge.icon_url)}" alt="${escapeHtml(badge.name)}" title="${escapeHtml(badge.name)}" loading="lazy">`:`<span title="${escapeHtml(badge.name)}">${escapeHtml(badge.icon_url||'★')}</span>`).join('')}</span>`:''}<small>${row.kind === 'direct' ? 'Mensaje directo' : 'Grupo'}${row.hidden_at ? ' · Archivada' : ''}</small></span>${(unreadCounts.get(`conversation:${row.id}`)||0)>0?`<span class="unread-badge">${(unreadCounts.get(`conversation:${row.id}`)||0)>99?'99+':unreadCounts.get(`conversation:${row.id}`)}</span>`:''}${row.kind==='direct'?`${onlineUserIds.has(row.directUserId)?`<span class="conversation-device-icon" title="Conectado desde ${onlineDeviceTypes.get(row.directUserId)==='mobile'?'móvil':'ordenador'}">${onlineDeviceTypes.get(row.directUserId)==='mobile'?'▣':'▭'}</span>`:''}<span class="conversation-presence-dot" aria-label="Desconectado" title="Desconectado"></span>`:''}
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
    if(messageImageObserver){messageImageObserver.disconnect();messageImageObserver=null;messageImageObserverRoot=null;}
    const panel = $('#conversation-panel');
    const c = currentContext;
    panel.classList.toggle('community-chat-active',Boolean(c?.type==='channel'&&currentCommunity));
    const isCommunityChannel = c.type === 'channel';
    const mediaOnly = isCommunityChannel && c.channelType === 'media';
    const announcementLocked = isCommunityChannel && c.channelType === 'announcements' && !currentChannelPermission('post_announcements',communityPermissions.post_announcements);
    const voiceNotice = isCommunityChannel && c.channelType === 'voice';
    const channelSendDenied=isCommunityChannel&&!currentChannelPermission('send_messages',communityPermissions.send_messages);
    const readOnly = announcementLocked || channelSendDenied || voiceNotice;
    const channelLabel = isCommunityChannel ? ` · ${escapeHtml(c.channelType === 'media' ? 'Solo multimedia' : c.channelType === 'announcements' ? 'Anuncios' : c.channelType === 'voice' ? 'Voz' : 'Texto')}` : '';
    const composerHint = mediaOnly
      ? 'Este canal solo admite archivos multimedia.'
      : announcementLocked
        ? 'Necesitas el permiso «Publicar anuncios» para escribir aquí.'
        : 'Enter para enviar · Shift + Enter para nueva línea · Markdown disponible';
    panel.innerHTML = `
      <div class="active-conversation">
        <div class="conversation-head"><button type="button" class="conversation-back" id="conversation-back" aria-label="Volver a conversaciones">‹</button>${avatarMarkup({avatar_url:c.icon,profile_frame_url:c.frame,nickname:c.title})}<div class="conversation-head-copy"><strong>${escapeHtml(c.title)}</strong><small>${escapeHtml(c.subtitle || '')}${channelLabel}${c.channelDescription ? ` · ${escapeHtml(c.channelDescription)}` : ''}</small><div class="context-presence-controls"><button type="button" id="context-online-trigger" class="online-members-trigger" aria-haspopup="dialog" aria-controls="online-members-dialog"><span class="online-members-dot"></span><span id="context-online-count">0 en línea</span></button><span class="context-presence-status" id="context-presence-status"></span></div></div><div class="conversation-tools"><button class="icon-button" id="conversation-notification-settings" title="Notificaciones de este espacio">♢</button><button class="icon-button" id="conversation-info" title="Información">ⓘ</button></div></div>
        <div id="important-announcements" class="important-announcements"></div>
        <div id="pinned-messages" class="pinned-messages hidden"></div>
        ${voiceNotice ? '<div class="voice-placeholder voice-room"><div class="voice-placeholder-orb">◖</div><strong>Canal de voz</strong><p>Conéctate para hablar con los miembros presentes. El audio se transmite directamente entre navegadores cuando la red lo permite.</p><div id="voice-status" class="voice-status">Desconectado</div><div id="voice-participants" class="voice-participants"><span class="tag">Aún no hay participantes conectados</span></div><div class="voice-room-actions"><button type="button" class="button button-primary" id="join-voice-room">Conectar micrófono</button><button type="button" class="button button-secondary" id="voice-mute" disabled>Silenciar</button><button type="button" class="button button-secondary" id="voice-screen-share" disabled>Compartir pantalla</button><button type="button" class="button button-secondary" id="leave-voice-room" disabled>Salir</button></div><div id="voice-audio-host" class="voice-audio-host"></div><small class="muted">La calidad de conexión depende de la red. Algunas redes necesitan un servidor TURN adicional.</small></div>' : `
        <div class="messages" id="messages-container" aria-busy="true"><button type="button" class="load-older-messages hidden" id="load-older-messages">Cargar mensajes anteriores</button><div class="message-loading" role="status" aria-label="Cargando mensajes"><div class="message-loading-heading"><span></span><span></span></div><div class="message-loading-line"></div><div class="message-loading-line short"></div><div class="message-loading-heading second"><span></span><span></span></div><div class="message-loading-line medium"></div><div class="message-loading-line short"></div></div></div>
        <div class="composer-wrap ${readOnly ? 'composer-readonly' : ''} ${mediaOnly ? 'composer-media-only' : ''}">
          <div id="reply-composer" class="reply-composer hidden"><div><small>Respondiendo a <strong id="reply-author"></strong></small><span id="reply-excerpt"></span></div><button type="button" id="cancel-reply" class="icon-button" aria-label="Cancelar respuesta">×</button></div>
          <div id="mention-suggestions" class="mention-suggestions hidden" role="listbox" aria-label="Menciones"></div>
          <div class="composer-tools"><button id="attach-file" ${(readOnly || (isCommunityChannel&&!currentChannelPermission('attach_files',communityPermissions.send_messages))) ? 'disabled' : ''}>＋ Archivo</button><button type="button" id="open-asset-picker" ${readOnly ? 'disabled' : ''}>Emojis / Stickers</button><button type="button" id="open-gif-search" ${readOnly ? 'disabled' : ''}>GIF</button><button type="button" id="record-audio" ${readOnly ? 'disabled' : ''}>◉ Audio</button><button type="button" id="composer-markdown-guide">Markdown</button>${mediaOnly ? '' : `<button id="create-poll" ${readOnly ? 'disabled' : ''}>▤ Encuesta</button><button id="insert-bold" ${readOnly ? 'disabled' : ''}><b>B</b></button><button id="insert-italic" ${readOnly ? 'disabled' : ''}><i>I</i></button><button id="insert-code" ${readOnly ? 'disabled' : ''}>&lt;/&gt;</button>`}<input id="chat-file" class="upload-input" type="file" multiple accept="image/*,video/*,.pdf,.txt,.zip,.zipx,.csv,.tsv,.xls,.xlsx,.ods"></div><div id="pending-attachments" class="pending-attachments hidden"></div><label class="setting-check attachment-spoiler-toggle"><input type="checkbox" id="attachment-spoiler"> Ocultar archivos adjuntos con spoiler</label>
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
        if (event.key === 'Escape') {hideMentionSuggestions();hideEmojiSuggestions();}
        if(event.key==='Enter'&&!event.shiftKey&&!$('#emoji-suggestions')?.classList.contains('hidden')){
          const first=$('#emoji-suggestions [data-emoji-option]');if(first){event.preventDefault();first.click();return;}
        }
        if (event.key === 'Enter' && !event.shiftKey && !$('#mention-suggestions')?.querySelector('[data-mention-option].active')) { event.preventDefault(); $('#message-form').requestSubmit(); }
      });
      $('#attach-file').addEventListener('click', () => $('#chat-file').click());
      $('#chat-file').addEventListener('change', uploadAttachment);
      $('#open-asset-picker')?.addEventListener('click', () => openAssetPicker('standard'));
      $('#open-gif-search')?.addEventListener('click', openGifSearch);
      $('#record-audio')?.addEventListener('click',toggleAudioRecording);
      $('#composer-markdown-guide')?.addEventListener('click',openMarkdownGuide);
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
      $('#voice-screen-share')?.addEventListener('click',toggleVoiceScreenShare);
      if (voiceSession?.channelId===c.id) renderVoiceParticipants();
    }
    $('#conversation-notification-settings')?.addEventListener('click',openContextNotificationSettings);
    $('#conversation-info').addEventListener('click', () => {
      if (isCommunityChannel && c.channelDescription) toast(c.channelDescription);
      else toast('La información de esta conversación se muestra aquí. Es posible que se añadan más opciones de información en el futuro.');
    });
  }

  function openMarkdownGuide(){const dialog=$('#markdown-guide-dialog');if(dialog&&!dialog.open)dialog.showModal();}
  function openMarkdownGuidePage(){
    markdownGuideReturnView=currentView==='markdown-guide'?'chats':currentView;
    const host=$('#markdown-guide-page-content');
    const source=$('#markdown-guide-dialog .markdown-guide-content');
    if (host && source) {
      const guideClone=source.cloneNode(true);
      guideClone.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
      host.replaceChildren(guideClone);
      const extra = document.createElement('section');
      extra.className = 'surface markdown-guide-deep-dive';
      extra.innerHTML = String.raw`<h2>Buenas prácticas y errores habituales</h2>
        <div class="markdown-guide-columns">
          <article><h3>Haz esto</h3><ul>
            <li>Comprueba que todos los enlaces usan HTTPS.</li>
            <li>Usa bloques cortos y anida atributos de forma clara.</li>
            <li>Comprueba la vista previa antes de enviar contenido complejo.</li>
            <li>Usa tablas simples y encabezados cortos.</li>
            <li>En InputSync utiliza claves únicas por control compartido y evita guardar información sensible.</li>
          </ul></article>
          <article><h3>Evita esto</h3><ul>
            <li>No pegues HTML con scripts ni intentes importar CSS externo.</li>
            <li>No anides bloques sin cerrar sus llaves.</li>
            <li>No uses botones para pedir contraseñas, datos privados o información sensible.</li>
            <li>No confíes en una cita APA generada sin verificar autor, fecha y fuente.</li>
            <li>No uses retrasos para simular avisos urgentes.</li>
          </ul></article>
        </div>
        <h3>Ejemplo completo</h3><pre><code>## Actualización

{color:#9b8cff:{size:22:Notas de versión}}

{src:web:Documentación oficial:https://example.com/docs}

{button:#6956d8:Leer documentación:https://example.com/docs}

||Contenido que debe revelarse al pulsar||</code></pre>
        <p class="muted small-muted">El contenido se sanea antes de mostrarse. Las funciones Beta pueden cambiar entre versiones de Nexus.</p>`;
      host.append(extra);
    }
    switchView('markdown-guide');
  }
  function returnFromMarkdownGuide(){switchView(markdownGuideReturnView&&markdownGuideReturnView!=='markdown-guide'?markdownGuideReturnView:'chats');}
  $('#open-markdown-guide')?.addEventListener('click',openMarkdownGuidePage);
  $('#composer-markdown-guide')?.addEventListener('click',openMarkdownGuide);
  $('#close-markdown-guide')?.addEventListener('click',()=>$('#markdown-guide-dialog')?.close());
  $('#markdown-guide-dialog')?.addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close();});
  function notificationContextKey(context=currentContext){return !context?'':`${context.type}:${context.id}`;}
  function openContextNotificationSettings(){
    if(!currentContext)return;const settings=profile?.settings||{};const key=notificationContextKey();
    $('#context-notification-name').textContent=`${currentContext.title} · ${currentContext.type==='channel'?'Megagrupo':'Conversación'}`;
    $('#context-notification-mode').value=settings.notificationOverrides?.[key]||'default';
    $('#context-notification-dialog').showModal();
  }
  $('#close-context-notifications')?.addEventListener('click',()=>$('#context-notification-dialog').close());
  $('#cancel-context-notifications')?.addEventListener('click',()=>$('#context-notification-dialog').close());
  $('#context-notification-form')?.addEventListener('submit',async event=>{
    event.preventDefault();if(!currentContext)return;const settings={...(profile?.settings||{})};const overrides={...(settings.notificationOverrides||{})};const key=notificationContextKey();const mode=$('#context-notification-mode').value;
    if(mode==='default')delete overrides[key];else overrides[key]=mode;settings.notificationOverrides=overrides;
    const {error}=await client.from('profiles').update({settings}).eq('id',currentUser.id);if(error){showError(error);return;}profile.settings=settings;$('#context-notification-dialog').close();toast('Preferencias de notificación guardadas.','success');
  });
  function resampleAudioToPcm16(input,sourceRate,targetRate=16000){
    const ratio=sourceRate/targetRate;const outputLength=Math.floor(input.length/ratio);const output=new Int16Array(outputLength);
    for(let i=0;i<outputLength;i++){
      const position=i*ratio;const left=Math.floor(position);const right=Math.min(left+1,input.length-1);const fraction=position-left;
      const sample=Math.max(-1,Math.min(1,input[left]*(1-fraction)+input[right]*fraction));
      output[i]=sample<0?Math.round(sample*0x8000):Math.round(sample*0x7fff);
    }
    return output;
  }
  function createPcmWavBlob(chunks,sampleCount,sampleRate=16000){
    const header=new ArrayBuffer(44);const view=new DataView(header);const write=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
    write(0,'RIFF');view.setUint32(4,36+sampleCount*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,sampleCount*2,true);
    return new Blob([header,...chunks],{type:'audio/wav'});
  }
  async function finishAudioRecording(){
    const recorder=audioRecorder;if(!recorder||recorder.state!=='recording')return;
    recorder.state='inactive';
    if(audioRecordProcessor)audioRecordProcessor.onaudioprocess=null;
    try{audioRecordSource?.disconnect();}catch{}try{audioRecordProcessor?.disconnect();}catch{}try{audioRecordSilentGain?.disconnect();}catch{}
    audioRecordStream?.getTracks().forEach(track=>track.stop());audioRecordStream=null;
    const audioContext=audioRecordAudioContext;audioRecordAudioContext=null;
    if(audioContext&&audioContext.state!=='closed'){try{await audioContext.close();}catch{}}
    const chunks=audioRecordChunks;const sampleCount=audioRecordSampleCount;
    const options={context:audioRecordContext,alt:audioRecordAltProfile,reply:audioRecordReply,postAnnouncementsAllowed:audioRecordPostAnnouncementsAllowed};
    audioRecorder=null;audioRecordChunks=[];audioRecordSampleCount=0;audioRecordContext=null;audioRecordSource=null;audioRecordProcessor=null;audioRecordSilentGain=null;audioRecordAltProfile=null;audioRecordReply=null;audioRecordPostAnnouncementsAllowed=false;
    const button=$('#record-audio');if(button){button.textContent='◉ Audio';button.classList.remove('recording');}
    if(sampleCount>0){const blob=createPcmWavBlob(chunks,sampleCount);if(blob.size>50*1024*1024){toast('El audio supera el límite de 50 MB. Graba un mensaje más corto.','error');return;}const file=new File([blob],`nexus-audio-${Date.now()}.wav`,{type:'audio/wav'});await uploadAttachmentFile(file,options);}
  }
  async function toggleAudioRecording(){
    const button=$('#record-audio');if(!button)return;
    if(audioRecorder&&audioRecorder.state==='recording'){await audioRecorder.stop();return;}
    if(!currentContext){toast('Abre primero una conversación o un canal.','error');return;}
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!navigator.mediaDevices?.getUserMedia||!AudioContextClass){toast('Este navegador no admite la grabación de audio necesaria.','error');return;}
    const targetContext={...currentContext};const targetAltProfile=activeAltProfile?{...activeAltProfile}:null;const targetReply=replyTarget?{...replyTarget}:null;const targetCanPostAnnouncements=Boolean(currentChannelPermission('post_announcements',communityPermissions.post_announcements));
    try{
      audioRecordStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:{ideal:1}},video:false});
      audioRecordContext=targetContext;audioRecordAltProfile=targetAltProfile;audioRecordReply=targetReply;audioRecordPostAnnouncementsAllowed=targetCanPostAnnouncements;audioRecordChunks=[];audioRecordSampleCount=0;
      audioRecordAudioContext=new AudioContextClass({latencyHint:'interactive'});await audioRecordAudioContext.resume();
      audioRecordSource=audioRecordAudioContext.createMediaStreamSource(audioRecordStream);
      audioRecordProcessor=audioRecordAudioContext.createScriptProcessor(4096,1,1);
      audioRecordSilentGain=audioRecordAudioContext.createGain();audioRecordSilentGain.gain.value=0;
      audioRecordProcessor.onaudioprocess=event=>{
        if(audioRecorder?.state!=='recording')return;
        const pcm=resampleAudioToPcm16(event.inputBuffer.getChannelData(0),audioRecordAudioContext.sampleRate,16000);
        if(pcm.length){audioRecordChunks.push(pcm);audioRecordSampleCount+=pcm.length;}
        // 15 minutes of mono 16 kHz WAV stays safely below the 50 MB upload cap.
        if(audioRecordSampleCount>=16000*15*60){toast('Se alcanzó el máximo de 15 minutos. Preparando el audio…');finishAudioRecording();}
      };
      audioRecordSource.connect(audioRecordProcessor);audioRecordProcessor.connect(audioRecordSilentGain);audioRecordSilentGain.connect(audioRecordAudioContext.destination);
      audioRecorder={state:'recording',stop:finishAudioRecording};
      button.textContent='■ Detener y enviar';button.classList.add('recording');toast('Grabando audio universal WAV… Pulsa otra vez para enviar.');
    }catch(error){
      audioRecordStream?.getTracks().forEach(track=>track.stop());audioRecordStream=null;
      try{audioRecordSource?.disconnect();}catch{}try{audioRecordProcessor?.disconnect();}catch{}try{audioRecordSilentGain?.disconnect();}catch{}
      if(audioRecordAudioContext&&audioRecordAudioContext.state!=='closed'){try{await audioRecordAudioContext.close();}catch{}}
      audioRecordAudioContext=null;audioRecordSource=null;audioRecordProcessor=null;audioRecordSilentGain=null;audioRecordChunks=[];audioRecordSampleCount=0;audioRecorder=null;audioRecordContext=null;audioRecordAltProfile=null;audioRecordReply=null;audioRecordPostAnnouncementsAllowed=false;
      button.textContent='◉ Audio';button.classList.remove('recording');showError(error,'No se pudo iniciar la grabación. Comprueba el permiso del micrófono.');
    }
  }
  function splitNexusParts(value, count){
    const parts=[];let rest=String(value||'');
    for(let i=0;i<count-1;i++){const at=rest.indexOf(':');if(at<0)return null;parts.push(rest.slice(0,at));rest=rest.slice(at+1);}
    parts.push(rest);return parts;
  }
  function findBalancedClose(text,start){
    let depth=0,quote='',escaped=false;
    for(let i=start;i<text.length;i++){
      const char=text[i];
      if(quote){if(escaped){escaped=false;continue;}if(char==='\\'){escaped=true;continue;}if(char===quote)quote='';continue;}
      if((char==='\"'||char==="'")&&['=',':','(','['].includes(text.slice(0,i).trimEnd().slice(-1))){quote=char;continue;}
      if(text.startsWith('/*',i)){const end=text.indexOf('*/',i+2);if(end<0)return -1;i=end+1;continue;}
      if(char==='{')depth++;
      else if(char==='}'){depth--;if(depth===0)return i;}
    }
    return -1;
  }
  function safeExternalLink(value){try{const url=new URL(String(value||''),location.href);return url.protocol==='https:'?url.href:null;}catch{return null;}}
  function sanitizeNexCss(css){
    let value=String(css||'').slice(0,12000);
    value=value.replace(/@import\b[^;]*;?/gi,'').replace(/url\s*\([^)]*\)/gi,'').replace(/expression\s*\([^)]*\)/gi,'').replace(/javascript\s*:/gi,'');
    value=value.replace(/behavior\s*:[^;]+;?/gi,'').replace(/-moz-binding\s*:[^;]+;?/gi,'');
    return value;
  }
  const NEXCSS_TAGS=new Set('div span p h1 h2 h3 h4 h5 h6 ul ol li table thead tbody tfoot tr th td button label input textarea select option progress meter details summary blockquote pre code strong em b i small s mark br hr fieldset legend dl dt dd figure figcaption section article header footer main nav output'.split(' '));
  const NEXCSS_ATTRS=new Set('class id name style type placeholder value checked disabled selected min max step rows cols colspan rowspan scope title aria-label role align'.split(' '));
  function sanitizeNexCssHtml(html){
    const doc=new DOMParser().parseFromString(`<body>${String(html||'').slice(0,24000)}</body>`,'text/html');
    const body=doc.body;
    for(const node of [...body.querySelectorAll('*')].reverse()){
      if(!NEXCSS_TAGS.has(node.tagName.toLowerCase())){node.replaceWith(...node.childNodes);continue;}
      for(const attr of [...node.attributes]){
        const name=attr.name.toLowerCase();
        if(!NEXCSS_ATTRS.has(name)||name.startsWith('on')){node.removeAttribute(attr.name);continue;}
        if(name==='style')node.setAttribute('style',sanitizeNexCss(attr.value));
      }
      if(node.tagName==='INPUT'&&!['text','checkbox','radio','number','range','date','time','color'].includes(node.getAttribute('type')||'text'))node.setAttribute('type','text');
    }
    return body.innerHTML;
  }
  function nexCssTestMarkup(){
    return `<main class="nexus-demo"><header><small>VISTA DE PRUEBA · NEXCSS</small><h1>Título de ejemplo</h1><p>Texto normal con <strong>negrita</strong>, <em>cursiva</em>, <mark>resaltado</mark> y <code>código</code>.</p></header><section class="nexus-demo-card"><h2>Contenedores y texto</h2><p>Un párrafo dentro de una sección para probar márgenes, fondos y tipografía.</p><blockquote>Una cita de ejemplo para probar blockquote.</blockquote><small>Texto secundario y etiquetas pequeñas.</small><hr><h3>Listas</h3><ul><li>Primer elemento</li><li>Segundo elemento</li><li>Tercer elemento</li></ul><ol><li>Primer paso</li><li>Segundo paso</li></ol></section><section class="nexus-demo-card"><h2>Controles</h2><label>Campo de texto <input type="text" placeholder="Escribe aquí"></label><label>Selector <select><option>Opción uno</option><option>Opción dos</option></select></label><label>Área de texto <textarea rows="2" placeholder="Texto de ejemplo"></textarea></label><label><input type="checkbox" checked> Casilla marcada</label><label><input type="radio" name="nexus-demo-radio" checked> Opción A</label><label><input type="radio" name="nexus-demo-radio"> Opción B</label><button type="button">Botón principal</button><button type="button" disabled>Botón desactivado</button><progress value="65" max="100"></progress><meter value=".72">72%</meter></section><section class="nexus-demo-card"><h2>Tabla</h2><table><thead><tr><th>Nombre</th><th>Estado</th><th>Valor</th></tr></thead><tbody><tr><td>Elemento A</td><td>Activo</td><td>42</td></tr><tr><td>Elemento B</td><td>Pendiente</td><td>18</td></tr></tbody></table><details open><summary>Detalles desplegables</summary><p>Contenido interno de ejemplo.</p></details><pre><code>const nexus = 'demo';</code></pre></section><footer><small>Fin de la muestra de etiquetas HTML.</small></footer></main>`;
  }
  function buildNexCssFrame(html,css){
    const cleanHtml=sanitizeNexCssHtml(html);const cleanCss=sanitizeNexCss(css).replace(/[<>]/g,'');
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:14px system-ui,sans-serif;margin:12px;color:#202536;background:#fff}*{box-sizing:border-box}button,input,select,textarea{font:inherit}img,video,iframe{display:none!important} ${cleanCss}</style></head><body>${cleanHtml}</body></html>`;
  }
  function parseTableBlock(raw){
    const match=String(raw||'').match(/^table:head=\{([\s\S]*?)\}:body=\{([\s\S]*?)\}(?::footer=\{([\s\S]*?)\})?$/i);
    if(!match)return null;
    const parseRows=(markup,cellTag)=>{
      const doc=new DOMParser().parseFromString(`<table>${markup||''}</table>`,'text/html');
      const rows=[...doc.querySelectorAll('tr')].slice(0,100).map(row=>[...row.querySelectorAll('th,td')].slice(0,20).map(cell=>({text:cell.textContent.slice(0,500),colspan:Math.max(1,Math.min(10,Number(cell.getAttribute('colspan'))||1)),rowspan:Math.max(1,Math.min(10,Number(cell.getAttribute('rowspan'))||1)),header:cell.tagName==='TH'})));
      return rows;
    };
    return {head:parseRows(match[1],'th'),body:parseRows(match[2],'td'),footer:parseRows(match[3]||'','td')};
  }
  function parseNexusMarkdown(source){
    let text=String(source||'');const blocks=[];const codeParts=[];const codeButtons=[];const codeLangLabels=[];
    text=text.replace(/(^```[^\n]*\n[\s\S]*?^```|`[^`\n]*`)/gm,match=>{let stored=match;if(match.startsWith('```')){const header=match.match(/^```([^\n]*)/);const rawHeader=header?.[1]||'';const enabled=Boolean(/&&buttons=true/i.test(rawHeader));const showLanguage=Boolean(/&&lang=true/i.test(rawHeader));const language=rawHeader.replace(/&&buttons=true/ig,'').replace(/&&lang=true/ig,'').trim().split(/\s+/)[0]||'';codeButtons.push(enabled);codeLangLabels.push(showLanguage?language:'');if(enabled||showLanguage)stored=match.replace(/^```([^\n]*)/,()=> '```'+rawHeader.replace(/&&buttons=true/ig,'').replace(/&&lang=true/ig,'').trim());}const token=`NEXUSCODEKEEP${codeParts.length}END`;codeParts.push(stored);return token;});
    let spoilerAll=false;
    text=text.replace(/\{SPOILER\s*=\s*true\}/ig,()=>{spoilerAll=true;return '';});
    function addBlock(block){const token=`NEXUSMDTOKEN${blocks.length}END`;blocks.push(block);return token;}
    function parseInline(value,depth=0){
      if(depth>256)return value;
      let out='';
      for(let i=0;i<value.length;){
        if(value.startsWith('||',i)){const close=value.indexOf('||',i+2);if(close>i+2){const inner=parseInline(value.slice(i+2,close),depth+1);out+=addBlock({kind:'spoiler',content:inner});i=close+2;continue;}}
        if(value[i]==='{'){
          const close=findBalancedClose(value,i);if(close>i){const raw=value.slice(i+1,close);const parsed=parseBlock(raw,depth+1);if(parsed){out+=parsed;i=close+1;continue;}}
        }
        out+=value[i++];
      }
      return out;
    }
    function parseBlock(raw,depth){
      const lower=raw.toLowerCase();
      if(lower==='dinbreak')return addBlock({kind:'hr'});
      if(/^nexcss:/i.test(raw))return addBlock({kind:'nexcss',content:raw.slice(7)});
      if(/^table:/i.test(raw)){const table=parseTableBlock(raw);if(table)return addBlock({kind:'table',table});}
      if(/^src:(web|book):/i.test(raw)){
        const parts=splitNexusParts(raw.slice(4),2);if(parts){const kind=parts[0].toLowerCase();const rest=splitNexusParts(parts[1],1)[0];const ix=rest.indexOf(':');if(ix>=0)return addBlock({kind:'citation',sourceType:kind,label:rest.slice(0,ix).slice(0,200),url:rest.slice(ix+1).trim().slice(0,1000)});}
      }
      if(/^button:/i.test(raw)){const parts=splitNexusParts(raw.slice(7),2);if(parts){const ix=parts[1].indexOf(':');return addBlock({kind:'button',color:parts[0],label:(ix<0?parts[1]:parts[1].slice(0,ix)).slice(0,100),url:ix<0?'':parts[1].slice(ix+1).trim()});}}
      if(/^invite:/i.test(raw)){const m=raw.match(/^invite:([^:]{1,100}):([^:]{1,240}):"([^"]{1,1000})":"([^"]{1,1000})"$/i);if(m)return addBlock({kind:'invite',title:m[1],description:m[2],banner:m[3],url:m[4]});}
      if(/^icon:/i.test(raw))return addBlock({kind:'icon',url:raw.slice(5).trim()});
      if(/^delay:/i.test(raw)){
        const value=raw.slice(6);const ix=value.indexOf(':');
        const hasExplicitDelay=ix>0&&/^\d+$/.test(value.slice(0,ix));
        const ms=hasExplicitDelay?Math.max(0,Math.min(30000,Number(value.slice(0,ix)))):1200;
        const content=hasExplicitDelay?value.slice(ix+1):value;
        return addBlock({kind:'delay',ms,content:parseInline(content,depth+1)});
      }
      if(/^hover:/i.test(raw))return addBlock({kind:'hover',content:parseInline(raw.slice(6),depth+1)});
      if(/^spoiler:/i.test(raw))return addBlock({kind:'spoiler',content:parseInline(raw.slice(8),depth+1)});
      if(/^insync:/i.test(raw)){
        const parts=splitNexusParts(raw.slice(7),3);if(parts){const type=parts[0].toLowerCase();const titleAndKey=splitNexusParts(parts[2],2)||[parts[2],''];if(['text','search','email','tel','url','checkbox','radio','number','range','date','time','month','week','datetime-local','color'].includes(type))return addBlock({kind:'inputsync',type,preview:parts[1].slice(0,120),title:titleAndKey[0].slice(0,100),key:(titleAndKey[1]||'').slice(0,80)});}
      }
      if(/^([0-9a-f-]{36}):([^:]{1,40}):(.+)$/i.test(raw)){const m=raw.match(/^([0-9a-f-]{36}):([^:]{1,40}):(.+)$/i);return addBlock({kind:'channel',communityId:m[1],category:m[2],channel:m[3].slice(0,70)});}
      const stylePatterns=[
        [/^(red|orange|yellow|green|blue|purple|pink):([\s\S]*)$/i,(m)=>({colorClass:`nexus-md-color-${m[1].toLowerCase()}`,content:m[2]})],
        [/^color:(#[0-9a-f]{6}):([\s\S]*)$/i,(m)=>({style:{color:m[1]},content:m[2]})],
        [/^size:(\d{1,2}):([\s\S]*)$/i,(m)=>({style:{fontSize:`${Math.max(10,Math.min(48,Number(m[1])))}px`},content:m[2]})],
        [/^font:(serif|mono|space|sans):([\s\S]*)$/i,(m)=>({colorClass:`nexus-md-font-${m[1].toLowerCase()}`,content:m[2]})],
        [/^glow:(blue|purple|green|pink|orange):([\s\S]*)$/i,(m)=>({colorClass:`nexus-md-glow-${m[1].toLowerCase()}`,content:m[2]})]
      ];
      for(const [re,build] of stylePatterns){const m=raw.match(re);if(m){const v=build(m);return addBlock({kind:'styled',...v,content:parseInline(v.content,depth+1)});}}
      return null;
    }
    text=parseInline(text);
    text=text.replace(/NEXUSCODEKEEP(\d+)END/g,(_,i)=>codeParts[Number(i)]||'');
    return {text,blocks,spoilerAll,codeButtons,codeLangLabels};
  }
  function makeNexusTable(table){
    const wrapper=document.createElement('div');wrapper.className='nexus-table-wrap';const el=document.createElement('table');el.className='nexus-md-table';
    const appendRows=(rows,tag)=>{if(!rows?.length)return;const section=document.createElement(tag);for(const cells of rows){const tr=document.createElement('tr');for(const cell of cells){const td=document.createElement(cell.header?'th':'td');td.textContent=cell.text;td.colSpan=cell.colspan;td.rowSpan=cell.rowspan;tr.append(td);}section.append(tr);}el.append(section);};
    appendRows(table.head,'thead');appendRows(table.body,'tbody');appendRows(table.footer,'tfoot');wrapper.append(el);const warning=document.createElement('small');warning.className='nexus-table-beta-warning';warning.textContent='Sintaxis de tablas en beta';wrapper.append(warning);return wrapper;
  }
  function appendNexusInline(parent,value,blocks,message){
    const text=String(value||'');const re=/NEXUSMDTOKEN(\d+)END/g;let cursor=0;let match;
    while((match=re.exec(text))){parent.append(document.createTextNode(text.slice(cursor,match.index)));const child=blocks[Number(match[1])];if(child)parent.append(makeNexusBlock(child,message,blocks));cursor=match.index+match[0].length;}
    parent.append(document.createTextNode(text.slice(cursor)));
  }
  function makeNexusBlock(block,message,blocks=[]){
    if(block.kind==='hr'){const hr=document.createElement('hr');hr.className='nexus-dinbreak';return hr;}
    if(block.kind==='styled'||block.kind==='hover'){
      const span=document.createElement('span');span.className=block.kind==='hover'?'nexus-md-hover':(block.colorClass||'');if(block.style)for(const [key,value] of Object.entries(block.style))span.style[key]=value;
      const content=block.kind==='hover'?block.content:block.content;appendNexusInline(span,content,blocks,message);return span;
    }
    if(block.kind==='spoiler'){const button=document.createElement('span');button.className='nexus-spoiler';button.setAttribute('role','button');button.tabIndex=0;appendNexusInline(button,block.content,blocks,message);button.setAttribute('aria-expanded','false');const toggle=()=>{button.classList.toggle('revealed');button.setAttribute('aria-expanded',String(button.classList.contains('revealed')));};button.addEventListener('click',toggle);button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});return button;}
    if(block.kind==='icon'){const url=safeExternalLink(block.url);if(!url)return document.createTextNode('');const img=document.createElement('img');img.className='nexus-inline-icon';img.src=url;img.alt='';img.loading='lazy';return img;}
    if(block.kind==='button'){const url=safeExternalLink(block.url);const a=document.createElement(url?'a':'span');a.className='nexus-md-button';if(url){a.href=url;a.target='_blank';a.rel='noopener noreferrer';}a.textContent=block.label||'Abrir';const color=/^#[0-9a-f]{6}$/i.test(block.color)?block.color:({purple:'#7865d8',blue:'#3979c8',green:'#26885c',red:'#b74655',orange:'#b96b30',gray:'#596273'}[String(block.color||'').toLowerCase()]||'#7865d8');a.style.setProperty('--nexus-button-color',color);return a;}
    if(block.kind==='citation'){const url=safeExternalLink(block.url);const box=document.createElement('span');box.className='nexus-apa-citation';const label=document.createElement('span');const sourceName=block.label||'Fuente';label.textContent=block.sourceType==='book'?`${sourceName}. (s. f.). `:`${sourceName}. (s. f.). `;const italic=document.createElement('em');italic.textContent=block.sourceType==='book'?'Libro / página consultada.':'Recurso web.';box.append(label,italic);if(url){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' '+url;box.append(a);}else if(block.sourceType==='book'&&block.url){const page=document.createElement('span');page.textContent=` ${String(block.url).slice(0,120)}`;box.append(page);}return box;}
    if(block.kind==='invite'){const url=safeExternalLink(block.url);if(!url)return document.createTextNode('Invitación no válida');const card=document.createElement('a');card.className='nexus-invite-card';card.href=url;card.target='_blank';card.rel='noopener noreferrer';const banner=document.createElement('div');banner.className='nexus-invite-banner';const color=/^#[0-9a-f]{6}$/i.test(block.banner)?block.banner:null;const image=safeExternalLink(block.banner);if(color)banner.style.background=color;else if(image)banner.style.backgroundImage=`linear-gradient(90deg,#10152255,#101522aa),url("${image.replace(/["\\]/g,'')}")`;const copy=document.createElement('span');const title=document.createElement('strong');title.textContent=block.title;const desc=document.createElement('small');desc.textContent=block.description;const action=document.createElement('b');action.textContent='Abrir invitación';copy.append(title,desc,action);card.append(banner,copy);return card;}
    if(block.kind==='table')return makeNexusTable(block.table);
    if(block.kind==='nexcss'){
      const css=String(block.content||'').slice(0,12000);const html=nexCssTestMarkup();
      const shell=document.createElement('section');shell.className='nexus-nexcss';const tabs=document.createElement('div');tabs.className='nexus-nexcss-tabs';const preview=document.createElement('button');preview.type='button';preview.textContent='HTML de prueba';preview.className='active';const sourceTab=document.createElement('button');sourceTab.type='button';sourceTab.textContent='CSS';const frame=document.createElement('iframe');frame.className='nexus-nexcss-frame';frame.setAttribute('sandbox','');frame.title='Vista previa NexCSS aislada';frame.srcdoc=buildNexCssFrame(html,css);const code=document.createElement('pre');const codeNode=document.createElement('code');codeNode.textContent=sanitizeNexCss(css)||'/* Escribe aquí tu CSS */';code.append(codeNode);code.hidden=true;preview.addEventListener('click',()=>{frame.hidden=false;code.hidden=true;preview.classList.add('active');sourceTab.classList.remove('active');});sourceTab.addEventListener('click',()=>{frame.hidden=true;code.hidden=false;sourceTab.classList.add('active');preview.classList.remove('active');});tabs.append(preview,sourceTab);shell.append(tabs,frame,code);return shell;
    }
    if(block.kind==='channel'){const a=document.createElement('button');a.type='button';a.className='nexus-channel-mention';a.textContent=`#${block.channel}`;a.addEventListener('click',()=>openMentionedChannel(block.communityId,block.category,block.channel));return a;}
    if(block.kind==='delay'){
      const wrap=document.createElement('span');wrap.className='nexus-delay';const disabled=Boolean(profile?.settings?.disableMarkdownDelay);appendNexusInline(wrap,block.content,blocks,message);if(!disabled){wrap.hidden=true;setTimeout(()=>{wrap.hidden=false;wrap.classList.add('revealed');},block.ms);}return wrap;
    }
    if(block.kind==='inputsync'){
      const wrap=document.createElement('label');wrap.className='nexus-inputsync';const title=document.createElement('span');title.textContent=block.title||'Control compartido';const type=block.type;let control;
      if(type==='checkbox'||type==='radio'){control=document.createElement('input');control.type=type;control.value=block.preview;control.checked=type==='checkbox'&&/^(true|1|checked|yes)$/i.test(block.preview);if(type==='radio')control.value=block.preview||'on';}
      else{control=document.createElement('input');control.type=type;control.value=block.preview; if(type==='range'){control.min='0';control.max='100';} }
      const groupKey=block.key||`control-${Math.max(0,blocks.indexOf(block))}`;control.dataset.nexusInputsync='1';control.dataset.messageId=message?.id||'';control.dataset.syncKey=groupKey;control.dataset.syncType=type;control.dataset.syncTitle=block.title||'';if(type==='radio')control.name=`nexus-sync-${message?.id||'message'}-${groupKey}`;if(['text','search','email','tel','url'].includes(type))control.maxLength=160;wrap.append(title,control);return wrap;
    }
    return document.createTextNode('');
  }
  function hydrateNexusBlocks(body,blocks,message){
    if(!body||!blocks?.length)return;
    const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){const value=node.nodeValue||'';const matches=[...value.matchAll(/NEXUSMDTOKEN(\d+)END/g)];if(!matches.length)continue;const frag=document.createDocumentFragment();let cursor=0;for(const match of matches){frag.append(document.createTextNode(value.slice(cursor,match.index)));const block=blocks[Number(match[1])];if(block)frag.append(makeNexusBlock(block,message,blocks));cursor=match.index+match[0].length;}frag.append(document.createTextNode(value.slice(cursor)));node.parentNode?.replaceChild(frag,node);}
  }
  function hydrateCodeBlockButtons(body,parsed){
    if(!parsed?.codeButtons?.some(Boolean))return;const codeBlocks=[...body.querySelectorAll('pre')];
    parsed.codeButtons.forEach((enabled,index)=>{if(!enabled)return;const pre=codeBlocks[index];const code=pre?.querySelector('code');if(!code)return;const tools=document.createElement('div');tools.className='nexus-code-tools';const copy=document.createElement('button');copy.type='button';copy.textContent='Copiar';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code.textContent);copy.textContent='Copiado';setTimeout(()=>copy.textContent='Copiar',1200);}catch{toast('No se pudo copiar el código.','error');}});const download=document.createElement('button');download.type='button';download.textContent='Descargar';download.addEventListener('click',()=>{const blob=new Blob([code.textContent],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`nexus-code-${Date.now()}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});tools.append(copy,download);pre.insertBefore(tools,pre.firstChild);});
  }
  function hydrateCodeBlockLanguageLabels(body,parsed){
    const labels=parsed?.codeLangLabels||[];if(!labels.some(Boolean))return;
    const codeBlocks=[...body.querySelectorAll('pre')];
    labels.forEach((language,index)=>{const pre=codeBlocks[index];if(!pre||!language)return;const label=document.createElement('div');label.className='nexus-code-language-label';label.textContent=String(language).slice(0,24).toUpperCase();pre.insertBefore(label,pre.firstChild);pre.dataset.codeLanguage=String(language).slice(0,24);});
  }
  async function hydrateInputSync(body,message,batchData=null){
    const controls=[...body.querySelectorAll('[data-nexus-inputsync]')];if(!controls.length||!client)return;
    let data;
    if(batchData?.inputSyncStates?.has(message.id))data=batchData.inputSyncStates.get(message.id)||[];
    else {const response=await client.from('nexus_input_sync_states').select('sync_key,state').eq('message_id',message.id);if(response.error){console.warn('No se pudo cargar InputSync:',response.error);return;}data=response.data||[];}
    const states=new Map((data||[]).map(row=>[row.sync_key,row.state||{}]));
    const apply=(control,state)=>{if(!state||!Object.prototype.hasOwnProperty.call(state,'value'))return;if(control.type==='checkbox')control.checked=Boolean(state.value);else if(control.type==='radio')control.checked=control.value===String(state.value);else {const next=String(state.value??'');control.value=next.slice(0,control.maxLength>0?control.maxLength:160);}};
    for(const control of controls){const key=control.dataset.syncKey;apply(control,states.get(key));let timer=null;const save=()=>{if(control.type==='radio'&&!control.checked)return;if(timer)clearTimeout(timer);timer=setTimeout(async()=>{const value=control.type==='checkbox'?control.checked:control.value;const {error:saveError}=await client.from('nexus_input_sync_states').upsert({message_id:message.id,sync_key:key,state:{value},updated_by:currentUser.id},{onConflict:'message_id,sync_key'});if(saveError)toast('No se pudo sincronizar este control.','error');},['text','search','email','tel','url'].includes(control.type)?250:0);};control.addEventListener(['text','search','email','tel','url'].includes(control.type)?'input':'change',save);}
  }
  function applyInputSyncRealtime(payload){
    const row=payload?.new||payload?.old;if(!row?.message_id||!row?.sync_key)return;
    const controls=$$('#messages-container [data-nexus-inputsync]').filter(node=>node.dataset.messageId===row.message_id&&node.dataset.syncKey===row.sync_key);
    if(!controls.length)return;const state=row.state||{};
    for(const control of controls){if(!Object.prototype.hasOwnProperty.call(state,'value'))continue;if(control.type==='checkbox')control.checked=Boolean(state.value);else if(control.type==='radio')control.checked=control.value===String(state.value);else {const next=String(state.value??'');control.value=next.slice(0,control.maxLength>0?control.maxLength:160);}}
  }
  async function openMentionedChannel(communityId,category,channelName){
    if(!client||!communityId)return;
    const {data:channel,error}=await client.from('channels').select('*').eq('community_id',communityId).eq('category',category).ilike('name',channelName).limit(1).maybeSingle();
    if(error||!channel){toast('No se encontró ese canal o no tienes acceso.','error');return;}
    const {data:community}=await client.from('communities').select('*').eq('id',communityId).maybeSingle();if(!community){toast('No se encontró el megagrupo.','error');return;}
    await selectCommunity(community);await openCommunityChannel(channel);
  }
  function renderSpreadsheetPreview(host,url,name,mime){
    const ext=(name.split('.').pop()||'').toLowerCase();const card=document.createElement('section');card.className='nexus-sheet-preview';const heading=document.createElement('strong');heading.textContent=`Hoja de cálculo · ${name}`;card.append(heading);const body=document.createElement('div');body.className='nexus-sheet-content';body.textContent='Cargando vista previa…';card.append(body);const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Descargar archivo';card.append(link);host.append(card);
    (async()=>{try{const response=await fetch(url);if(!response.ok)throw new Error('No se pudo descargar el archivo.');let rows=[];if(ext==='csv'||ext==='tsv'){const text=await response.text();rows=parseCsvPreview(text,ext==='tsv'?'\t':',');}else if(window.XLSX){const buffer=await response.arrayBuffer();const workbook=XLSX.read(buffer,{type:'array',cellDates:false});const sheet=workbook.Sheets[workbook.SheetNames[0]];rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,blankrows:false}).slice(0,16).map(row=>row.slice(0,12));}else throw new Error('No está disponible el lector XLSX en este navegador.');body.replaceChildren();if(!rows.length){body.textContent='La hoja está vacía.';return;}const table=document.createElement('table');for(const row of rows.slice(0,16)){const tr=document.createElement('tr');for(const value of row.slice(0,12)){const cell=document.createElement('td');cell.textContent=String(value??'').slice(0,300);tr.append(cell);}table.append(tr);}body.append(table);}catch(error){body.textContent=`No se pudo generar la vista previa: ${error.message}`;}})();
  }
  function parseCsvPreview(text,delimiter=','){
    const rows=[];let row=[],cell='',quoted=false;const source=String(text||'').slice(0,250000);
    for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'&&quoted&&source[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';if(rows.length>=16)break;}else cell+=c;}
    if(rows.length<16&&(cell||row.length)){row.push(cell);rows.push(row);}return rows;
  }
  function renderLinkPreviews(body){
    if(!body)return;const links=[...body.querySelectorAll('a[href]')].filter(link=>{try{return new URL(link.href).protocol==='https:'&&!link.closest('pre,code,.nexus-apa-citation,.nexus-invite-card,.nexus-md-button');}catch{return false;}}).slice(0,2);
    for(const link of links){if(link.dataset.nexusPreview==='done')continue;link.dataset.nexusPreview='done';let url;try{url=new URL(link.href);}catch{continue;}const card=document.createElement('a');card.className='nexus-link-preview';card.href=url.href;card.target='_blank';card.rel='noopener noreferrer';const icon=document.createElement('img');icon.alt='';icon.loading='lazy';icon.src=`https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=64`;icon.onerror=()=>icon.remove();const copy=document.createElement('span');const title=document.createElement('strong');title.textContent=(link.textContent.trim()||url.hostname).slice(0,100);const domain=document.createElement('small');domain.textContent=url.hostname;copy.append(title,domain);card.append(icon,copy);body.append(card);}
  }
  function applyBoxGlow(article,sender){
    const settings=sender?.settings||{};if(!settings.boxGlowEnabled)return;const color=/^#[0-9a-f]{6}$/i.test(settings.boxGlowColor||'')?settings.boxGlowColor:'#8d7cff';const intensity=Math.max(0,Math.min(100,Number(settings.boxGlowIntensity??35)));if(!intensity)return;article.classList.add('boxglow-active');article.style.setProperty('--boxglow-color',color);article.style.setProperty('--boxglow-strength',`${Math.round(intensity*.24)}px`);const image=safeHttpsUrl(settings.boxGlowImage);if(image)article.style.setProperty('--boxglow-image',`url("${image.replace(/["\\]/g,'')}")`);
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
  function hideEmojiSuggestions(){const box=$('#emoji-suggestions');if(box){box.classList.add('hidden');box.innerHTML='';}}
  function updateEmojiSuggestions(){
    const input=$('#message-input'),box=$('#emoji-suggestions');
    if(!input||!box)return;
    const before=input.value.slice(0,input.selectionStart);
    const match=before.match(/(?:^|[\s([{])(:([a-z0-9_+-]{1,24}))$/i);
    if(!match){hideEmojiSuggestions();return;}
    const token=match[1];const query=match[2].toLowerCase();const start=input.selectionStart-token.length;
    const options=[];
    for(const [name,emoji] of Object.entries(STANDARD_EMOJI_ALIASES)){
      if(name.includes(query)&&!options.some(item=>item.value===emoji))options.push({name,value:emoji,kind:'standard'});
      if(options.length>=6)break;
    }
    for(const item of customEmojiCache.values()){
      if(item?.name?.toLowerCase().includes(query)&&item.signedUrl){options.push({name:item.name,value:`:${item.name}:`,kind:'custom',image:item.signedUrl});}
      if(options.length>=8)break;
    }
    if(!options.length){hideEmojiSuggestions();return;}
    box.innerHTML=options.map((item,index)=>`<button type="button" role="option" data-emoji-option="${index}"><span>${item.image?`<img src="${escapeHtml(item.image)}" alt="">`:escapeHtml(item.value)}</span><strong>:${escapeHtml(item.name)}:</strong></button>`).join('');
    box.classList.remove('hidden');
    $$('[data-emoji-option]',box).forEach(button=>button.addEventListener('click',()=>{
      const item=options[Number(button.dataset.emojiOption)];if(!item)return;
      const value=item.kind==='custom'?`${item.value} `:`${item.value} `;
      input.setRangeText(value,start,input.selectionStart,'end');hideEmojiSuggestions();input.focus();autoResizeComposer(input);broadcastTypingState(true);
    }));
  }
  function handleComposerInput(event) {
    updateMentionSuggestions();
    updateEmojiSuggestions();
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
      online.push({id,name:meta.nickname||meta.username||'Miembro',username:meta.username||'',status:String(meta.status_text||'').slice(0,60),avatar:safeHttpsUrl(meta.avatar_url),frame:safeHttpsUrl(meta.profile_frame_url),plate:safeHttpsUrl(meta.profile_plate_url),plateOpacity:Number.isFinite(Number(meta.profile_plate_opacity))?Math.max(0,Math.min(.6,Number(meta.profile_plate_opacity))):.13,deviceType:meta.device_type==='mobile'?'mobile':'desktop',hiddenGlobalBadgeIds:Array.isArray(meta.hidden_global_badge_ids)?meta.hidden_global_badge_ids:[]});
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
  async function renderOnlineMembersDialog(){
    const host=$('#online-members-grid');if(!host)return;
    const subtitle=$('#online-members-subtitle');if(subtitle)subtitle.textContent=`${contextPresenceMembers.length} ${contextPresenceMembers.length===1?'persona conectada':'personas conectadas'} a este chat`;
    host.replaceChildren();
    if(!contextPresenceMembers.length){host.innerHTML='<p class="empty-state compact">Todavía no hay miembros conectados.</p>';return;}
    const ids=contextPresenceMembers.map(member=>member.id);let badgesByUser=new Map();try{const {data:assignments,error}=await client.from('global_badge_assignments').select('user_id,badge_id').in('user_id',ids);if(error)throw error;const badgeIds=[...new Set((assignments||[]).map(row=>row.badge_id))];const {data:badges}=badgeIds.length?await client.from('global_badges').select('id,name,icon_url').in('id',badgeIds):{data:[]};const byId=new Map((badges||[]).map(badge=>[badge.id,badge]));for(const row of assignments||[]){const badge=byId.get(row.badge_id);if(badge){if(!badgesByUser.has(row.user_id))badgesByUser.set(row.user_id,[]);badgesByUser.get(row.user_id).push(badge);}}}catch(error){console.debug('No se pudieron cargar las medallas globales de presencia:',error.message||error);}
    for(const member of contextPresenceMembers){
      const card=document.createElement('button');card.type='button';card.className='online-member-card';
      if(member.plate){card.style.backgroundImage=`linear-gradient(135deg,#151b2bdd,#25223cdd),url("${member.plate.replace(/["\\]/g,'')}")`;card.style.setProperty('--profile-plate-opacity',String(member.plateOpacity));}
      const avatar=avatarMarkup({avatar_url:member.avatar,profile_frame_url:member.frame,nickname:member.name},'online-member-avatar');
      const copy=document.createElement('span');copy.className='online-member-copy';
      const name=document.createElement('strong');name.textContent=member.id===currentUser?.id?`${member.name} · Tú`:member.name;
      const status=document.createElement('small');status.textContent=`${member.deviceType==='mobile'?'▣ Móvil':'▭ Ordenador'} · ${member.status|| (member.id===currentUser?.id?'Tu sesión':'En línea')}`;
      copy.append(name,status);card.insertAdjacentHTML('afterbegin',avatar);card.append(copy);
      const visibleBadges=(badgesByUser.get(member.id)||[]).filter(badge=>!member.hiddenGlobalBadgeIds.includes(badge.id));if(visibleBadges.length){const tray=document.createElement('span');tray.className='online-member-badges';for(const badge of visibleBadges){const chip=document.createElement('span');chip.title=badge.name;if(/^https:\/\//i.test(badge.icon_url||'')){const img=document.createElement('img');img.src=badge.icon_url;img.alt=badge.name;img.loading='lazy';chip.append(img);}else chip.textContent=badge.icon_url||'★';tray.append(chip);}card.append(tray);}
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
      const [{data:member},{data:communityProfile}] = await Promise.all([
        client.from('community_members').select('nickname').eq('community_id',currentCommunity.id).eq('user_id',userId).maybeSingle(),
        client.from('community_profiles').select('nickname,pronouns,bio,avatar_url,banner_url,default_name_color,name_font_url,message_font_url,name_effect_url,profile_effect_url,profile_plate_url,profile_frame_url,aliases,widgets,settings').eq('community_id',currentCommunity.id).eq('user_id',userId).maybeSingle()
      ]);
      communityNickname = member?.nickname || '';
      if(communityProfile){for(const key of ['nickname','pronouns','bio','avatar_url','banner_url','default_name_color','name_font_url','message_font_url','name_effect_url','profile_effect_url','profile_plate_url','profile_frame_url','aliases','widgets'])if(communityProfile[key]!==null&&communityProfile[key]!==undefined&&communityProfile[key]!=='')person[key]=communityProfile[key];person.settings={...(person.settings||{}),...(communityProfile.settings||{})};}
    }
    const {data:globalAssignments}=await client.from('global_badge_assignments').select('badge_id').eq('user_id',userId);
    const globalIds=(globalAssignments||[]).map(row=>row.badge_id);
    const {data:globalBadges}=globalIds.length?await client.from('global_badges').select('id,name,icon_url').in('id',globalIds):{data:[]};
    const hiddenGlobalBadgeIds=new Set(Array.isArray(person.settings?.hiddenGlobalBadgeIds)?person.settings.hiddenGlobalBadgeIds:[]);
    const visibleGlobalBadges=(globalBadges||[]).filter(badge=>!hiddenGlobalBadgeIds.has(badge.id));
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
    applyBoxGlow(header,person);
    applyBoxGlow(avatar,person);
    const names = document.createElement('div'); names.className='public-profile-names';
    const display = document.createElement('strong'); display.textContent=communityNickname || person.nickname || person.username;
    if (safeHttpsUrl(person.name_effect_url)) display.style.setProperty('--name-effect-image',`url("${safeHttpsUrl(person.name_effect_url).replace(/["\\]/g,'')}")`);
    applyProfileFontToNode(display, person.id, person.name_font_url);
    const handle = document.createElement('small'); handle.textContent=`@${person.username}${communityNickname ? ` · ${person.nickname || person.username}` : ''}`;
    names.append(display,handle); header.append(avatar,names); host.append(banner,header);
    if(visibleGlobalBadges.length){const badgeTray=document.createElement('div');badgeTray.className='global-badge-tray';visibleGlobalBadges.forEach(badge=>{const item=document.createElement('span');item.className='global-badge-chip';item.title=badge.name;if(/^https:\/\//i.test(badge.icon_url||'')){const image=document.createElement('img');image.src=badge.icon_url;image.alt=badge.name;image.loading='lazy';item.append(image);}else item.textContent=badge.icon_url||'★';badgeTray.append(item);});host.append(badgeTray);}
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
    const {data, error} = await client.from('profiles').select('id,username,nickname,avatar_url,default_name_color,name_font_url,message_font_url,name_effect_url,profile_effect_url,profile_plate_url,profile_frame_url,settings').in('id', unique);
    if (error) { console.warn(error); return {}; }
    const result=Object.fromEntries((data || []).map(row => [row.id,row]));
    if(currentContext?.type==='channel'&&currentCommunity?.id){
      const {data:communityRows, error:communityError}=await client.from('community_profiles').select('user_id,nickname,pronouns,bio,avatar_url,banner_url,default_name_color,name_font_url,message_font_url,name_effect_url,profile_effect_url,profile_plate_url,profile_frame_url,aliases,widgets,settings').eq('community_id',currentCommunity.id).in('user_id',unique);
      if(communityError)console.debug('Perfiles de megagrupo:',communityError.message);
      for(const row of communityRows||[]){const target=result[row.user_id];if(!target)continue;for(const key of ['nickname','pronouns','bio','avatar_url','banner_url','default_name_color','name_font_url','message_font_url','name_effect_url','profile_effect_url','profile_plate_url','profile_frame_url','aliases','widgets'])if(row[key]!==null&&row[key]!==undefined&&row[key]!=='' )target[key]=row[key];target.settings={...(target.settings||{}),...(row.settings||{})};target.communityProfileActive=true;}
    }
    return result;
  }
  async function fetchGlobalBadgesByUser(userIds) {
    const ids=[...new Set((userIds||[]).filter(Boolean))];
    const result=new Map();
    if(!ids.length)return result;
    const now=Date.now();
    const pending=ids.filter(id=>{const cached=globalBadgeCache.get(id);return !cached||now-cached.at>30000;});
    if(pending.length){
      try{
        const {data:assignments,error}=await client.from('global_badge_assignments').select('user_id,badge_id').in('user_id',pending);
        if(error)throw error;
        const badgeIds=[...new Set((assignments||[]).map(row=>row.badge_id))];
        const {data:badges,error:badgeError}=badgeIds.length?await client.from('global_badges').select('id,name,icon_url').in('id',badgeIds):{data:[],error:null};
        if(badgeError)throw badgeError;
        const byId=new Map((badges||[]).map(row=>[row.id,row]));
        const grouped=new Map();
        for(const assignment of assignments||[]){const badge=byId.get(assignment.badge_id);if(!badge)continue;if(!grouped.has(assignment.user_id))grouped.set(assignment.user_id,[]);grouped.get(assignment.user_id).push(badge);}
        for(const id of pending)globalBadgeCache.set(id,{at:now,badges:grouped.get(id)||[]});
      }catch(error){console.debug('No se pudieron cargar medallas universales:',error.message||error);}
    }
    for(const id of ids)result.set(id,globalBadgeCache.get(id)?.badges||[]);
    return result;
  }

  function globalBadgeMarkup(badges=[],hiddenIds=[],className='global-badge-tray'){
    const hidden=new Set(Array.isArray(hiddenIds)?hiddenIds:[]);
    const visible=(badges||[]).filter(badge=>!hidden.has(badge.id));
    if(!visible.length)return '';
    return `<span class="${className}">${visible.map(badge=>/^https:\/\//i.test(badge.icon_url||'')?`<img src="${escapeHtml(badge.icon_url)}" alt="${escapeHtml(badge.name)}" title="${escapeHtml(badge.name)}" loading="lazy">`:`<span title="${escapeHtml(badge.name)}">${escapeHtml(badge.icon_url||'★')}</span>`).join('')}</span>`;
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
  function unwrapMessageGroups(container) {
    if(!container)return;
    for(const group of [...container.querySelectorAll(':scope > .message-group')]){
      const plateImage=group.style.getPropertyValue('--profile-plate-image');
      const plateOpacity=group.style.getPropertyValue('--profile-plate-opacity');
      const hasGlow=group.classList.contains('boxglow-active');
      const glowProperties=['--boxglow-color','--boxglow-strength','--boxglow-image'];
      const glowValues=Object.fromEntries(glowProperties.map(property=>[property,group.style.getPropertyValue(property)]));
      for(const message of group.querySelectorAll('.message')){
        message.classList.remove('message-group-continuation');
        // Grouping moves these decorations to the parent. Restore them before
        // unwrapping so edits, reactions and subsequent regrouping keep them.
        if(plateImage)message.style.setProperty('--profile-plate-image',plateImage);
        if(plateOpacity)message.style.setProperty('--profile-plate-opacity',plateOpacity);
        if(hasGlow){
          message.classList.add('boxglow-active');
          for(const property of glowProperties){if(glowValues[property])message.style.setProperty(property,glowValues[property]);}
        }
      }
      while(group.firstChild)container.insertBefore(group.firstChild,group);
      group.remove();
    }
    for(const message of container.querySelectorAll(':scope > .message'))message.classList.remove('message-group-continuation');
  }
  function canGroupMessages(previous,next){
    if(!previous||!next||previous.dataset.senderId!==next.dataset.senderId||previous.dataset.altProfileId!==next.dataset.altProfileId)return false;
    const a=Date.parse(previous.dataset.createdAt||'');const b=Date.parse(next.dataset.createdAt||'');
    const dateA=new Date(a).toLocaleDateString('sv-SE');const dateB=new Date(b).toLocaleDateString('sv-SE');
    return Number.isFinite(a)&&Number.isFinite(b)&&dateA===dateB&&b>=a&&b-a<=5*60*1000;
  }
  function chatDayKey(iso){const date=new Date(iso);return Number.isFinite(date.getTime())?date.toLocaleDateString('sv-SE'):'';}
  function chatDayLabel(iso){const date=new Date(iso);if(!Number.isFinite(date.getTime()))return 'Fecha desconocida';const today=new Date();const yesterday=new Date();yesterday.setDate(today.getDate()-1);if(date.toLocaleDateString('sv-SE')===today.toLocaleDateString('sv-SE'))return 'Hoy';if(date.toLocaleDateString('sv-SE')===yesterday.toLocaleDateString('sv-SE'))return 'Ayer';return new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);}
  function rebuildMessageGroups(container=$('#messages-container')){
    if(!container)return;
    unwrapMessageGroups(container);
    container.querySelectorAll(':scope > .message-date-separator').forEach(node=>node.remove());
    const enabled=profile?.settings?.groupMessages!==false;
    container.classList.toggle('message-grouping-enabled',enabled);
    container.classList.toggle('message-group-width-fix-disabled',Boolean(profile?.settings?.disableMessageGroupWidthFix));
    const children=[...container.childNodes];
    const messages=children.filter(node=>node.nodeType===1&&node.classList.contains('message'));
    const loadButton=children.find(node=>node.nodeType===1&&node.id==='load-older-messages')||null;
    const otherNodes=children.filter(node=>node!==loadButton&&!(node.nodeType===1&&node.classList.contains('message')));
    const fragment=document.createDocumentFragment();
    if(loadButton)fragment.append(loadButton);
    let index=0;let previousDay='';
    while(index<messages.length){
      const dayKey=chatDayKey(messages[index].dataset.createdAt||'');
      if(dayKey&&dayKey!==previousDay){const separator=document.createElement('div');separator.className='message-date-separator';separator.dataset.day=dayKey;const label=document.createElement('span');label.textContent=chatDayLabel(messages[index].dataset.createdAt);separator.append(label);fragment.append(separator);previousDay=dayKey;}
      const groupMessages=[messages[index]];let next=index+1;
      while(enabled&&next<messages.length&&canGroupMessages(groupMessages.at(-1),messages[next])){groupMessages.push(messages[next]);next++;}
      if(groupMessages.length===1)fragment.append(groupMessages[0]);
      else{
        const group=document.createElement('div');group.className='message-group';
        const plateSource=groupMessages.find(message=>message.style.getPropertyValue('--profile-plate-image'))||null;
        if(plateSource){group.style.setProperty('--profile-plate-image',plateSource.style.getPropertyValue('--profile-plate-image'));group.style.setProperty('--profile-plate-opacity',plateSource.style.getPropertyValue('--profile-plate-opacity')||'.13');}
        const glowSource=groupMessages.find(message=>message.classList.contains('boxglow-active'))||null;
        if(glowSource){group.classList.add('boxglow-active');for(const property of ['--boxglow-color','--boxglow-strength','--boxglow-image']){const value=glowSource.style.getPropertyValue(property);if(value)group.style.setProperty(property,value);}}
        groupMessages.forEach((message,messageIndex)=>{message.classList.toggle('message-group-continuation',messageIndex>0);group.append(message);});fragment.append(group);
      }
      index=next;
    }
    for(const node of otherNodes)fragment.append(node);
    container.replaceChildren(fragment);
  }
  const customReactionId = value => typeof value==='string'&&/^custom:[0-9a-f-]{36}$/i.test(value)?value.slice(7):null;
  const trackedMessageScrollContainers=new WeakSet();
  function captureMessageScrollState(container){
    if(!container)return null;
    if(!trackedMessageScrollContainers.has(container)){
      container.addEventListener('scroll',()=>{container.dataset.nexusScrollVersion=String((Number(container.dataset.nexusScrollVersion)||0)+1);},{passive:true});
      trackedMessageScrollContainers.add(container);
    }
    const distance=container.scrollHeight-container.scrollTop-container.clientHeight;
    const viewport=container.getBoundingClientRect();
    const anchor=[...container.querySelectorAll('.message')].find(node=>{
      const rect=node.getBoundingClientRect();
      return rect.bottom>viewport.top+2&&rect.top<viewport.bottom;
    })||null;
    return {nearBottom:distance<150,anchor,anchorTop:anchor?anchor.getBoundingClientRect().top:null,scrollVersion:Number(container.dataset.nexusScrollVersion)||0};
  }
  function restoreMessageScrollState(container,state){
    if(!container||!state)return;
    requestAnimationFrame(()=>{
      if(container!==$('#messages-container'))return;
      // Never override a deliberate user scroll made while messages were loading.
      if((Number(container.dataset.nexusScrollVersion)||0)!==state.scrollVersion)return;
      if(state.nearBottom){container.scrollTop=container.scrollHeight;return;}
      if(state.anchor?.isConnected&&Number.isFinite(state.anchorTop)){
        const delta=state.anchor.getBoundingClientRect().top-state.anchorTop;
        if(Math.abs(delta)>.5)container.scrollTop+=delta;
      }
    });
  }
  // Serialize DOM reconstruction. Realtime INSERT/UPDATE events can arrive while
  // another batch is still resolving profiles, replies or media URLs. Running
  // two unwrap/append/regroup passes at once can detach decorations or disturb scroll.
  let messageRenderQueue=Promise.resolve();
  function renderMessageRows(rows){
    if(!rows?.length)return Promise.resolve();
    const expectedContextKey=messageContextKey();
    const task=messageRenderQueue.then(()=>renderMessageRowsNow(rows,expectedContextKey));
    messageRenderQueue=task.catch(error=>{console.error('No se pudo reconstruir el bloque de mensajes:',error);});
    return task;
  }
  async function renderMessageRowsNow(rows,expectedContextKey) {
    if(!rows?.length||messageContextKey()!==expectedContextKey)return;
    const renderContainer=$('#messages-container');
    const scrollState=captureMessageScrollState(renderContainer);
    unwrapMessageGroups(renderContainer);
    const renderContextKey=expectedContextKey;
    const messageIds=rows.map(row=>row.id);
    const replyIds=[...new Set(rows.map(row=>row.reply_to).filter(Boolean))];
    const pollMessageIds=rows.filter(row=>row.message_type==='poll').map(row=>row.id);
    const stickerAssetIds=[...new Set(rows.map(row=>row.attachment?.custom_asset_id).filter(Boolean))];
    const emojiAssetIds=[...new Set(rows.flatMap(row=>Array.isArray(row.formatting?.custom_emojis)?row.formatting.custom_emojis:[]).filter(id=>typeof id==='string'))];
    const inputSyncMessageIds=rows.filter(row=>/\{\s*insync:/i.test(String(row.body||''))).map(row=>row.id);
    const mediaPaths=[...new Set(rows.flatMap(row=>[row.attachment?.path,...(Array.isArray(row.attachment?.items)?row.attachment.items.map(item=>item.path):[])]).filter(Boolean))];
    const [profilesResponse,reactionsResponse,repliesResponse,pollsResponse,stickersResponse,emojisResponse,inputSyncResponse]=await Promise.all([
      fetchProfiles(rows.map(row=>row.sender_id)),
      messageIds.length?client.from('message_reactions').select('message_id,emoji,user_id').in('message_id',messageIds):Promise.resolve({data:[],error:null}),
      replyIds.length?client.from('messages').select('id,body,sender_id,attachment').in('id',replyIds):Promise.resolve({data:[],error:null}),
      pollMessageIds.length?client.from('polls').select('*').in('message_id',pollMessageIds):Promise.resolve({data:[],error:null}),
      stickerAssetIds.length?client.from('custom_assets').select('id,name,asset_url').in('id',stickerAssetIds).eq('asset_type','sticker'):Promise.resolve({data:[],error:null}),
      emojiAssetIds.length?client.from('custom_assets').select('id,name,asset_url,animated').in('id',emojiAssetIds).eq('asset_type','emoji').is('archived_at',null):Promise.resolve({data:[],error:null}),
      inputSyncMessageIds.length?client.from('nexus_input_sync_states').select('message_id,sync_key,state').in('message_id',inputSyncMessageIds):Promise.resolve({data:[],error:null})
    ]);
    const reactionCustomIds=[...new Set((reactionsResponse.data||[]).map(row=>customReactionId(row.emoji)).filter(Boolean))];
    if(reactionCustomIds.length){
      const {data:reactionAssets,error:reactionAssetError}=await client.from('custom_assets').select('id,name,asset_url,animated').in('id',reactionCustomIds).eq('asset_type','emoji');
      if(reactionAssetError)console.warn('No se pudieron resolver emojis personalizados de reacciones:',reactionAssetError);
      else{
        const reactionAssetRows=reactionAssets||[];
        const reactionUrls=await signedUrlLookup('nexus-assets',reactionAssetRows.map(asset=>asset.asset_url));
        for(const asset of reactionAssetRows){const signedUrl=reactionUrls.get(asset.asset_url);if(signedUrl)customReactionCache.set(asset.id,{...asset,signedUrl});}
      }
    }
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
      inputSyncStates:(()=>{const map=new Map(inputSyncMessageIds.map(id=>[id,[]]));if(inputSyncResponse.error)console.warn('No se pudieron cargar los estados InputSync:',inputSyncResponse.error);for(const row of inputSyncResponse.data||[]){if(!map.has(row.message_id))map.set(row.message_id,[]);map.get(row.message_id).push(row);}return map;})(),
      customEmojiReady:true
    };
    for(const message of rows){
      if(messageContextKey()!==renderContextKey) return;
      await appendMessage(message,profiles[message.sender_id],reactionsByMessage.get(message.id)||[],batchData);
    }
    rebuildMessageGroups(renderContainer);
    restoreMessageScrollState(renderContainer,scrollState);
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
      const {data,error}=await client.from('messages').select('*').eq(field,context.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(messagePageSize());
      if(error){finishMessageLoading(container,{scrollBottom:false});showError(error,'No se pudieron cargar los mensajes.');container.insertAdjacentHTML('beforeend','<div class="empty-state compact">No se pudieron cargar los mensajes. Comprueba tu conexión e inténtalo de nuevo.</div>');return;}
      rows=(data||[]).reverse();
      hasOlderMessages=(data||[]).length===messagePageSize();
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
      const scrollVersionBefore=Number(container?.dataset.nexusScrollVersion)||0;
      // Reuse the same batched renderer as the initial page. Reopening a busy
      // chat should not turn into one profile/role/reaction query per message.
      await renderMessageRows(collected);
      if(wasNearBottom&&container&&(Number(container.dataset.nexusScrollVersion)||0)===scrollVersionBefore)container.scrollTop=container.scrollHeight;
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
      const {data,error}=await client.from('messages').select('*').eq(field,context.id).or(`created_at.lt.${oldestMessageTimestamp},and(created_at.eq.${oldestMessageTimestamp},id.lt.${oldestMessageId})`).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(messagePageSize());
      if(error)throw error;
      const older=(data||[]).reverse();
      if(older.length<messagePageSize())hasOlderMessages=false;
      if(older.length){
        saveMessageCache(key,older,hasOlderMessages);
        // Continue from the actual page boundary even if the in-memory cache
        // trimmed older entries to stay within its 200-message budget.
        oldestMessageTimestamp=older[0]?.created_at||oldestMessageTimestamp;
        oldestMessageId=older[0]?.id||oldestMessageId;
        await renderMessageRows(older);
        unwrapMessageGroups(container);
        const button=$('#load-older-messages');
        const messageNodes=older.map(row=>$(`[data-message-id="${row.id}"]`,container)).filter(Boolean);
        const firstExisting=[...container.querySelectorAll('.message')].find(node=>!messageNodes.includes(node));
        for(const node of messageNodes)container.insertBefore(node,firstExisting||null);
        rebuildMessageGroups(container);
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
    const empty=()=>({roles:[],badges:[],globalBadges:[],communityNickname:''});
    try{
      const [membersResponse,assignmentsResponse,badgeAssignmentsResponse,globalAssignmentsResponse]=await Promise.all([
        communityId?client.from('community_members').select('user_id,nickname').eq('community_id',communityId).in('user_id',missing):Promise.resolve({data:[],error:null}),
        communityId?client.from('member_roles').select('user_id,role_id').eq('community_id',communityId).in('user_id',missing):Promise.resolve({data:[],error:null}),
        (()=>{let query=client.from('member_badges').select('user_id,badge_id').in('user_id',missing);query=communityId?query.eq('community_id',communityId):query.is('community_id',null);return query;})(),
        client.from('global_badge_assignments').select('user_id,badge_id').in('user_id',missing)
      ]);
      for(const response of [membersResponse,assignmentsResponse,badgeAssignmentsResponse,globalAssignmentsResponse])if(response.error)console.warn('No se pudo precargar identidad de mensajes:',response.error);
      const roleIds=[...new Set((assignmentsResponse.data||[]).map(row=>row.role_id))];
      const badgeIds=[...new Set((badgeAssignmentsResponse.data||[]).map(row=>row.badge_id))];
      const globalBadgeIds=[...new Set((globalAssignmentsResponse.data||[]).map(row=>row.badge_id))];
      const [rolesResponse,badgesResponse,globalBadgesResponse]=await Promise.all([
        roleIds.length?client.from('community_roles').select('id,name,color,position').in('id',roleIds).order('position',{ascending:false}):Promise.resolve({data:[],error:null}),
        badgeIds.length?client.from('badges').select('id,name,icon_url,animated').in('id',badgeIds):Promise.resolve({data:[],error:null}),
        globalBadgeIds.length?client.from('global_badges').select('id,name,icon_url').in('id',globalBadgeIds):Promise.resolve({data:[],error:null})
      ]);
      const roleById=new Map((rolesResponse.data||[]).map(row=>[row.id,row]));
      const badgeById=new Map((badgesResponse.data||[]).map(row=>[row.id,row]));
      const globalBadgeById=new Map((globalBadgesResponse.data||[]).map(row=>[row.id,row]));
      const memberById=new Map((membersResponse.data||[]).map(row=>[row.user_id,row]));
      const rolesByUser=new Map();for(const row of assignmentsResponse.data||[]){const role=roleById.get(row.role_id);if(role){if(!rolesByUser.has(row.user_id))rolesByUser.set(row.user_id,[]);rolesByUser.get(row.user_id).push(role);}}
      const badgesByUser=new Map();for(const row of badgeAssignmentsResponse.data||[]){const badge=badgeById.get(row.badge_id);if(badge){if(!badgesByUser.has(row.user_id))badgesByUser.set(row.user_id,[]);badgesByUser.get(row.user_id).push(badge);}}
      const globalBadgesByUser=new Map();for(const row of globalAssignmentsResponse.data||[]){const badge=globalBadgeById.get(row.badge_id);if(badge){if(!globalBadgesByUser.has(row.user_id))globalBadgesByUser.set(row.user_id,[]);globalBadgesByUser.get(row.user_id).push(badge);}}
      for(const id of missing){const member=memberById.get(id);messageIdentityCache.set(`${communityId||'personal'}:${id}`,{...empty(),communityNickname:member?.nickname||'',roles:rolesByUser.get(id)||[],badges:badgesByUser.get(id)||[],globalBadges:globalBadgesByUser.get(id)||[]});}
    }catch(error){console.warn('No se pudo precargar identidad de mensajes:',error);}
  }

  async function getMessageIdentity(senderId) {
    const communityId = currentContext?.type === 'channel' ? currentCommunity?.id : null;
    const key = `${communityId || 'personal'}:${senderId}`;
    if (messageIdentityCache.has(key)) return messageIdentityCache.get(key);
    const result = {roles:[],badges:[],globalBadges:[]};
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
      const {data:globalAssignments}=await client.from('global_badge_assignments').select('badge_id').eq('user_id',senderId);
      const globalIds=(globalAssignments||[]).map(row=>row.badge_id);
      if(globalIds.length){const {data:globalBadges}=await client.from('global_badges').select('id,name,icon_url').in('id',globalIds);result.globalBadges=globalBadges||[];}
    } catch (error) {
      console.warn('No se pudieron cargar las insignias o roles del mensaje:',error);
    }
    messageIdentityCache.set(key,result);
    return result;
  }


  // ImageCulling beta: load from the visible/bottom portion of a chat upward.
  function deferMessageImages(root){
    if(!root)return;
    root.querySelectorAll('.message-attachment img[src],.message-attachment video[src]').forEach(media=>{
      const src=media.getAttribute('src');
      if(src){media.dataset.nexusDeferredSrc=src;media.removeAttribute('src');}
      if(media.tagName==='VIDEO')media.preload='none';else media.loading='lazy';
    });
  }
  function loadDeferredMedia(media){
    const src=media?.dataset?.nexusDeferredSrc;
    if(!src||media.getAttribute('src'))return;
    media.setAttribute('src',src);delete media.dataset.nexusDeferredSrc;
    if(media.tagName==='VIDEO'){media.preload='metadata';try{media.load();}catch{}}
  }
  function activateDeferredMessageImages(root,container=$('#messages-container')){
    if(!root)return;
    if(profile?.settings?.imageCulling===false){root.querySelectorAll('[data-nexus-deferred-src]').forEach(loadDeferredMedia);return;}
    const targets=[...root.querySelectorAll('[data-nexus-deferred-src]')];
    if(!targets.length)return;
    if(!('IntersectionObserver' in window)){targets.forEach(loadDeferredMedia);return;}
    const scrollRoot=container||null;
    if(messageImageObserver && messageImageObserverRoot!==scrollRoot){messageImageObserver.disconnect();messageImageObserver=null;}
    if(!messageImageObserver){
      messageImageObserverRoot=scrollRoot;
      messageImageObserver=new IntersectionObserver(entries=>{
        for(const entry of entries){
          if(entry.isIntersecting){loadDeferredMedia(entry.target);messageImageObserver?.unobserve(entry.target);}
        }
      },{root:scrollRoot,rootMargin:'280px 0px 900px 0px',threshold:0.01});
    }
    targets.forEach(media=>messageImageObserver.observe(media));
  }
  function loadAllDeferredMessageImages(){
    if(messageImageObserver){messageImageObserver.disconnect();messageImageObserver=null;messageImageObserverRoot=null;}
    $$('#messages-container [data-nexus-deferred-src]').forEach(loadDeferredMedia);
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
    article.dataset.senderId = message.sender_id || '';
    article.dataset.altProfileId = message.alt_profile_id || '';
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
    const hiddenGlobalBadgeIds=new Set(Array.isArray(sender?.settings?.hiddenGlobalBadgeIds)?sender.settings.hiddenGlobalBadgeIds:[]);
    const visibleGlobalBadges=(identity.globalBadges||[]).filter(badge=>!hiddenGlobalBadgeIds.has(badge.id));
    if (identity.roles.length || identity.badges.length || visibleGlobalBadges.length || message.alt_profile_id) {
      const decorations = document.createElement('span');
      decorations.className = 'message-identity-decorations';
      for (const role of identity.roles) {
        const tag = document.createElement('span');
        tag.className = 'message-role-tag';
        tag.textContent = role.name;
        tag.style.setProperty('--role-color', role.color || '#a99bff');
        decorations.append(tag);
      }
      for (const badge of [...identity.badges,...visibleGlobalBadges]) {
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
    const forwardButton=document.createElement('button');forwardButton.type='button';forwardButton.className='message-action-button';forwardButton.textContent='Reenviar';forwardButton.addEventListener('click',()=>openForwardMessageDialog(message,sender));messageActions.append(forwardButton);
    const pinButton = document.createElement('button');
    pinButton.type = 'button'; pinButton.className = 'message-action-button'; pinButton.textContent = 'Fijar';
    pinButton.dataset.pinMessageId = message.id;
    if (currentContext?.type === 'channel' && !currentChannelPermission('manage_messages',communityPermissions.manage_messages)) { pinButton.disabled = true; pinButton.title = 'Solo moderadores pueden fijar mensajes en este canal.'; }
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
    if (message.sender_id === currentUser.id || (currentContext?.type === 'channel' && currentChannelPermission('manage_messages',communityPermissions.manage_messages))) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'message-delete-button';
      deleteButton.textContent = 'Eliminar';
      deleteButton.title = 'Eliminar este mensaje';
      deleteButton.addEventListener('click', async () => {
        if (!(await nexusConfirm('Eliminar mensaje','¿Quieres eliminar este mensaje? Esta acción no se puede deshacer.','Eliminar'))) return;
        const {error} = await client.from('messages').delete().eq('id',message.id);
        if (error) showError(error,'No tienes permiso para eliminar este mensaje.');
        else { const key=messageContextKey(); const state=messageCache.get(key); if(state)saveMessageCache(key,state.rows.filter(row=>row.id!==message.id),state.hasOlder); article.remove(); renderedMessageIds.delete(message.id); rebuildMessageGroups(container); toast('Mensaje eliminado.','success'); }
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
    if(message.formatting?.forwarded_from){
      const forwarded=document.createElement('div');
      forwarded.className='message-forwarded-label';
      forwarded.textContent='↪ Reenviado';
      $('.message-main',article)?.insertBefore(forwarded,body);
    }
    const source = String(message.body || '');
    if((sender?.communityProfileActive||sender?.settings?.messageFont==='profile')&&safeHttpsUrl(sender?.message_font_url))applyProfileFontToNode(body,sender.id,sender.message_font_url);
    applyBoxGlow(article,sender);
    try {
      const parsedMarkdown=parseNexusMarkdown(source);
      const rendered = window.marked ? marked.parse(parsedMarkdown.text, {breaks:true, gfm:true}) : escapeHtml(parsedMarkdown.text).replace(/\n/g,'<br>');
      body.innerHTML = window.DOMPurify ? DOMPurify.sanitize(rendered, {USE_PROFILES:{html:true}}) : escapeHtml(source);
      hydrateNexusBlocks(body,parsedMarkdown.blocks,message);
      hydrateCodeBlockButtons(body,parsedMarkdown);
      hydrateCodeBlockLanguageLabels(body,parsedMarkdown);
      if(parsedMarkdown.spoilerAll){const spoiler=document.createElement('div');spoiler.className='nexus-spoiler nexus-spoiler-all';spoiler.setAttribute('role','button');spoiler.tabIndex=0;spoiler.setAttribute('aria-expanded','false');const content=document.createElement('span');content.className='nexus-spoiler-content';while(body.firstChild)content.append(body.firstChild);spoiler.append(content);const toggleSpoiler=()=>{spoiler.classList.toggle('revealed');spoiler.setAttribute('aria-expanded',String(spoiler.classList.contains('revealed')));};spoiler.addEventListener('click',toggleSpoiler);spoiler.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleSpoiler();}});body.append(spoiler);}
      body.querySelectorAll('pre code').forEach(block=>{if(window.hljs)window.hljs.highlightElement(block);});
      renderLinkPreviews(body);
      applyMentionMarkup(body, message.formatting?.mentions || []);
      applyChannelMentionMarkup(body);
      await hydrateInputSync(body,message,batchData);
      if (Array.isArray(message.formatting?.custom_emojis) && message.formatting.custom_emojis.length) {
        if(!batchData?.customEmojiReady)await ensureCustomEmojiAssetsForMessage(message);
        renderCustomEmojiTokens(body);
      }
      renderStandardEmojiShortcodes(body);
      const emojiOnlyText=source.trim().replace(/:([a-z0-9_+-]{1,32}):/gi,'🙂');
      if(emojiOnlyText&&emojiOnlyText.length<=96&&!/[\p{L}\p{N}]/u.test(emojiOnlyText)&&/[\p{Extended_Pictographic}]/u.test(emojiOnlyText))article.classList.add('message-emoji-only');
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
    if (message.attachment?.kind === 'bundle' && Array.isArray(message.attachment.items)) {
      const host=$('.message-attachment',article);const content=document.createElement('div');content.className='message-attachment-bundle';
      for(const item of message.attachment.items.slice(0,10)){
        const url=batchData?.mediaUrls?.get(item.path)||null;if(!url)continue;
        const card=document.createElement('div');card.className='message-attachment-bundle-item';
        const name=String(item.name||'archivo').slice(0,180);const type=String(item.mimetype||'');
        if(type.startsWith('image/')){const link=document.createElement('a');link.className='message-image-link';link.href=url;link.target='_blank';link.rel='noopener noreferrer';const image=document.createElement('img');image.className='message-media-image';image.alt=name;image.dataset.nexusDeferredSrc=url;image.loading='lazy';image.decoding='async';link.append(image);card.append(link);}
        else if(type.startsWith('video/')){const video=document.createElement('video');video.className='message-media-video';video.controls=true;video.playsInline=true;video.preload='metadata';video.dataset.nexusDeferredSrc=url;card.append(video);const label=document.createElement('small');label.textContent=name;card.append(label);}
        else if(type.startsWith('audio/')){const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=url;card.append(audio);const label=document.createElement('small');label.textContent=name;card.append(label);}
        else if(type==='text/csv'||type==='text/tab-separated-values'||/^application\/(vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.oasis\.opendocument\.spreadsheet)$/i.test(type)||/\.(csv|tsv|xls|xlsx|ods)$/i.test(name))renderSpreadsheetPreview(card,url,name,type);
        else{const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.download=name;link.textContent=`Descargar ${name}`;card.append(link);}
        content.append(card);
      }
      if(message.attachment.spoiler){const reveal=document.createElement('button');reveal.type='button';reveal.className='attachment-spoiler-reveal';reveal.textContent='Mostrar archivos adjuntos';content.hidden=true;reveal.addEventListener('click',()=>{content.hidden=false;reveal.remove();});host.append(reveal);}
      host.append(content);
    }
    if (message.attachment?.path) {
      let signedUrl=batchData?.mediaUrls?.get(message.attachment.path)||null;
      if(!batchData){const response=await client.storage.from('chat-media').createSignedUrl(message.attachment.path,3600);signedUrl=response.data?.signedUrl||null;}
      if (signedUrl) {
        const attachment = $('.message-attachment', article);
        const type = message.attachment.mimetype || '';
        const rawName=message.attachment.name||'archivo';
        const name = escapeHtml(rawName);
        if(type==='text/csv'||type==='text/tab-separated-values'||/^application\/(vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.oasis\.opendocument\.spreadsheet)$/i.test(type)||/\.(csv|tsv|xls|xlsx|ods)$/i.test(rawName))renderSpreadsheetPreview(attachment,signedUrl,rawName,type);
        else if (type.startsWith('image/')) attachment.innerHTML = `<a class="message-image-link" href="${signedUrl}" target="_blank" rel="noopener noreferrer"><img class="message-media-image" src="${signedUrl}" alt="${name}" loading="lazy" decoding="async"></a>`;
        else if (type.startsWith('video/')) { attachment.innerHTML = `<div class="nexus-video-card"><video class="message-media-video" controls playsinline preload="metadata" src="${signedUrl}"></video><div class="nexus-video-toolbar"><strong>${name}</strong><div><button type="button" class="button button-secondary" data-video-fullscreen>Ampliar</button><a class="button button-secondary" href="${signedUrl}" download="${name}">Descargar</a></div></div></div>`; const video=attachment.querySelector('video');attachment.querySelector('[data-video-fullscreen]')?.addEventListener('click',()=>{if(video?.requestFullscreen)video.requestFullscreen().catch(()=>{});else video?.webkitEnterFullscreen?.();}); }
        else if (type.startsWith('audio/')) attachment.innerHTML = `<div class="message-audio-card"><span>♫</span><div><strong>${name}</strong><audio controls preload="metadata" src="${signedUrl}"></audio></div><a href="${signedUrl}" download="${name}" aria-label="Descargar audio">↓</a></div>`;
        else attachment.innerHTML = `<a href="${signedUrl}" download="${name}">Descargar ${name}</a>`;
      }
    }
    const reactionBar = $('.message-reactions', article);
    reactionBar.dataset.reactionMessage = message.id;
    if (container !== $('#messages-container') || currentContext?.id !== contextIdAtStart) return;
    const stickToBottom=container.scrollHeight-container.scrollTop-container.clientHeight<120;
    const scrollVersionAtAppend=Number(container.dataset.nexusScrollVersion)||0;
    deferMessageImages(article);
    container.append(template);
    activateDeferredMessageImages(article,container);
    renderedMessageIds.add(message.id);
    const keepBottomIfNeeded=()=>{
      if(container!==$('#messages-container'))return;
      const distance=container.scrollHeight-container.scrollTop-container.clientHeight;
      if(distance<160)container.scrollTop=container.scrollHeight;
    };
    article.querySelectorAll('.message-attachment img').forEach(media=>{media.addEventListener('load',keepBottomIfNeeded,{once:true});media.addEventListener('error',()=>media.classList.add('media-load-error'),{once:true});});
    article.querySelectorAll('.message-attachment video').forEach(media=>media.addEventListener('loadedmetadata',keepBottomIfNeeded,{once:true}));
    await refreshMessageReactions(article, message.id, initialReactions);
    if(stickToBottom&&(Number(container.dataset.nexusScrollVersion)||0)===scrollVersionAtAppend) container.scrollTop = container.scrollHeight;
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
    const missingCustomIds=[...new Set((rows||[]).map(row=>customReactionId(row.emoji)).filter(id=>id&&!customReactionCache.has(id)))];
    if(missingCustomIds.length){
      const {data:assets,error:assetsError}=await client.from('custom_assets').select('id,name,asset_url,animated').in('id',missingCustomIds).eq('asset_type','emoji');
      if(!assetsError&&assets?.length){const urls=await signedUrlLookup('nexus-assets',assets.map(asset=>asset.asset_url));for(const asset of assets){const signedUrl=urls.get(asset.asset_url);if(signedUrl)customReactionCache.set(asset.id,{...asset,signedUrl});}}
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
      const customId=customReactionId(emoji);
      if(customId){
        const asset=customReactionCache.get(customId);
        if(asset?.signedUrl){const image=document.createElement('img');image.src=asset.signedUrl;image.alt=asset.name||'Emoji personalizado';image.title=`:${asset.name||'emoji'}:`;image.loading='lazy';chip.append(image);}
        else{const fallback=document.createElement('span');fallback.textContent='◇';fallback.title='Emoji personalizado no disponible';chip.append(fallback);}
      }else{const symbol=document.createElement('span');symbol.textContent=emoji;chip.append(symbol);}
      const count=document.createElement('span');count.textContent=String(users.length);chip.append(count);
      chip.title = users.length === 1 ? '1 reacción' : `${users.length} reacciones`;
      chip.addEventListener('click', () => toggleMessageReaction(messageId, emoji));
      bar.append(chip);
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'reaction-add';
    add.textContent = '＋';
    add.title = 'Añadir reacción';
    add.addEventListener('click', () => openReactionPicker(messageId));
    bar.append(add);
  }

  async function toggleMessageReaction(messageId, emoji, forceAdd = false) {
    const customId=customReactionId(emoji);
    if(customId){
      if(!customReactionCache.has(customId)){
        const {data:asset,error:assetError}=await client.from('custom_assets').select('id,name,asset_url,animated').eq('id',customId).eq('asset_type','emoji').maybeSingle();
        if(assetError||!asset){toast('Ese emoji personalizado no está disponible en este chat.','error');return;}
        const urls=await signedUrlLookup('nexus-assets',[asset.asset_url]);const signedUrl=urls.get(asset.asset_url);
        if(!signedUrl){toast('No se pudo cargar ese emoji personalizado.','error');return;}
        customReactionCache.set(customId,{...asset,signedUrl});
      }
    }else if(!STANDARD_EMOJIS.includes(emoji)){toast('Ese emoji no está disponible.','error');return;}
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

  function refreshSingleMessage(message){
    if(!message?.id||!currentContext)return Promise.resolve();
    const expectedContextKey=messageContextKey();
    const task=messageRenderQueue.then(()=>refreshSingleMessageNow(message,expectedContextKey));
    messageRenderQueue=task.catch(error=>{console.error('No se pudo actualizar un mensaje:',error);});
    return task;
  }
  async function refreshSingleMessageNow(message,expectedContextKey) {
    if(!message?.id||!currentContext||messageContextKey()!==expectedContextKey)return;
    cacheMessage(message);
    const container=$('#messages-container');
    const old=$(`[data-message-id="${message.id}"]`,container);
    if(!old)return;
    const nearBottom=container.scrollHeight-container.scrollTop-container.clientHeight<90;
    const scrollVersionBefore=Number(container.dataset.nexusScrollVersion)||0;
    unwrapMessageGroups(container);
    old.remove();renderedMessageIds.delete(message.id);
    const profiles=await fetchProfiles([message.sender_id]);
    await appendMessage(message,profiles[message.sender_id]);
    const nodes=[...container.querySelectorAll('.message')].sort((a,b)=>new Date(a.dataset.createdAt)-new Date(b.dataset.createdAt));
    for(const node of nodes)container.append(node);
    rebuildMessageGroups(container);
    if(nearBottom&&(Number(container.dataset.nexusScrollVersion)||0)===scrollVersionBefore)container.scrollTop=container.scrollHeight;
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
        const activeBefore=$('#messages-container');
        const wasNearBottom=activeBefore?activeBefore.scrollHeight-activeBefore.scrollTop-activeBefore.clientHeight<150:false;
        const scrollVersionBefore=Number(activeBefore?.dataset.nexusScrollVersion)||0;
        // A live insert is a one-row batch too: this keeps reaction, identity,
        // reply and media resolution on the same path as paginated history.
        await renderMessageRows([payload.new]);
        if(payload.new.sender_id===currentUser.id&&wasNearBottom){
          requestAnimationFrame(()=>{
            const active=$('#messages-container');
            if(active&&currentContext?.id===context.id&&(Number(active.dataset.nexusScrollVersion)||0)===scrollVersionBefore)active.scrollTop=active.scrollHeight;
          });
        }
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
        $(`[data-message-id="${id}"]`,$('#messages-container'))?.remove();renderedMessageIds.delete(id);rebuildMessageGroups($('#messages-container'));
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},async payload=>{
        const messageId=payload.new?.message_id||payload.old?.message_id;if(!messageId)return;
        const article=$(`[data-message-id="${messageId}"]`,$('#messages-container'));
        if(article)await refreshMessageReactions(article,messageId);
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'nexus_input_sync_states'},payload=>applyInputSyncRealtime(payload))
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
          try{await activeMessageChannel.track({user_id:currentUser.id,username:profile?.username||'usuario',nickname:profile?.nickname||profile?.username||'Usuario',avatar_url:safeHttpsUrl(profile?.avatar_url),profile_frame_url:safeHttpsUrl(profile?.profile_frame_url),profile_plate_url:safeHttpsUrl(profile?.profile_plate_url),profile_plate_opacity:profilePlateOpacity(profile?.settings),status_text:String(profile?.settings?.customStatus||'').slice(0,60),device_type:getDeviceType(),hidden_global_badge_ids:Array.isArray(profile?.settings?.hiddenGlobalBadgeIds)?profile.settings.hiddenGlobalBadgeIds:[],joined_at:new Date().toISOString()});renderContextPresence();}
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
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement?.closest('code,pre,a,button,input,textarea,select,.nexus-inputsync,.nexus-nexcss,.nexus-invite-card,.nexus-md-button,.nexus-apa-citation')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!regex.test(node.nodeValue)) { regex.lastIndex=0; continue; }
      regex.lastIndex=0;
      const fragment=document.createDocumentFragment();
      const parts=node.nodeValue.split(regex);
      for (const part of parts) {
        const item=tokenMap.get(part) || [...tokenMap.entries()].find(([token])=>token.toLowerCase()===part.toLowerCase())?.[1];
        if (!item) fragment.append(document.createTextNode(part));
        else { const span=document.createElement('button'); span.type='button'; span.className=`message-mention message-mention-${item.type}`; span.textContent=`@${item.label}`; span.title=item.type==='role'?'Mención a un rol':'Abrir perfil'; if(item.type==='user'){span.addEventListener('click',()=>openPublicProfile(item.id));}else{span.addEventListener('click',()=>toast(`Rol mencionado: ${item.label}`));} fragment.append(span); }
      }
      node.parentNode?.replaceChild(fragment,node);
    }
  }

  function applyChannelMentionMarkup(container){
    if(!container||currentContext?.type!=='channel'||!currentCommunity?.id)return;
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement?.closest('code,pre,a,button,.nexus-inputsync')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    const re=/#([\p{L}\p{N}_-]{1,70}(?:\/[\p{L}\p{N}_-]{1,70}\/?)?)/gu;
    for(const node of nodes){const value=node.nodeValue||'';const matches=[...value.matchAll(re)];if(!matches.length)continue;const frag=document.createDocumentFragment();let at=0;for(const m of matches){const token=m[1].replace(/\/$/,'');const parts=token.split('/');const channel=parts.length===2?currentCommunityChannels.find(item=>String(item.category).toLowerCase()===parts[0].toLowerCase()&&String(item.name).toLowerCase()===parts[1].toLowerCase()):currentCommunityChannels.find(item=>String(item.name).toLowerCase()===token.toLowerCase());if(!channel)continue;frag.append(document.createTextNode(value.slice(at,m.index)));const button=document.createElement('button');button.type='button';button.className='nexus-channel-mention';button.textContent=`#${parts.length===2?parts.join('/')+'/':token}`;button.addEventListener('click',()=>openCommunityChannel(channel));frag.append(button);at=m.index+m[0].length;}frag.append(document.createTextNode(value.slice(at)));node.parentNode?.replaceChild(frag,node);}
  }
  async function sendMessage(event) {
    event.preventDefault();
    if (!currentContext) return;
    if (currentContext.type === 'channel' && currentContext.channelType === 'media' && !pendingAttachments.length) { toast('Este canal solo admite archivos multimedia.','error'); return; }
    if (currentContext.type === 'channel' && currentContext.channelType === 'announcements' && !currentChannelPermission('post_announcements',communityPermissions.post_announcements)) { toast('Necesitas el permiso Publicar anuncios.','error'); return; }
    const input=$('#message-input');const body=input.value.trim();const files=[...pendingAttachments];
    if(!body&&!files.length)return;
    const context={...currentContext};const reply=replyTarget?{...replyTarget}:null;const alt=activeAltProfile?{...activeAltProfile}:null;
    input.disabled=true;const uploaded=[];
    try{
      const mentions=body?await collectMessageMentions(body):[];await loadCustomEmojiCache();const customEmojis=body?collectCustomEmojiIds(body):[];
      for(const file of files){const item=await uploadAttachmentFile(file,{context,reply,alt,deferInsert:true,silent:true});if(!item)throw new Error(`No se pudo adjuntar ${file.name}.`);uploaded.push(item);}
      const payload={sender_id:currentUser.id,body,formatting:{mentions,custom_emojis:customEmojis},...(alt?{alt_profile_id:alt.id}:{}),...(reply?{reply_to:reply.id}:{})};
      if(uploaded.length){payload.message_type='media';payload.attachment={kind:'bundle',items:uploaded.map(({file,...item})=>item),spoiler:Boolean($('#attachment-spoiler')?.checked)};}
      payload[context.type==='conversation'?'conversation_id':'channel_id']=context.id;
      const {error}=await client.from('messages').insert(payload);if(error)throw error;
      input.value='';autoResizeComposer(input);pendingAttachments=[];renderPendingAttachments();$('#attachment-spoiler').checked=false;broadcastTypingState(false);clearReplyTarget();hideEmojiSuggestions();hideMentionSuggestions();toast(uploaded.length?'Mensaje enviado con archivos.':'Mensaje enviado.','success');
    }catch(error){if(uploaded.length){await client.storage.from('chat-media').remove(uploaded.map(item=>item.path).filter(Boolean)).catch(()=>{});}showError(error,'No se pudo enviar el mensaje.');}
    finally{input.disabled=false;input.focus();}
  }

  // ---------- Stickers, custom emoji and GIPHY GIFs ----------
  async function listCustomAssets(type){
    const scopes=[{scope:'personal',id:null}];
    if(currentContext?.type==='conversation')scopes.push({scope:'conversation',id:currentContext.id});
    if(currentContext?.type==='channel'&&currentCommunity)scopes.push({scope:'community',id:currentCommunity.id});
    const rows=[];
    for(const entry of scopes){let query=client.from('custom_assets').select('id,owner_id,asset_type,scope,scope_id,name,asset_url,animated,archived_at,visibility').eq('asset_type',type).eq('scope',entry.scope).is('archived_at',null);query=entry.id?query.eq('scope_id',entry.id):query.is('scope_id',null);const {data,error}=await query.order('created_at',{ascending:false});if(error){console.warn('Assets:',error);continue;}rows.push(...(data||[]));}
    if(type==='sticker'&&currentUser){
      const {data:saves}=await client.from('sticker_workshop_saves').select('sticker_id').eq('user_id',currentUser.id);
      const ids=(saves||[]).map(row=>row.sticker_id);
      if(ids.length){const {data:published}=await client.from('sticker_workshop').select('id,asset_id,publisher_id,name').in('id',ids);const assetIds=(published||[]).map(row=>row.asset_id);if(assetIds.length){const {data:installed}=await client.from('custom_assets').select('id,owner_id,asset_type,scope,scope_id,name,asset_url,animated,archived_at,visibility').in('id',assetIds);for(const item of installed||[])if(!rows.some(row=>row.id===item.id))rows.push({...item,workshopInstalled:true});}}
    }
    const urls=await signedUrlLookup('nexus-assets',rows.map(row=>row.asset_url));
    return rows.map(row=>({...row,signedUrl:urls.get(row.asset_url)||''}));
  }
  async function loadCustomEmojiCache(force=false){
    if(!currentContext)return;
    const key=`${currentContext.type}:${currentContext.id}:${currentCommunity?.id||''}`;
    if(!force&&customEmojiCacheKey===key)return;
    customEmojiCache.clear();customReactionCache.clear();customEmojiCacheKey=key;
    const rows=await listCustomAssets('emoji');
    for(const row of rows)if(row.signedUrl){customEmojiCache.set(row.name,{...row});customReactionCache.set(row.id,{...row});}
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
    for(const asset of assets){const signedUrl=urls.get(asset.asset_url);if(signedUrl){customEmojiCache.set(asset.name,{...asset,signedUrl});customReactionCache.set(asset.id,{...asset,signedUrl});}}
  }
  function renderStandardEmojiShortcodes(container){
    if(!container)return;
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement?.closest('code,pre,a,button,input,textarea,select')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    const regex=/:([a-z0-9_+-]{1,24}):/gi;
    for(const node of nodes){
      const value=node.nodeValue||'';const matches=[...value.matchAll(regex)];if(!matches.length)continue;
      const fragment=document.createDocumentFragment();let offset=0;
      for(const match of matches){const emoji=STANDARD_EMOJI_BY_ALIAS.get(match[1].toLowerCase());if(!emoji)continue;fragment.append(document.createTextNode(value.slice(offset,match.index)));fragment.append(document.createTextNode(emoji));offset=match.index+match[0].length;}
      if(offset){fragment.append(document.createTextNode(value.slice(offset)));node.parentNode?.replaceChild(fragment,node);}
    }
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
    assetPickerMode='composer';reactionTargetMessageId=null;$$('[data-asset-tab]').forEach(tab=>tab.hidden=false);
    assetPickerType=type;assetPickerRowsType='';$('#emoji-picker-search').value='';if(type!=='standard')$('#custom-asset-type').value=type;
    const scope=$('#custom-asset-scope');scope.querySelector('[value="conversation"]').disabled=currentContext.type!=='conversation';scope.querySelector('[value="community"]').disabled=currentContext.type!=='channel'||!currentCommunity;
    scope.value='personal';$$('[data-asset-tab]').forEach(tab=>tab.classList.toggle('active',tab.dataset.assetTab===type));$('#asset-picker-dialog').showModal();loadAssetPicker();
  }
  function openReactionPicker(messageId){
    if(!currentContext||!messageId)return;
    assetPickerMode='reaction';reactionTargetMessageId=messageId;assetPickerType='standard';assetPickerRowsType='';$('#emoji-picker-search').value='';
    $('#asset-upload-form')?.classList.add('hidden');$$('[data-asset-tab]').forEach(tab=>{tab.hidden=tab.dataset.assetTab==='sticker';tab.classList.toggle('active',tab.dataset.assetTab==='standard');});
    $('#asset-picker-dialog').showModal();loadAssetPicker();
  }
  async function loadAssetPicker(){
    const host=$('#asset-picker-grid');if(!host)return;
    const search=String($('#emoji-picker-search')?.value||'').trim().toLowerCase();
    if(assetPickerType==='standard'){
      $('#asset-upload-form')?.classList.add('hidden');
      const aliasMatches=Object.entries(STANDARD_EMOJI_ALIASES).filter(([name,emoji])=>name.includes(search)||emoji.includes(search));
      const emojiMatches=search?STANDARD_EMOJIS.filter(emoji=>emoji.includes(search)):STANDARD_EMOJIS;
      const visible=[...new Set([...aliasMatches.map(([,emoji])=>emoji),...emojiMatches])];
      host.innerHTML=visible.length?`<div class="standard-emoji-grid">${visible.map(emoji=>`<button type="button" class="standard-emoji" data-standard-emoji="${emoji}" aria-label="Insertar ${emoji}" title="${(STANDARD_EMOJI_ALIASES_BY_CHARACTER.get(emoji)||[]).slice(0,3).join(', ')}">${emoji}</button>`).join('')}</div>`:'<p class="empty-state compact">No se encontraron emojis.</p>';
      $$('[data-standard-emoji]').forEach(button=>button.addEventListener('click',async()=>{if(assetPickerMode==='reaction'){const target=reactionTargetMessageId;if(!target)return;await toggleMessageReaction(target,button.dataset.standardEmoji,true);$('#asset-picker-dialog').close();return;}const input=$('#message-input');if(!input)return;input.setRangeText(button.dataset.standardEmoji,input.selectionStart,input.selectionEnd,'end');input.focus();autoResizeComposer(input);broadcastTypingState(true);}));
      return;
    }
    $('#asset-upload-form')?.classList.toggle('hidden',assetPickerMode==='reaction');
    $('#custom-asset-type').value=assetPickerType;
    if(assetPickerRowsType!==assetPickerType){host.innerHTML='<p class="empty-state compact">Cargando recursos…</p>';assetPickerRows=await listCustomAssets(assetPickerType);assetPickerRowsType=assetPickerType;}
    const rows=assetPickerRows.filter(row=>!search||row.name.toLowerCase().includes(search));
    if(assetPickerType==='emoji')for(const row of assetPickerRows)if(row.signedUrl)customReactionCache.set(row.id,{...row});
    host.innerHTML=rows.length?rows.map(row=>`<article class="custom-asset-card"><img src="${escapeHtml(row.signedUrl)}" alt="${escapeHtml(row.name)}" loading="lazy"><strong>${escapeHtml(row.name)}</strong><small>${row.scope==='personal'?'Personal':row.scope==='conversation'?'Conversación':'Megagrupo'}${row.animated?' · GIF':''}</small><div><button type="button" class="button button-primary" data-use-custom-asset="${row.id}">${assetPickerType==='emoji'?'Insertar':'Enviar'}</button>${row.owner_id===currentUser.id?`<button type="button" class="button button-secondary" data-archive-custom-asset="${row.id}">Archivar</button>`:''}</div></article>`).join(''):`<p class="empty-state compact">${assetPickerRows.length?'No hay coincidencias.':'No hay recursos en este ámbito. Sube el primero.'}</p>`;
    $$('[data-use-custom-asset]').forEach(button=>button.addEventListener('click',async()=>{const item=rows.find(row=>row.id===button.dataset.useCustomAsset);if(!item)return;if(assetPickerMode==='reaction'&&assetPickerType==='emoji'){const target=reactionTargetMessageId;if(target){customReactionCache.set(item.id,{...item});await toggleMessageReaction(target,`custom:${item.id}`,true);$('#asset-picker-dialog').close();}return;}if(assetPickerType==='emoji'){const input=$('#message-input');const token=`:${item.name}: `;const start=input.selectionStart,end=input.selectionEnd;input.setRangeText(token,start,end,'end');input.focus();loadCustomEmojiCache(true);}else sendStickerMessage(item);}));
    $$('[data-archive-custom-asset]').forEach(button=>button.addEventListener('click',()=>archiveCustomAsset(button.dataset.archiveCustomAsset)));
  }
  function closeAssetPicker(){assetPickerMode='composer';reactionTargetMessageId=null;$$('[data-asset-tab]').forEach(tab=>tab.hidden=false);$('#asset-picker-dialog').close();}
  $('#close-asset-picker').addEventListener('click',closeAssetPicker);
  $('#emoji-picker-search')?.addEventListener('input',()=>loadAssetPicker());
  $('#asset-picker-dialog').addEventListener('close',()=>{assetPickerMode='composer';reactionTargetMessageId=null;$$('[data-asset-tab]').forEach(tab=>tab.hidden=false);});
  $$('[data-asset-tab]').forEach(button=>button.addEventListener('click',()=>{if(assetPickerMode==='reaction'&&button.dataset.assetTab==='sticker')return;assetPickerType=button.dataset.assetTab;if(assetPickerType!=='standard')$('#custom-asset-type').value=assetPickerType;$$('[data-asset-tab]').forEach(tab=>tab.classList.toggle('active',tab===button));loadAssetPicker();}));
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
      const visibility=scope==='personal'?($('#custom-asset-visibility')?.value||'private'):'private';
      const {error:rowError}=await client.from('custom_assets').insert({owner_id:currentUser.id,asset_type:type,scope,scope_id:scopeId,name,asset_url:path,animated:file.type==='image/gif',visibility});
      if(rowError){await client.storage.from('nexus-assets').remove([path]);throw rowError;}
      $('#custom-asset-name').value='';$('#custom-asset-file').value='';assetPickerRowsType='';await loadAssetPicker();await loadCustomEmojiCache(true);toast('Recurso subido.','success');
    }catch(error){showError(error,'No se pudo subir el recurso. Comprueba la migración v0.7 y las políticas de Storage.');}
    finally{button.disabled=false;}
  }
  async function archiveCustomAsset(id){
    const {error}=await client.from('custom_assets').update({archived_at:new Date().toISOString()}).eq('id',id).eq('owner_id',currentUser.id);
    if(error)showError(error,'No se pudo archivar el recurso.');else{assetPickerRowsType='';await loadAssetPicker();await loadCustomEmojiCache(true);toast('Recurso archivado. Los mensajes anteriores lo conservan.','success');}
  }
  async function sendStickerMessage(asset){
    if(!currentContext)return;
    if(currentContext.type==='channel'&&currentContext.channelType==='announcements'&&!currentChannelPermission('post_announcements',communityPermissions.post_announcements)){toast('Necesitas permiso para publicar aquí.','error');return;}
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

  function stagePendingAttachments(files){
    const incoming=[...(files||[])].filter(Boolean);for(const file of incoming){if(pendingAttachments.length>=10){toast('Puedes adjuntar hasta 10 archivos por mensaje.','error');break;}if(pendingAttachments.some(item=>item.name===file.name&&item.size===file.size&&item.lastModified===file.lastModified))continue;pendingAttachments.push(file);}renderPendingAttachments();
  }
  function renderPendingAttachments(){
    const host=$('#pending-attachments');if(!host)return;host.classList.toggle('hidden',!pendingAttachments.length);host.innerHTML=pendingAttachments.map((file,index)=>`<div class="pending-attachment-item"><span class="pending-attachment-icon">${/^image\//.test(file.type)?'▧':/^video\//.test(file.type)?'▶':'↧'}</span><span>${escapeHtml(file.name)}<small>${(file.size/1024/1024).toFixed(2)} MB</small></span><button type="button" data-remove-pending="${index}" aria-label="Quitar ${escapeHtml(file.name)}">×</button></div>`).join('');host.querySelectorAll('[data-remove-pending]').forEach(button=>button.addEventListener('click',()=>{pendingAttachments.splice(Number(button.dataset.removePending),1);renderPendingAttachments();}));
  }
  async function uploadAttachment(event){const files=[...(event.target.files||[])];event.target.value='';if(files.length)stagePendingAttachments(files);}

  async function handleComposerPaste(event) {
    const items=[...(event.clipboardData?.items||[])];const fromItems=items.filter(item=>item.kind==='file'&&(/^(image\/|video\/(mp4|webm)$)/i.test(item.type||''))).map(item=>item.getAsFile()).filter(Boolean);
    const fromFiles=[...(event.clipboardData?.files||[])].filter(file=>/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/i.test(file.type||''));const files=fromItems.length?fromItems:fromFiles;if(!files.length)return;event.preventDefault();stagePendingAttachments(files);
  }

  async function uploadAttachmentFile(file, options={}) {
    const sourceContext=Object.prototype.hasOwnProperty.call(options,'context')?options.context:currentContext;
    if (!file || !sourceContext || !currentUser) return;
    const context={...sourceContext};
    const replySnapshot=Object.prototype.hasOwnProperty.call(options,'reply')?options.reply:(replyTarget?{...replyTarget}:null);
    const altSnapshot=Object.prototype.hasOwnProperty.call(options,'alt')?options.alt:(activeAltProfile?{...activeAltProfile}:null);
    if (context.type === 'channel' && context.channelType === 'announcements' && !(Object.prototype.hasOwnProperty.call(options,'postAnnouncementsAllowed')?options.postAnnouncementsAllowed:currentChannelPermission('post_announcements',communityPermissions.post_announcements))) { toast('Necesitas el permiso Publicar anuncios.','error'); return; }
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
    const extensionMime={csv:'text/csv',tsv:'text/tab-separated-values',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ods:'application/vnd.oasis.opendocument.spreadsheet'};
    const normalizedMime=isZip?'application/zip':((file.type||extensionMime[extension]||'application/octet-stream').split(';')[0].trim());
    const allowed = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|audio\/(webm|ogg|mp4|mpeg|wav|x-wav)|application\/(pdf|zip|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.oasis\.opendocument\.spreadsheet)|text\/(plain|csv|tab-separated-values))$/i;
    if (normalizedMime!=='application/octet-stream'&&!allowed.test(normalizedMime)) { toast('Este tipo de archivo no está permitido.', 'error'); return; }
    if(normalizedMime==='application/octet-stream'&&!isZip){toast('No se pudo identificar el tipo de archivo.','error');return;}

    const isConversation = context.type === 'conversation';
    const folder = isConversation ? 'dm' : 'community';
    const safeExtension = (file.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi,'').slice(0,8) || 'bin';
    const path = `${folder}/${context.id}/${crypto.randomUUID()}.${safeExtension}`;
    const storage = client.storage.from('chat-media');
    if(!options.silent)toast('Subiendo archivo…');

    try {
      const {error: uploadError} = await storage.upload(path, file, {contentType:normalizedMime,upsert:false});
      if (uploadError) {
        if (/row-level security|security policy/i.test(uploadError.message || '')) {
          throw new Error('Supabase ha bloqueado la subida por sus políticas de Storage. Ejecuta el parche supabase/fix-chat-media-rls.sql en el SQL Editor y vuelve a intentarlo.');
        }
        throw uploadError;
      }
      if(options.deferInsert)return {path,name:file.name||'archivo',mimetype:normalizedMime,file};
      const caption=Object.prototype.hasOwnProperty.call(options,'caption')?String(options.caption||'').trim().slice(0,12000):String($('#message-input')?.value||'').trim().slice(0,12000);
      const payload = {
        sender_id:currentUser.id,
        body:caption || file.name || 'Archivo adjunto',
        message_type:'media',
        ...(altSnapshot ? {alt_profile_id:altSnapshot.id} : {}),
        attachment:{path,name:file.name || 'archivo',mimetype:normalizedMime,...(caption?{caption}:{})},
        ...(replySnapshot ? {reply_to:replySnapshot.id} : {})
      };
      payload[isConversation ? 'conversation_id' : 'channel_id'] = context.id;
      const {error: messageError} = await client.from('messages').insert(payload);
      if (messageError) {
        await storage.remove([path]);
        throw new Error(`El archivo se subió, pero no se pudo publicar el mensaje: ${messageError.message}`);
      }
      if(currentContext?.id===context.id&&replyTarget?.id===replySnapshot?.id)clearReplyTarget();
      if(!options.keepComposerCaption&&currentContext?.id===context.id&&$('#message-input')?.value.trim()===caption){$('#message-input').value='';autoResizeComposer($('#message-input'));}
      toast('Archivo enviado.', 'success');
    } catch (error) {
      showError(error, 'No se pudo subir el archivo.');
      return null;
    }
  }

  async function createPoll() {
    if (!currentContext) return;
    if (currentContext.type === 'channel' && currentContext.channelType === 'media') { toast('Los canales multimedia solo admiten archivos.','error'); return; }
    if (currentContext.type === 'channel' && currentContext.channelType === 'voice') { toast('Los canales de voz no admiten encuestas.','error'); return; }
    if (currentContext.type === 'channel' && currentContext.channelType === 'announcements' && !currentChannelPermission('post_announcements',communityPermissions.post_announcements)) { toast('Necesitas el permiso Publicar anuncios.','error'); return; }
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
    const globalBadgesByUser=await fetchGlobalBadgesByUser(otherIds);
    for(const id of otherIds){if(profiles[id])profiles[id].globalBadges=globalBadgesByUser.get(id)||[];}
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
    const visibleBadges=(person.globalBadges||[]).filter(badge=>!(person.settings?.hiddenGlobalBadgeIds||[]).includes(badge.id));
    const badgeHtml=visibleBadges.length?`<span class="person-row-badges">${visibleBadges.map(badge=>/^https:\/\//i.test(badge.icon_url||'')?`<img src="${escapeHtml(badge.icon_url)}" alt="${escapeHtml(badge.name)}" title="${escapeHtml(badge.name)}" loading="lazy">`:`<span title="${escapeHtml(badge.name)}">${escapeHtml(badge.icon_url||'★')}</span>`).join('')}</span>`:'';
    const deviceLabel=online?(onlineDeviceTypes.get(person.id)==='mobile'?'▣ Móvil':'▭ Ordenador'):'';
    return `<div class="person-row ${online?'is-online':''}" data-person-id="${escapeHtml(person.id)}" ${plateStyle}>${avatarMarkup(person)}<div class="person-row-copy"><strong>${escapeHtml(person.nickname || person.username)}</strong>${badgeHtml}<small>@${escapeHtml(person.username)}</small><small class="person-presence">${online?`En línea · ${deviceLabel}`:'Desconectado'}</small></div><div class="person-actions">${actions}</div></div>`;
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
    const conversation = pane.querySelector('.active-conversation');
    const background = currentContext?.type === 'channel' && currentCommunity
      ? safeHttpsUrl(currentCommunity.background_url)
      : '';

    // Alpha2 introduced an opaque background on .active-conversation. Painting
    // only the outer pane therefore left the community wallpaper hidden behind it.
    // Put the wallpaper on the actual conversation surface and make that surface
    // transparent only for community channels; DMs keep the regular theme.
    pane.style.backgroundImage = '';
    if (conversation && background) {
      const safe = background.replace(/["\\]/g, '');
      conversation.style.backgroundImage = `linear-gradient(rgba(12,16,25,.58),rgba(12,16,25,.68)),url("${safe}")`;
      conversation.style.backgroundSize = 'cover';
      conversation.style.backgroundPosition = 'center';
      conversation.style.backgroundRepeat = 'no-repeat';
      conversation.style.backgroundAttachment = 'scroll';
      conversation.style.backgroundColor = 'transparent';
      pane.classList.add('community-wallpaper-active');
    } else {
      if (conversation) {
        conversation.style.backgroundImage = '';
        conversation.style.backgroundSize = '';
        conversation.style.backgroundPosition = '';
        conversation.style.backgroundRepeat = '';
        conversation.style.backgroundAttachment = '';
        conversation.style.backgroundColor = '';
      }
      pane.classList.remove('community-wallpaper-active');
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
    await loadForumUi();
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
    const globalBadgesByUser=await fetchGlobalBadgesByUser(ids);
    for(const id of ids){if(profiles[id])profiles[id].globalBadges=globalBadgesByUser.get(id)||[];}
    const memberList = $('#community-members-list');
    memberList.innerHTML = communityMembers.length ? communityMembers.map(member => {
      const person = profiles[member.user_id] || {username:'usuario',nickname:''};
      const active = new Set(communityMemberRoles.filter(item => item.user_id === member.user_id).map(item => item.role_id));
      const toggles = communityRoles.map(role => `<label class="member-role-toggle"><input type="checkbox" data-member-role="${role.id}" data-member-id="${member.user_id}" ${active.has(role.id) ? 'checked' : ''}><span style="color:${escapeHtml(role.color || '#a99bff')}">${escapeHtml(role.name)}</span></label>`).join('');
      const plate=safeHttpsUrl(person.profile_plate_url);
      const plateStyle=plate?`style="--profile-plate-image:url('${escapeHtml(plate)}');--profile-plate-opacity:${profilePlateOpacity(person.settings)}"`:'';
      return `<div class="member-role-card" ${plateStyle}><div class="member-role-person">${avatarMarkup(person)}<span><strong>${escapeHtml(member.nickname || person.nickname || person.username)}</strong>${globalBadgeMarkup(person.globalBadges,person.settings?.hiddenGlobalBadgeIds)}<small>@${escapeHtml(person.username || 'usuario')}${member.user_id === currentCommunity.owner_id ? ' · propietario' : ''}</small></span></div><div class="member-role-toggles">${toggles || '<span class="muted">Crea un rol para poder asignarlo.</span>'}</div></div>`;
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
    $('#channel-edit-category').value = channel?.category || 'General';
    $('#channel-edit-description').value = channel?.description || '';
    $('#channel-edit-position').value = String(channel?.position ?? currentCommunityChannels.length);
    $('#channel-important-enabled').checked=Boolean(channel?.important_announcements_enabled);
    $('#channel-editor-dialog').showModal();
  }

  async function loadChannels() {
    if (!currentCommunity) return;
    const {data,error} = await client.from('channels').select('*').eq('community_id',currentCommunity.id).order('position',{ascending:true}).order('created_at',{ascending:true});
    if (error) { showError(error); return; }
    currentCommunityChannels = data || [];
    $('#community-channels-count').textContent = currentCommunityChannels.length;
    $('#add-channel').classList.toggle('hidden',!communityPermissions.manage_channels);
    const channelGroups=new Map();
    for(const channel of currentCommunityChannels){const category=String(channel.category||'General').trim()||'General';if(!channelGroups.has(category))channelGroups.set(category,[]);channelGroups.get(category).push(channel);}
    $('#channel-list').innerHTML = [...channelGroups.entries()].map(([category,channels])=>`<section class="channel-category"><button type="button" class="channel-category-heading" data-toggle-channel-category="${escapeHtml(category)}"><span>⌄</span>${escapeHtml(category)}<small>${channels.length}</small></button><div class="channel-category-items">${channels.map(channel => `<div class="channel-row"><button class="channel-item ${currentContext?.id === channel.id ? 'active' : ''}" data-channel="${channel.id}" title="${escapeHtml(channel.description || channelTypeLabel(channel.type))}"><span class="channel-hash">${channelTypeIcon(channel.type)}</span><span class="channel-item-name">${escapeHtml(channel.name)}</span><span class="channel-type-mini">${channel.type === 'text' ? '' : escapeHtml(channelTypeLabel(channel.type))}</span></button>${(communityPermissions.manage_channels||communityPermissions.manage_roles) ? `<span class="channel-admin-actions">${communityPermissions.manage_channels?`<button type="button" data-edit-channel="${channel.id}" title="Editar canal">✎</button><button type="button" data-delete-channel="${channel.id}" title="Eliminar canal">×</button>`:''}<button type="button" data-channel-access="${channel.id}" title="Channels+ · Permisos">⚿</button></span>` : ''}</div>`).join('')}</div></section>`).join('') || '<p class="muted channel-empty">Todavía no hay canales.</p>';
    renderChannelUnreadBadges();
    refreshUnreadCounts();
    $$('[data-toggle-channel-category]').forEach(button=>button.addEventListener('click',()=>{const section=button.closest('.channel-category');const collapsed=section?.classList.toggle('collapsed');button.querySelector('span').textContent=collapsed?'›':'⌄';}));
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
      if (!channel || !(await nexusConfirm('Eliminar canal',`¿Eliminar #${channel.name} y sus mensajes? Esta acción no se puede deshacer.`,'Eliminar'))) return;
      const {error:deleteError} = await client.from('channels').delete().eq('id',channel.id).eq('community_id',currentCommunity.id);
      if (deleteError) showError(deleteError,'No se pudo eliminar el canal.');
      else {
        if (currentContext?.id === channel.id) { currentContext = null; $('#conversation-panel').innerHTML = '<div class="welcome-state"><div class="welcome-orb">N</div><p class="eyebrow">BIENVENIDO A NEXUS</p><h2>Tu gente, tus espacios.</h2><p>Abre una conversación o crea una nueva para empezar.</p></div>'; }
        toast('Canal eliminado.','success');
        await loadChannels();
      }
    }));
    $$('[data-channel-access]').forEach(button=>button.addEventListener('click',()=>openChannelPermissionsDialog(button.dataset.channelAccess)));
  }

  $('#channel-editor-form').addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    if (!currentCommunity || !communityPermissions.manage_channels) return;
    const channelId = $('#channel-edit-id').value;
    const name = $('#channel-edit-name').value.trim().toLowerCase().replace(/\s+/g,'-');
    const type = $('#channel-edit-type').value;
    const description = $('#channel-edit-description').value.trim();
    const category = ($('#channel-edit-category').value.trim() || 'General').slice(0,40);
    const position = Number.parseInt($('#channel-edit-position').value,10);
    const importantEnabled=Boolean($('#channel-important-enabled').checked);
    if (name.length < 1 || name.length > 70) { toast('El nombre debe tener entre 1 y 70 caracteres.','error'); return; }
    if (!['text','announcements','voice','media'].includes(type)) { toast('Tipo de canal no válido.','error'); return; }
    if (!Number.isInteger(position) || position < 0 || position > 500) { toast('La posición debe estar entre 0 y 500.','error'); return; }
    const payload = {community_id:currentCommunity.id,name,type,description,position,category,important_announcements_enabled:importantEnabled};
    const response = channelId
      ? await client.from('channels').update({name,type,description,position,category,important_announcements_enabled:importantEnabled}).eq('id',channelId).eq('community_id',currentCommunity.id)
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
    const screen=$('#voice-session-dock-share');if(screen){screen.disabled=!session.localJoined;screen.textContent=session.screenStream?'Dejar de compartir':'Compartir pantalla';}
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
    const join=$('#join-voice-room'),mute=$('#voice-mute'),share=$('#voice-screen-share'),leave=$('#leave-voice-room');if(join)join.disabled=Boolean(voiceSession.localJoined);if(mute)mute.disabled=!voiceSession.localJoined;if(share){const supported=Boolean(navigator.mediaDevices?.getDisplayMedia);share.disabled=!voiceSession.localJoined||!supported;share.title=supported?'Compartir la pantalla con la sala':'Este navegador o dispositivo no permite compartir pantalla';share.textContent=voiceSession.screenStream?'Dejar de compartir':'Compartir pantalla';}if(leave)leave.disabled=!voiceSession.localJoined;
    if(mute)mute.textContent=voiceSession.muted?'Activar micrófono':'Silenciar';
    renderVoiceDock();
  }
  function getVoicePeer(peerId){
    if(voiceSession.peers.has(peerId))return voiceSession.peers.get(peerId);
    if(voiceSession.peers.size>=5){voiceStatus('Sala llena: el modo P2P admite hasta 6 personas por navegador.');return null;}
    const pc=new RTCPeerConnection({iceServers:Array.isArray(cfg.VOICE_ICE_SERVERS)?cfg.VOICE_ICE_SERVERS:[{urls:'stun:stun.l.google.com:19302'}]});
    const peer={pc,candidates:[],audio:null,video:null,videoSender:null};voiceSession.peers.set(peerId,peer);
    voiceSession.stream.getAudioTracks().forEach(track=>pc.addTrack(track,voiceSession.stream));
    try{peer.videoSender=pc.addTransceiver('video',{direction:'sendrecv'}).sender;if(voiceSession.screenStream?.getVideoTracks()?.[0])peer.videoSender.replaceTrack(voiceSession.screenStream.getVideoTracks()[0]);}catch(error){console.warn('No se pudo preparar el canal de vídeo:',error);}
    pc.onicecandidate=event=>{if(event.candidate)sendVoiceSignal(peerId,{candidate:event.candidate.toJSON()});};
    pc.ontrack=event=>{const stream=event.streams?.[0]||new MediaStream([event.track]);if(event.track.kind==='video'){let video=peer.video;if(!video){video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.controls=true;video.hidden=true;video.className='voice-screen-tile';video.dataset.voicePeer=peerId;($('#global-voice-video-host'))?.append(video);peer.video=video;}event.track.onunmute=()=>{video.hidden=false;video.play().catch(()=>{});};event.track.onmute=()=>{video.hidden=true;};video.srcObject=stream;if(!event.track.muted){video.hidden=false;video.play().catch(()=>{});}return;}let audio=peer.audio;if(!audio){audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;audio.dataset.voicePeer=peerId;($('#global-voice-audio-host')||$('#voice-audio-host'))?.append(audio);peer.audio=audio;}audio.srcObject=stream;audio.play().catch(()=>voiceStatus('Toca la página para permitir la reproducción de audio.'));};
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
  async function toggleVoiceScreenShare(){
    if(!voiceSession?.localJoined)return;
    if(voiceSession.screenStream){await stopVoiceScreenShare();return;}
    if(!navigator.mediaDevices?.getDisplayMedia){toast('Este navegador o dispositivo no admite compartir pantalla.','error');return;}
    try{const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:15,max:30}},audio:false});const track=stream.getVideoTracks()[0];if(!track)throw new Error('No se obtuvo una pista de pantalla.');voiceSession.screenStream=stream;for(const peer of voiceSession.peers.values()){if(peer.videoSender)await peer.videoSender.replaceTrack(track);}track.onended=()=>stopVoiceScreenShare();const preview=document.createElement('video');preview.id='local-voice-screen-preview';preview.className='voice-screen-tile local';preview.autoplay=true;preview.muted=true;preview.playsInline=true;preview.srcObject=stream;$('#global-voice-video-host')?.append(preview);const button=$('#voice-screen-share');if(button)button.textContent='Dejar de compartir';renderVoiceDock();}
    catch(error){if(error.name!=='NotAllowedError')showError(error,'No se pudo compartir la pantalla.');}
  }
  async function stopVoiceScreenShare(){const session=voiceSession;if(!session?.screenStream)return;const stream=session.screenStream;session.screenStream=null;stream.getTracks().forEach(track=>track.stop());for(const peer of session.peers.values()){if(peer.videoSender)try{await peer.videoSender.replaceTrack(null);}catch(error){console.warn(error);}}$('#local-voice-screen-preview')?.remove();const button=$('#voice-screen-share');if(button)button.textContent='Compartir pantalla';renderVoiceDock();}
  async function joinVoiceRoom(){
    if(voiceSession?.localJoined||!currentContext||currentContext.type!=='channel'||currentContext.channelType!=='voice')return;
    const button=$('#join-voice-room');if(button)button.disabled=true;voiceStatus('Solicitando acceso al micrófono…');
    try{
      if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw new Error('Este navegador no admite WebRTC o no está usando HTTPS.');
      const voiceProcessing=profile?.settings?.voiceNoiseCancellation!==false;
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:voiceProcessing,noiseSuppression:voiceProcessing,autoGainControl:voiceProcessing},video:false});
      const channelId=currentContext.id;const topic=`nexus-voice:${channelId}`;
      const realtime=client.channel(topic,{config:{private:true,presence:{key:currentUser.id},broadcast:{ack:true,self:false}}});
      voiceSession={channelId,channelName:String(currentContext.title||'Canal de voz').replace(/^◖\s*/,''),channel:realtime,stream,peers:new Map(),localJoined:false,muted:false,voiceProcessing};
      renderVoiceDock();
      realtime.on('broadcast',{event:'signal'},handleVoiceSignal);
      realtime.on('presence',{event:'sync'},syncVoicePeers);
      realtime.on('presence',{event:'join'},syncVoicePeers);
      realtime.on('presence',{event:'leave'},event=>{const key=event?.key||event?.leftPresences?.[0]?.user_id;if(key&&voiceSession?.peers.has(key)){const peer=voiceSession.peers.get(key);peer.pc.close();peer.audio?.remove();peer.video?.remove();voiceSession.peers.delete(key);}renderVoiceParticipants();renderContextPresence();});
      realtime.subscribe(async status=>{
        if(status==='SUBSCRIBED'){
          try{await realtime.track({user_id:currentUser.id,username:profile?.username||'usuario',nickname:profile?.nickname||profile?.username||'Usuario',avatar_url:safeHttpsUrl(profile?.avatar_url),profile_frame_url:safeHttpsUrl(profile?.profile_frame_url),profile_plate_url:safeHttpsUrl(profile?.profile_plate_url),profile_plate_opacity:profilePlateOpacity(profile?.settings),status_text:String(profile?.settings?.customStatus||'').slice(0,60),device_type:getDeviceType(),hidden_global_badge_ids:Array.isArray(profile?.settings?.hiddenGlobalBadgeIds)?profile.settings.hiddenGlobalBadgeIds:[],joined_at:new Date().toISOString()});voiceSession.localJoined=true;voiceStatus('Conectado · micrófono activo');renderVoiceParticipants();renderVoiceDock();renderContextPresence();await syncVoicePeers();}
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
    session.screenStream?.getTracks().forEach(track=>track.stop());$('#local-voice-screen-preview')?.remove();for(const peer of session.peers.values()){peer.pc.close();peer.audio?.remove();peer.video?.remove();}
    if(session.channel)await client.removeChannel(session.channel);
    renderContextPresence();
    if(options.refresh!==false&&currentContext?.type==='channel'&&currentContext.channelType==='voice')await showMessagePanel();
  }

  async function getChannelPermissionState(channelId){
    const names=['view_channel','send_messages','attach_files','add_reactions','manage_messages','post_announcements'];
    const values=await Promise.all(names.map(async name=>{
      const {data,error}=await client.rpc('can_access_community_channel',{p_channel_id:channelId,p_permission:name});
      if(error){console.debug(`Channels+ ${name}:`,error.message);return [name,null];}
      return [name,Boolean(data)];
    }));
    return Object.fromEntries(values);
  }
  function currentChannelPermission(name,fallback=false){
    const value=currentContext?.channelPermissions?.[name];
    return value===null||value===undefined?Boolean(fallback):Boolean(value);
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
      currentContext = {type:'channel',id:channel.id,title:`◖ ${channel.name}`,subtitle:`${currentCommunity.name} · ${channelTypeLabel(channel.type)}`,channelType:channel.type,channelDescription:channel.description || '',importantAnnouncementsEnabled:Boolean(channel.important_announcements_enabled),channelPermissions:await getChannelPermissionState(channel.id)};
      renderVoiceDock();
      switchView('chats'); $('#app-screen').classList.toggle('community-focus',Boolean(profile?.settings?.compactPanels)); $('#app-screen').classList.add('mobile-chat-open');
      await showMessagePanel();
      $$('.channel-item').forEach(button => button.classList.toggle('active',button.dataset.channel === channel.id));
      return;
    }
    currentContext = {type:'channel',id:channel.id,title:`${channelTypeIcon(channel.type)} ${channel.name}`,subtitle:currentCommunity.name,channelType:channel.type,channelDescription:channel.description || '',importantAnnouncementsEnabled:Boolean(channel.important_announcements_enabled),channelPermissions:await getChannelPermissionState(channel.id)};
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
    const widgets = profileWidgetsForMode().slice(0,32);
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
        try { await saveProfileWidgetsForMode(next); renderProfileWidgets(); toast('Widget eliminado.','success'); }
        catch(error) { showError(error,'No se pudo eliminar el widget.'); }
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
    const heading=$('#profile-widgets-section h3');if(heading)heading.textContent=activeProfileMode==='community'?'Widgets del megagrupo':'Widgets del perfil';
  }

  $('#profile-widget-form').addEventListener('submit', async event => {
    event.preventDefault();
    const widgets = [...profileWidgetsForMode()];
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
    try { await saveProfileWidgetsForMode(widgets); } catch(error) { showError(error,'No se pudo guardar el widget.'); return; }
    $('#profile-widget-form').reset(); $('#widget-banner').value='#34304f'; $('#widget-url-field')?.classList.add('hidden'); $('#widget-banner-field')?.classList.remove('hidden'); renderProfileWidgets();
    toast(activeProfileMode==='community'?'Widget añadido al perfil del megagrupo.':'Widget añadido a tu perfil.','success');
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
    const isFont = kind === 'name_font_url' || kind === 'message_font_url';
    const inputSelectorByKind = {
      name_font_url: '#profile-font-file',
      message_font_url: '#setting-message-font-file',
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
  $('#setting-message-font-file')?.addEventListener('change',event=>uploadProfileAsset(event.target.files?.[0],'message_font_url'));

  function renderIdentityAssetLinks() {
    const host=$('#identity-current-assets'); if(!host || !profile) return;
    const labels={name_effect_url:'Efecto del nombre',profile_effect_url:'Efecto del avatar',profile_plate_url:'Efecto de placa',profile_frame_url:'Marco del avatar',name_font_url:'Fuente del nombre',message_font_url:'Fuente de mensajes'};
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
    $('#setting-theme-bg').value=settings.themeBg||'#10131c';$('#setting-theme-panel').value=settings.themePanel||'#151a26';$('#setting-theme-surface').value=settings.themeSurface||'#20283a';$('#setting-theme-text').value=settings.themeText||'#edf0ff';$('#setting-theme-muted').value=settings.themeMuted||'#919bb4';$('#setting-theme-border').value=settings.themeBorder||'#8792aa';$('#setting-message-group-bg').value=settings.messageGroupBg||'#191f2d';
    $('#setting-notify-sound').checked = settings.notifySound !== false;
    $('#setting-notify-while-open').checked = settings.notifyWhileOpen !== false;
    $('#setting-notify-direct').checked=settings.notifyDirect!==false;$('#setting-notify-group').checked=settings.notifyGroup!==false;$('#setting-notify-community').checked=settings.notifyCommunity!==false;$('#setting-community-mentions-only').checked=Boolean(settings.communityMentionsOnly);
    $('#setting-message-page-size').value=String(messagePageSize());$('#setting-message-font').value=settings.messageFont||'default';
    $('#setting-boxglow-enabled').checked=Boolean(settings.boxGlowEnabled);$('#setting-boxglow-color').value=/^#[0-9a-f]{6}$/i.test(settings.boxGlowColor||'')?settings.boxGlowColor:'#8d7cff';$('#setting-boxglow-image').value=safeHttpsUrl(settings.boxGlowImage)||'';$('#setting-boxglow-intensity').value=String(Math.max(0,Math.min(100,Number(settings.boxGlowIntensity??35))));$('#setting-boxglow-intensity-label').textContent=`${$('#setting-boxglow-intensity').value}%`;
    loadLocalNotificationSound().then(file=>{const status=$('#notify-audio-status');if(status)status.textContent=file?`Sonido personalizado: ${file.name||'audio guardado'}`:'Se utiliza el sonido predeterminado.';});
    $('#setting-composer-font').value = settings.composerFont || 'default';
    $('#setting-custom-status').value = String(settings.customStatus || '').slice(0,60);
    $('#setting-compact-panels').checked=Boolean(settings.compactPanels);
    $('#setting-megacompact').checked=Boolean(settings.megacompact);
    $('#setting-megacompact').disabled=!settings.compactPanels;
    $('#setting-compact-panels').addEventListener('change',()=>{const mega=$('#setting-megacompact');if(mega)mega.disabled=!$('#setting-compact-panels').checked;},{once:true});
    $('#setting-voice-compact').checked=Boolean(settings.voiceCompactMode);
    $('#setting-voice-noise-cancellation').checked=settings.voiceNoiseCancellation!==false;
    $('#setting-group-messages').checked=settings.groupMessages!==false;$('#setting-disable-message-group-width-fix').checked=Boolean(settings.disableMessageGroupWidthFix);$('#setting-disable-markdown-delay').checked=Boolean(settings.disableMarkdownDelay);
    applyClientPreferences();
    loadMyGlobalBadgeVisibility();
  }
  $('#setting-boxglow-intensity')?.addEventListener('input',event=>{const label=$('#setting-boxglow-intensity-label');if(label)label.textContent=`${event.target.value}%`;});
  function applyClientTheme(settings=profile?.settings||{}){
    const root=document.documentElement.style;
    const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback;
    const bg=color(settings.themeBg,'#10131c');const panel=color(settings.themePanel,'#151a26');const surface=color(settings.themeSurface,'#20283a');
    const textColor=color(settings.themeText,'#edf0ff');const muted=color(settings.themeMuted,'#919bb4');const border=color(settings.themeBorder,'#8792aa');
    root.setProperty('--bg',bg);root.setProperty('--bg2',panel);root.setProperty('--panel',panel);root.setProperty('--panel2',surface);root.setProperty('--panel3',color(settings.themeRaised,'#252f43'));
    root.setProperty('--text',textColor);root.setProperty('--muted',muted);root.setProperty('--muted2',`color-mix(in srgb, ${muted} 72%, ${bg})`);
    root.setProperty('--theme-border',border);root.setProperty('--line',`color-mix(in srgb, ${border} 22%, transparent)`);
    const accent=color(settings.accent,'#8d7cff');root.setProperty('--accent',accent);root.setProperty('--accent2',`color-mix(in srgb, ${accent} 58%, white)`);root.setProperty('--message-group-bg',color(settings.messageGroupBg,'#191f2d'));
    root.setProperty('--message-group-border',`color-mix(in srgb, ${border} 45%, transparent)`);
    document.body.style.backgroundColor=bg;
  }
  function applyClientPreferences(){
    const settings=profile?.settings||{};
    applyClientTheme(settings);
    rebuildMessageGroups($('#messages-container'));
    $('#app-screen')?.classList.toggle('compact-panels',Boolean(settings.compactPanels));
    $('#app-screen')?.classList.toggle('megacompact-mode',Boolean(settings.compactPanels&&settings.megacompact));
    $('#megacompact-view-switcher')?.classList.toggle('hidden',!(settings.compactPanels&&settings.megacompact));
    $('#app-screen')?.classList.toggle('community-focus',Boolean(settings.compactPanels&&currentCommunity&&(currentView==='community'||(currentView==='chats'&&currentContext?.type==='channel'))));
    document.documentElement.classList.toggle('nexus-hover-plus',settings.hoverPlus!==false);
    if(settings.imageCulling===false)loadAllDeferredMessageImages();
  }
  $('#widget-type')?.addEventListener('change',()=>{const link=$('#widget-type').value==='link';$('#widget-url-field')?.classList.toggle('hidden',!link);$('#widget-banner-field')?.classList.toggle('hidden',link);$('#widget-icon')?.closest('.field')?.classList.toggle('hidden',link);});
  $('#settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    const previousMessagePageSize=messagePageSize();
    const settings = {...(profile?.settings||{}),accent:$('#setting-accent').value,density:$('#setting-density').value,background:$('#setting-background').value.trim(),themeBg:$('#setting-theme-bg').value,themePanel:$('#setting-theme-panel').value,themeSurface:$('#setting-theme-surface').value,themeText:$('#setting-theme-text').value,themeMuted:$('#setting-theme-muted').value,themeBorder:$('#setting-theme-border').value,messageGroupBg:$('#setting-message-group-bg').value,groupMessages:$('#setting-group-messages').checked,disableMessageGroupWidthFix:$('#setting-disable-message-group-width-fix').checked,disableMarkdownDelay:$('#setting-disable-markdown-delay').checked,imageCulling:$('#setting-image-culling').checked,nativePopups:$('#setting-native-popups').checked,hoverPlus:$('#setting-hover-plus').checked,notifySound:$('#setting-notify-sound').checked,notifyWhileOpen:$('#setting-notify-while-open').checked,composerFont:$('#setting-composer-font').value,customStatus:$('#setting-custom-status').value.trim().slice(0,60),compactPanels:$('#setting-compact-panels').checked,megacompact:$('#setting-compact-panels').checked&&$('#setting-megacompact').checked,voiceCompactMode:$('#setting-voice-compact').checked,voiceNoiseCancellation:$('#setting-voice-noise-cancellation').checked,notifyDirect:$('#setting-notify-direct').checked,notifyGroup:$('#setting-notify-group').checked,notifyCommunity:$('#setting-notify-community').checked,communityMentionsOnly:$('#setting-community-mentions-only').checked,messagePageSize:Number($('#setting-message-page-size').value)||50,messageFont:$('#setting-message-font').value,boxGlowEnabled:$('#setting-boxglow-enabled').checked,boxGlowColor:$('#setting-boxglow-color').value,boxGlowImage:safeHttpsUrl($('#setting-boxglow-image').value)||'',boxGlowIntensity:Number($('#setting-boxglow-intensity').value)||0};
    const {error} = await client.from('profiles').update({settings}).eq('id',currentUser.id);
    if (error) showError(error); else { profile.settings = settings; renderIdentity(); applyClientPreferences(); applyComposerFont($('#message-input')); if(voiceSession)renderVoiceParticipants(); if(activeMessageChannel)activeMessageChannel.track({user_id:currentUser.id,username:profile.username||'usuario',nickname:profile.nickname||profile.username||'Usuario',avatar_url:safeHttpsUrl(profile.avatar_url),profile_frame_url:safeHttpsUrl(profile.profile_frame_url),profile_plate_url:safeHttpsUrl(profile.profile_plate_url),profile_plate_opacity:profilePlateOpacity(settings),status_text:settings.customStatus,device_type:getDeviceType(),hidden_global_badge_ids:Array.isArray(profile?.settings?.hiddenGlobalBadgeIds)?profile.settings.hiddenGlobalBadgeIds:[],joined_at:new Date().toISOString()}).then(renderContextPresence).catch(()=>{}); if(globalPresenceChannel)globalPresenceChannel.track({user_id:currentUser.id,username:profile.username||'usuario',nickname:profile.nickname||profile.username||'Usuario',avatar_url:safeHttpsUrl(profile.avatar_url),profile_frame_url:safeHttpsUrl(profile.profile_frame_url),profile_plate_url:safeHttpsUrl(profile.profile_plate_url),profile_plate_opacity:profilePlateOpacity(settings),status_text:settings.customStatus,device_type:getDeviceType(),hidden_global_badge_ids:Array.isArray(profile?.settings?.hiddenGlobalBadgeIds)?profile.settings.hiddenGlobalBadgeIds:[],joined_at:new Date().toISOString()}).then(syncGlobalPresence).catch(()=>{}); if(currentContext){if(previousMessagePageSize!==messagePageSize())messageCache.delete(messageContextKey());await loadMessages();}toast('Apariencia guardada.','success'); }
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


  // ---------- Per-megagroup profile mode ----------
  function profileWidgetsForMode(){return activeProfileMode==='community'?communityProfileWidgets:(Array.isArray(profile?.widgets)?profile.widgets:[]);}
  async function saveProfileWidgetsForMode(next){
    if(activeProfileMode==='community'){
      const communityId=$('#community-profile-community')?.value;if(!communityId)throw new Error('Selecciona un megagrupo.');
      const {error}=await client.from('community_profiles').upsert({community_id:communityId,user_id:currentUser.id,widgets:next},{onConflict:'community_id,user_id'});if(error)throw error;communityProfileWidgets=next;
    }else{const {error}=await client.from('profiles').update({widgets:next}).eq('id',currentUser.id);if(error)throw error;profile.widgets=next;}
  }
  function switchProfileMode(mode){
    activeProfileMode=mode==='community'?'community':'main';
    $$('[data-profile-mode]').forEach(button=>{const active=button.dataset.profileMode===activeProfileMode;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
    const root=$('#view-profile .content-page');
    if(root)for(const child of root.children){const keep=child.classList.contains('page-heading')||child.classList.contains('profile-mode-tabs')||child.id==='profile-form'||child.id==='community-profile-editor'||child.id==='profile-widgets-section';child.classList.toggle('hidden',activeProfileMode==='community'&&!keep);}
    $('#profile-form')?.classList.toggle('hidden',activeProfileMode!=='main');
    $('#community-profile-editor')?.classList.toggle('hidden',activeProfileMode!=='community');
    if(activeProfileMode==='community')loadCommunityProfileEditor();
    renderProfileWidgets();
  }
  $$('[data-profile-mode]').forEach(button=>button.addEventListener('click',()=>switchProfileMode(button.dataset.profileMode)));
  async function loadCommunityProfileEditor(){
    const select=$('#community-profile-community');if(!select||!currentUser)return;
    const {data:members,error}=await client.from('community_members').select('community_id').eq('user_id',currentUser.id);
    if(error){select.innerHTML='<option value="">No se pudieron cargar los megagrupos</option>';console.warn(error);return;}
    const ids=[...new Set((members||[]).map(row=>row.community_id))];
    if(!ids.length){select.innerHTML='<option value="">No perteneces a ningún megagrupo</option>';$('#community-profile-form')?.classList.add('hidden');return;}
    const {data:communities,error:communityError}=await client.from('communities').select('id,name').in('id',ids).order('name');
    if(communityError){showError(communityError);return;}
    select.innerHTML=(communities||[]).map(row=>`<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('');
    select.value=currentCommunity?.id&&ids.includes(currentCommunity.id)?currentCommunity.id:(select.options[0]?.value||'');
    select.onchange=loadCommunityProfileRow;
    await loadCommunityProfileRow();
  }
  async function loadCommunityProfileRow(){
    const communityId=$('#community-profile-community')?.value;if(!communityId)return;
    const {data,error}=await client.from('community_profiles').select('*').eq('community_id',communityId).eq('user_id',currentUser.id).maybeSingle();
    if(error){showError(error,'No se pudo cargar el perfil del megagrupo.');return;}
    const row=data||{};activeCommunityProfile=row;communityProfileWidgets=Array.isArray(row.widgets)?row.widgets.slice(0,32):[];
    const values={nickname:row.nickname,pronouns:row.pronouns,aliases:Array.isArray(row.aliases)?row.aliases.join(', '):'',bio:row.bio,color:row.default_name_color,avatar:row.avatar_url,banner:row.banner_url,'name-font':row.name_font_url,'message-font':row.message_font_url,'name-effect':row.name_effect_url,'avatar-effect':row.profile_effect_url,plate:row.profile_plate_url,frame:row.profile_frame_url,status:row.settings?.customStatus};
    for(const [key,value] of Object.entries(values)){const el=$(`#community-profile-${key}`);if(el)el.value=value||'';}
    $('#community-profile-color').value=/^#[0-9a-f]{6}$/i.test(row.default_name_color||'')?row.default_name_color:'#a99bff';
    $('#community-profile-form')?.classList.remove('hidden');renderProfileWidgets();
  }
  $('#community-profile-form')?.addEventListener('submit',async event=>{
    event.preventDefault();const communityId=$('#community-profile-community')?.value;if(!communityId)return;
    const urlIds=['avatar','banner','name-font','message-font','name-effect','avatar-effect','plate','frame'];
    for(const key of urlIds){const value=$(`#community-profile-${key}`).value.trim();if(value&&!safeHttpsUrl(value)){toast('Los recursos de perfil deben utilizar URLs HTTPS válidas.','error');return;}}
    const aliases=[...new Set($('#community-profile-aliases').value.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,10);if(aliases.some(x=>x.length>24)){toast('Cada alias admite hasta 24 caracteres.','error');return;}
    const payload={community_id:communityId,user_id:currentUser.id,nickname:$('#community-profile-nickname').value.trim(),pronouns:$('#community-profile-pronouns').value.trim(),aliases,bio:$('#community-profile-bio').value.trim(),default_name_color:$('#community-profile-color').value,avatar_url:$('#community-profile-avatar').value.trim()||null,banner_url:$('#community-profile-banner').value.trim()||null,name_font_url:$('#community-profile-name-font').value.trim()||null,message_font_url:$('#community-profile-message-font').value.trim()||null,name_effect_url:$('#community-profile-name-effect').value.trim()||null,profile_effect_url:$('#community-profile-avatar-effect').value.trim()||null,profile_plate_url:$('#community-profile-plate').value.trim()||null,profile_frame_url:$('#community-profile-frame').value.trim()||null,widgets:communityProfileWidgets,settings:{customStatus:$('#community-profile-status').value.trim().slice(0,60)}};
    const {error}=await client.from('community_profiles').upsert(payload,{onConflict:'community_id,user_id'});if(error){showError(error,'No se pudo guardar el perfil. Comprueba las migraciones v0.10.');return;}
    activeCommunityProfile=payload;messageIdentityCache.clear();if(currentContext?.type==='channel'&&currentCommunity?.id===communityId)await loadMessages();toast('Perfil de megagrupo guardado.','success');
  });

  // ---------- Message forwarding ----------
  async function openForwardMessageDialog(message,sender){
    if(!message?.id||!currentUser)return;pendingForwardMessage=message;
    const select=$('#forward-message-target');if(!select)return;
    $('#forward-message-preview').textContent=`${sender?.nickname||sender?.username||'Usuario'}: ${String(message.body||message.attachment?.name||'Mensaje multimedia').slice(0,170)}`;
    select.innerHTML='<option value="">Cargando destinos…</option>';$('#forward-message-dialog').showModal();
    try{
      const [{data:members,error:memberError},{data:communityMembersRows,error:communityError}]=await Promise.all([
        client.from('conversation_members').select('conversation_id').eq('user_id',currentUser.id),
        client.from('community_members').select('community_id').eq('user_id',currentUser.id)
      ]);
      if(memberError)throw memberError;if(communityError)throw communityError;
      const conversationIds=[...new Set((members||[]).map(row=>row.conversation_id))];const communityIds=[...new Set((communityMembersRows||[]).map(row=>row.community_id))];
      const [convs,channels]=await Promise.all([
        conversationIds.length?client.from('conversations').select('id,title,kind').in('id',conversationIds):Promise.resolve({data:[],error:null}),
        communityIds.length?client.from('channels').select('id,name,community_id,category').in('community_id',communityIds).eq('type','text'):Promise.resolve({data:[],error:null})
      ]);
      if(convs.error)throw convs.error;if(channels.error)throw channels.error;
      const a=(convs.data||[]).map(row=>`<option value="conversation:${row.id}">${escapeHtml(row.title||'Conversación')}</option>`).join('');
      const b=(channels.data||[]).map(row=>`<option value="channel:${row.id}">#${escapeHtml(row.name)} · ${escapeHtml(row.category||'Megagrupo')}</option>`).join('');
      select.innerHTML=`<option value="">Selecciona un destino</option>${a?`<optgroup label="Conversaciones">${a}</optgroup>`:''}${b?`<optgroup label="Canales de texto">${b}</optgroup>`:''}`;
      if(!a&&!b)select.innerHTML='<option value="">No hay destinos disponibles</option>';
    }catch(error){select.innerHTML='<option value="">No se pudieron cargar destinos</option>';showError(error,'No se pudieron cargar las conversaciones.');}
  }
  $('#forward-message-form')?.addEventListener('submit',async event=>{
    event.preventDefault();if(!pendingForwardMessage||!currentUser)return;const [kind,id]=String($('#forward-message-target').value||'').split(':');
    if(!id||!['conversation','channel'].includes(kind)){toast('Selecciona un destino.','error');return;}
    const original=pendingForwardMessage;const payload={sender_id:currentUser.id,body:String(original.body||'').slice(0,12000),message_type:original.message_type||'text',formatting:{forwarded_from:{message_id:original.id,original_sender_id:original.sender_id}}};
    payload[kind==='conversation'?'conversation_id':'channel_id']=id;
    if(original.attachment){const attachment={...original.attachment};if(attachment.path){
      const {data:blob,error:downloadError}=await client.storage.from('chat-media').download(attachment.path);if(downloadError||!blob){showError(downloadError||new Error('No se pudo leer el archivo original.'));return;}
      if(blob.size>50*1024*1024){toast('El adjunto supera el límite de 50 MB.','error');return;}
      const ext=(String(attachment.name||'archivo').split('.').pop()||'bin').replace(/[^a-z0-9]/gi,'').slice(0,8)||'bin';const path=`${kind==='conversation'?'dm':'community'}/${id}/${crypto.randomUUID()}.${ext}`;
      const {error:uploadError}=await client.storage.from('chat-media').upload(path,blob,{contentType:attachment.mimetype||blob.type||'application/octet-stream',upsert:false});if(uploadError){showError(uploadError,'No se pudo copiar el adjunto al destino.');return;}attachment.path=path;
    }payload.attachment=attachment;}
    const button=$('#forward-message-form button[type="submit"]');button.disabled=true;
    try{const {error}=await client.from('messages').insert(payload);if(error)throw error;$('#forward-message-dialog').close();pendingForwardMessage=null;toast('Mensaje reenviado.','success');}
    catch(error){showError(error,'No se pudo reenviar el mensaje.');}finally{button.disabled=false;}
  });
  ['close-forward-message','cancel-forward-message'].forEach(id=>$('#'+id)?.addEventListener('click',()=>{$('#forward-message-dialog')?.close();pendingForwardMessage=null;}));

  // ---------- Nexus (App) inbox and user feedback ----------
  async function loadSystemInboxMessages(){
    if(!currentUser)return;try{const {data,error}=await client.from('nexus_system_messages').select('id,title,body,message_type,created_at').eq('user_id',currentUser.id).is('read_at',null).order('created_at',{ascending:true}).limit(8);if(error)throw error;
      const host=$('#nexus-system-inbox');for(const row of data||[]){const message=document.createElement('p');message.textContent=`${row.title||'Nexus (App)'}: ${row.body}`;host?.append(message);toast(message.textContent,row.message_type==='warning'?'error':'');await client.from('nexus_system_messages').update({read_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',currentUser.id);}
    }catch(error){console.debug('Buzón de Nexus no disponible:',error.message||error);}
  }
  function openPlatformFeedback(type){activeFeedbackType=type==='bug'?'bug':'suggestion';$('#platform-feedback-type').value=activeFeedbackType;$('#platform-feedback-title').textContent=activeFeedbackType==='bug'?'Reportar un error':'Enviar una sugerencia';$('#platform-feedback-subject').value='';$('#platform-feedback-body').value='';$('#platform-feedback-dialog').showModal();$('#platform-feedback-subject').focus();}
  $('#open-suggestion')?.addEventListener('click',()=>openPlatformFeedback('suggestion'));
  $('#open-bug-report')?.addEventListener('click',()=>openPlatformFeedback('bug'));
  $('#settings-open-suggestion')?.addEventListener('click',()=>openPlatformFeedback('suggestion'));
  $('#settings-open-bug-report')?.addEventListener('click',()=>openPlatformFeedback('bug'));
  ['close-platform-feedback','cancel-platform-feedback'].forEach(id=>$('#'+id)?.addEventListener('click',()=>$('#platform-feedback-dialog')?.close()));
  $('#platform-feedback-form')?.addEventListener('submit',async event=>{event.preventDefault();if(!currentUser)return;const title=$('#platform-feedback-subject').value.trim();const body=$('#platform-feedback-body').value.trim();if(title.length<3||body.length<10){toast('Añade un título y una descripción más detallada.','error');return;}const {error}=await client.from('nexus_platform_feedback').insert({user_id:currentUser.id,feedback_type:activeFeedbackType,title,body});if(error){showError(error,'No se pudo enviar el feedback.');return;}$('#platform-feedback-dialog').close();toast(activeFeedbackType==='bug'?'Error enviado al equipo.':'Sugerencia enviada al equipo.','success');});

  // ---------- Platform administration ----------
  function formatPlatformDate(value){if(!value)return 'Nunca';const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'}).format(date):'No disponible';}
  $('#platform-user-search-form')?.addEventListener('submit',event=>{event.preventDefault();loadPlatformAdminUsers();});
  async function loadPlatformAdminUsers(){
    if(!platformAdmin)return;const host=$('#platform-user-results');const term=String($('#platform-user-search')?.value||'').trim().replace(/^@/,'');if(!host)return;if(term.length<2){host.innerHTML='<p class="empty-state compact">Escribe al menos dos caracteres para buscar.</p>';return;}host.innerHTML='<p class="muted small-muted">Buscando…</p>';
    const safe=term.replace(/[^a-z0-9_\- .]/gi,' ').trim();const {data,error}=await client.from('profiles').select('id,username,nickname,avatar_url,created_at,last_seen_at').or(`username.ilike.%${safe}%,nickname.ilike.%${safe}%`).order('created_at',{ascending:false}).limit(30);
    if(error){showError(error,'No se pudieron buscar usuarios. Comprueba que las migraciones anteriores están aplicadas.');return;}
    const ids=(data||[]).map(row=>row.id);
    const [{data:mutes},{data:bans}]=await Promise.all([
      ids.length?client.from('nexus_user_mutes').select('user_id,muted_until').in('user_id',ids):Promise.resolve({data:[]}),
      ids.length?client.from('user_bans').select('user_id,banned_until').in('user_id',ids):Promise.resolve({data:[]})
    ]);
    const muted=new Map((mutes||[]).map(row=>[row.user_id,row.muted_until]));const banned=new Map((bans||[]).map(row=>[row.user_id,row.banned_until]));
    host.innerHTML=(data||[]).map(person=>{const banUntil=banned.has(person.id)?banned.get(person.id):undefined;const banActive=banned.has(person.id)&&(banUntil===null||!banUntil||new Date(banUntil)>new Date());const muteActive=muted.has(person.id)&&new Date(muted.get(person.id))>new Date();return `<article class="platform-user-card"><div class="platform-user-main"><span class="avatar avatar-small">${escapeHtml(initials(person.nickname||person.username))}</span><div><strong>${escapeHtml(person.nickname||person.username)}</strong><small>@${escapeHtml(person.username)}</small><small>Creada: ${escapeHtml(formatPlatformDate(person.created_at))}</small><small>Última vez online: ${escapeHtml(formatPlatformDate(person.last_seen_at))}</small><small>${banActive?'Baneado'+(banUntil?' hasta '+escapeHtml(formatPlatformDate(banUntil)):' permanentemente'):'Sin ban activo'}</small><small>${muteActive?'Silenciado hasta '+escapeHtml(formatPlatformDate(muted.get(person.id))):'Sin silencio activo'}</small></div></div><div class="platform-user-actions"><button type="button" class="button button-danger" data-v102-ban="${person.id}">Banear</button><button type="button" class="button button-secondary" data-v102-unban="${person.id}">Desbanear</button><button type="button" class="button button-secondary" data-v102-mute="${person.id}">Silenciar</button><button type="button" class="button button-secondary" data-v102-warn="${person.id}">Advertir</button></div></article>`;}).join('')||'<p class="empty-state compact">No se encontraron usuarios.</p>';
    host.querySelectorAll('[data-v102-ban]').forEach(button=>button.addEventListener('click',async()=>{await adminBan(button.dataset.v102Ban);loadPlatformAdminUsers();}));
    host.querySelectorAll('[data-v102-unban]').forEach(button=>button.addEventListener('click',async()=>{await adminUnban(button.dataset.v102Unban);loadPlatformAdminUsers();}));
    host.querySelectorAll('[data-v102-mute]').forEach(button=>button.addEventListener('click',()=>adminMute(button.dataset.v102Mute)));
    host.querySelectorAll('[data-v102-warn]').forEach(button=>button.addEventListener('click',()=>adminWarn(button.dataset.v102Warn)));
  }
  $$('[data-feedback-filter]').forEach(button=>button.addEventListener('click',()=>{platformFeedbackFilter=button.dataset.feedbackFilter;$$('[data-feedback-filter]').forEach(node=>node.classList.toggle('active',node===button));const status=$('#platform-feedback-status');if(status)status.value=platformFeedbackFilter==='open'?'open':'all';loadPlatformFeedback();}));
  $('#platform-feedback-filter')?.addEventListener('change',loadPlatformFeedback);$('#platform-feedback-status')?.addEventListener('change',loadPlatformFeedback);$('#platform-feedback-refresh')?.addEventListener('click',loadPlatformFeedback);
  async function loadPlatformFeedback(){
    if(!platformAdmin)return;const host=$('#platform-feedback-list');if(!host)return;host.innerHTML='<p class="muted small-muted">Cargando feedback…</p>';
    let query=client.from('nexus_platform_feedback').select('id,user_id,feedback_type,title,body,status,admin_note,created_at').order('created_at',{ascending:false}).limit(100);
    const type=$('#platform-feedback-filter')?.value||'all';const status=$('#platform-feedback-status')?.value||'open';if(type!=='all')query=query.eq('feedback_type',type);if(status!=='all')query=query.eq('status',status);
    const {data,error}=await query;if(error){showError(error,'No se pudo cargar el feedback.');return;}const people=await fetchProfiles((data||[]).map(row=>row.user_id));const {data:badges}=await client.from('global_badges').select('id,name').order('name');
    host.innerHTML=(data||[]).map(row=>`<article class="platform-feedback-card"><div class="surface-heading"><span class="tag">${row.feedback_type==='bug'?'BUG':'SUGERENCIA'}</span><small>@${escapeHtml(people[row.user_id]?.username||'usuario')} · ${escapeHtml(formatPlatformDate(row.created_at))}</small></div><h4>${escapeHtml(row.title)}</h4><p>${escapeHtml(row.body).replace(/\n/g,'<br>')}</p><label class="field">Estado<select data-v102-feedback-status="${row.id}"><option value="open" ${row.status==='open'?'selected':''}>Abierto</option><option value="reviewing" ${row.status==='reviewing'?'selected':''}>En revisión</option><option value="resolved" ${row.status==='resolved'?'selected':''}>Resuelto</option><option value="rejected" ${row.status==='rejected'?'selected':''}>Rechazado</option></select></label><label class="field">Nota interna<textarea data-v102-feedback-note="${row.id}" rows="2" maxlength="1000">${escapeHtml(row.admin_note||'')}</textarea></label><label class="field">Medalla opcional al resolver<select data-v102-feedback-badge="${row.id}"><option value="">Sin medalla</option>${(badges||[]).map(badge=>`<option value="${badge.id}">${escapeHtml(badge.name)}</option>`).join('')}</select></label><button type="button" class="button button-primary" data-v102-feedback-save="${row.id}">Guardar revisión</button></article>`).join('')||'<p class="empty-state compact">No hay mensajes con estos filtros.</p>';
    host.querySelectorAll('[data-v102-feedback-save]').forEach(button=>button.addEventListener('click',async()=>{const id=button.dataset.v102FeedbackSave;const row=(data||[]).find(item=>item.id===id);if(!row)return;const nextStatus=host.querySelector(`[data-v102-feedback-status="${id}"]`).value;const note=host.querySelector(`[data-v102-feedback-note="${id}"]`).value;const badgeId=host.querySelector(`[data-v102-feedback-badge="${id}"]`).value;const {error:updateError}=await client.from('nexus_platform_feedback').update({status:nextStatus,admin_note:note,updated_at:new Date().toISOString()}).eq('id',id);if(updateError){showError(updateError);return;}if(nextStatus==='resolved'&&badgeId){const {error:assignError}=await client.from('global_badge_assignments').insert({badge_id:badgeId,user_id:row.user_id,assigned_by:currentUser.id});if(assignError&&!/duplicate|unique/i.test(assignError.message||'')){showError(assignError,'Revisión guardada, pero falló la medalla.');return;}}toast('Revisión guardada.','success');loadPlatformFeedback();}));
  }

  // ---------- Sticker Workshop ----------
  $('#sticker-workshop-search')?.addEventListener('input',()=>loadStickerWorkshopPage());
  async function loadStickerWorkshopPage(){
    const host=$('#sticker-workshop-page-grid');if(!host||!currentUser)return;const search=String($('#sticker-workshop-search')?.value||'').trim().toLowerCase();host.innerHTML='<p class="muted small-muted">Cargando stickers…</p>';
    const {data:published,error}=await client.from('sticker_workshop').select('id,asset_id,publisher_id,name,description,created_at,installs').order('created_at',{ascending:false}).limit(120);if(error){showError(error,'No se pudo cargar Sticker Workshop. Comprueba la migración de Workshop.');return;}
    const assetIds=(published||[]).map(row=>row.asset_id);const {data:assets}=assetIds.length?await client.from('custom_assets').select('id,owner_id,name,asset_url,animated,visibility').in('id',assetIds):{data:[]};const assetMap=new Map((assets||[]).map(row=>[row.id,row]));const urls=await signedUrlLookup('nexus-assets',(assets||[]).map(row=>row.asset_url));
    const {data:saved}=await client.from('sticker_workshop_saves').select('sticker_id').eq('user_id',currentUser.id);const savedIds=new Set((saved||[]).map(row=>row.sticker_id));
    const ownQuery=await client.from('custom_assets').select('id,name,asset_url,animated,visibility').eq('owner_id',currentUser.id).eq('asset_type','sticker').eq('scope','personal').is('archived_at',null).order('created_at',{ascending:false});const own=ownQuery.data||[];const ownUrls=await signedUrlLookup('nexus-assets',own.map(row=>row.asset_url));
    const filter=row=>!search||`${row.name} ${row.description||''}`.toLowerCase().includes(search);
    const rows=(published||[]).filter(filter);const publishedHtml=rows.map(row=>{const asset=assetMap.get(row.asset_id);if(!asset)return '';const src=urls.get(asset.asset_url)||'';return `<article class="custom-asset-card workshop-sticker-card"><img src="${escapeHtml(src)}" alt="${escapeHtml(row.name)}" loading="lazy"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.description||'Sticker compartido')} · ${Number(row.installs)||0} instalaciones</small><div><button type="button" class="button button-primary" data-v102-sticker-send="${row.id}">Enviar</button>${savedIds.has(row.id)?'<button type="button" class="button button-secondary" disabled>En mi colección</button>':`<button type="button" class="button button-secondary" data-v102-sticker-save="${row.id}">Añadir a mi colección</button>`}${row.publisher_id===currentUser.id?`<button type="button" class="button button-danger" data-v102-sticker-delete="${row.id}">Retirar</button>`:''}</div></article>`;}).join('');
    const ownHtml=own.filter(filter).map(row=>`<article class="custom-asset-card workshop-sticker-card"><img src="${escapeHtml(ownUrls.get(row.asset_url)||'')}" alt="${escapeHtml(row.name)}" loading="lazy"><strong>${escapeHtml(row.name)}</strong><small>Sticker personal</small><button type="button" class="button button-secondary" data-v102-sticker-publish="${row.id}">Publicar en Workshop</button></article>`).join('');
    host.innerHTML=`<section class="workshop-asset-section"><h3>Stickers publicados</h3><div class="custom-asset-grid">${publishedHtml||'<p class="empty-state compact">No hay stickers publicados que coincidan.</p>'}</div></section><section class="workshop-asset-section"><h3>Publicar mis stickers</h3><div class="custom-asset-grid">${ownHtml||'<p class="empty-state compact">No tienes stickers personales para publicar.</p>'}</div></section>`;
    host.querySelectorAll('[data-v102-sticker-save]').forEach(button=>button.addEventListener('click',async()=>{const {error:saveError}=await client.from('sticker_workshop_saves').insert({sticker_id:button.dataset.v102StickerSave,user_id:currentUser.id});if(saveError)showError(saveError);else{toast('Sticker añadido a tu colección.','success');loadStickerWorkshopPage();}}));
    host.querySelectorAll('[data-v102-sticker-send]').forEach(button=>button.addEventListener('click',()=>{if(!currentContext){toast('Abre primero un chat para enviar un sticker.','error');return;}const row=(published||[]).find(item=>item.id===button.dataset.v102StickerSend);const asset=row&&assetMap.get(row.asset_id);if(asset)sendStickerMessage({...asset,scope:'personal'});}));
    host.querySelectorAll('[data-v102-sticker-publish]').forEach(button=>button.addEventListener('click',async()=>{const asset=own.find(item=>item.id===button.dataset.v102StickerPublish);if(!asset)return;const description=await ask('Publicar sticker','Añade una descripción breve (opcional).','Descripción','');if(description===null)return;const {error:publishError}=await client.from('sticker_workshop').insert({asset_id:asset.id,publisher_id:currentUser.id,name:asset.name,description:String(description).slice(0,300)});if(publishError)showError(publishError,'No se pudo publicar el sticker.');else{toast('Sticker publicado.','success');loadStickerWorkshopPage();}}));
    host.querySelectorAll('[data-v102-sticker-delete]').forEach(button=>button.addEventListener('click',async()=>{if(!confirm('¿Retirar este sticker del Workshop?'))return;const {error:deleteError}=await client.from('sticker_workshop').delete().eq('id',button.dataset.v102StickerDelete).eq('publisher_id',currentUser.id);if(deleteError)showError(deleteError);else loadStickerWorkshopPage();}));
  }

  // ---------- Administration ----------
  async function checkAdmin() {
    const {data,error} = await client.rpc('is_admin');
    if (error) { console.warn('Admin RPC:',error.message); return; }
    isAdmin = Boolean(data);
    const platformResult=await client.rpc('is_platform_admin');platformAdmin=Boolean(platformResult.data&&!platformResult.error);
    $('#admin-area')?.classList.add('hidden');
    $('#open-admin-panel')?.classList.toggle('hidden',!platformAdmin);
    $('#view-admin')?.classList.toggle('hidden',!platformAdmin);
    if(platformAdmin)loadPlatformBadges();
  }
  async function loadPlatformBadges(){if(!platformAdmin)return;const {data,error}=await client.from('global_badges').select('id,name,icon_url').order('created_at',{ascending:false});if(error){console.warn(error);return;}const host=$('#platform-badge-list');if(!host)return;host.innerHTML=(data||[]).map(item=>`<div class="platform-badge-row"><span>${escapeHtml(item.icon_url)} · ${escapeHtml(item.name)}</span><div class="platform-badge-actions"><input data-platform-badge-user="${item.id}" maxlength="24" placeholder="usuario" aria-label="Usuario para ${escapeHtml(item.name)}"><button type="button" class="button button-secondary" data-platform-badge-assign="${item.id}">Asignar</button><button type="button" class="button button-secondary" data-platform-badge-delete="${item.id}">Eliminar</button></div></div>`).join('')||'<p class="muted small-muted">No hay medallas universales.</p>';host.querySelectorAll('[data-platform-badge-assign]').forEach(button=>button.addEventListener('click',async()=>{if(!platformAdmin)return;const input=host.querySelector(`[data-platform-badge-user="${button.dataset.platformBadgeAssign}"]`);const username=String(input?.value||'').trim().replace(/^@/,'').toLowerCase();if(!username){toast('Escribe el usuario al que quieres asignar la medalla.','error');return;}const {data:person,error:personError}=await client.from('profiles').select('id').eq('username',username).maybeSingle();if(personError||!person){toast('No se encontró ese usuario.','error');return;}const {error:assignError}=await client.from('global_badge_assignments').insert({badge_id:button.dataset.platformBadgeAssign,user_id:person.id,assigned_by:currentUser.id});if(assignError){showError(assignError,'No se pudo asignar la medalla. Puede que el usuario ya la tenga.');return;}messageIdentityCache.clear();globalBadgeCache.delete(person.id);toast(`Medalla asignada a @${username}.`,'success');}));host.querySelectorAll('[data-platform-badge-delete]').forEach(button=>button.addEventListener('click',async()=>{const {error:removeError}=await client.from('global_badges').delete().eq('id',button.dataset.platformBadgeDelete);if(removeError)showError(removeError);else{messageIdentityCache.clear();globalBadgeCache.clear();await loadPlatformBadges();toast('Medalla global eliminada.','success');}}));}
  $('#platform-badge-create')?.addEventListener('submit',async event=>{event.preventDefault();if(!platformAdmin){toast('Solo los administradores de plataforma pueden gestionar estas medallas.','error');return;}const name=$('#platform-badge-name').value.trim();const icon=$('#platform-badge-icon').value.trim();const target=$('#platform-badge-user').value.trim().replace(/^@/,'').toLowerCase();if(name.length<2||!icon){toast('Indica nombre e icono.','error');return;}if(/^https?:/i.test(icon)&&!safeHttpsUrl(icon)){toast('El icono debe usar HTTPS.','error');return;}const {data:badge,error}=await client.from('global_badges').insert({name,icon_url:icon,created_by:currentUser.id}).select('*').single();if(error){showError(error);return;}if(target){const {data:person}=await client.from('profiles').select('id').eq('username',target).maybeSingle();if(!person){toast('Medalla creada, pero no se encontró el usuario indicado.','error');}else{const {error:assignError}=await client.from('global_badge_assignments').insert({badge_id:badge.id,user_id:person.id,assigned_by:currentUser.id});if(assignError)showError(assignError);}}$('#platform-badge-create').reset();messageIdentityCache.clear();globalBadgeCache.clear();await loadPlatformBadges();toast('Medalla global creada.','success');});
  async function loadMyGlobalBadgeVisibility(){const host=$('#global-badge-visibility');if(!host||!currentUser)return;const {data:rows,error}=await client.from('global_badge_assignments').select('badge_id,global_badges(id,name,icon_url)').eq('user_id',currentUser.id);if(error){host.innerHTML='<small class="muted">No se pudieron cargar las medallas.</small>';return;}host.innerHTML=(rows||[]).map(row=>{const badge=row.global_badges;const hidden=(profile?.settings?.hiddenGlobalBadgeIds||[]).includes(row.badge_id);return `<label class="setting-check"><input type="checkbox" data-toggle-global-badge="${row.badge_id}" ${hidden?'':'checked'}> ${escapeHtml(badge?.icon_url||'★')} ${escapeHtml(badge?.name||'Medalla')}</label>`;}).join('')||'<small class="muted">No tienes medallas globales asignadas.</small>';host.querySelectorAll('[data-toggle-global-badge]').forEach(box=>box.addEventListener('change',async()=>{const settings={...(profile?.settings||{})};const ids=new Set(settings.hiddenGlobalBadgeIds||[]);if(box.checked)ids.delete(box.dataset.toggleGlobalBadge);else ids.add(box.dataset.toggleGlobalBadge);settings.hiddenGlobalBadgeIds=[...ids];const {error:saveError}=await client.from('profiles').update({settings}).eq('id',currentUser.id);if(saveError)showError(saveError);else{profile.settings=settings;messageIdentityCache.clear();const presence={user_id:currentUser.id,username:profile?.username||'usuario',nickname:profile?.nickname||profile?.username||'Usuario',avatar_url:safeHttpsUrl(profile?.avatar_url),profile_frame_url:safeHttpsUrl(profile?.profile_frame_url),profile_plate_url:safeHttpsUrl(profile?.profile_plate_url),profile_plate_opacity:profilePlateOpacity(profile?.settings),status_text:String(profile?.settings?.customStatus||'').slice(0,60),device_type:getDeviceType(),hidden_global_badge_ids:settings.hiddenGlobalBadgeIds||[],joined_at:new Date().toISOString()};if(activeMessageChannel)activeMessageChannel.track(presence).then(renderContextPresence).catch(()=>{});if(globalPresenceChannel)globalPresenceChannel.track(presence).then(syncGlobalPresence).catch(()=>{});if(voiceSession?.localJoined)voiceSession.channel.track(presence).then(renderContextPresence).catch(()=>{});if(currentContext)await loadMessages();}}));}
  $('#admin-search-button').addEventListener('click', searchAdminUsers);
  $('#admin-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchAdminUsers();}});
  async function searchAdminUsers() {
    if (!isAdmin) return;
    const term = $('#admin-search').value.trim().replace(/^@/,'');
    if (!term) return;
    const {data,error} = await client.from('profiles').select('id,username,nickname,avatar_url,profile_plate_url,settings,created_at,last_seen_at').ilike('username',`%${term}%`).limit(20);
    if (error) { showError(error); return; }
    const badgeMap=await fetchGlobalBadgesByUser((data||[]).map(person=>person.id));
    for(const person of data||[])person.globalBadges=badgeMap.get(person.id)||[];
    $('#admin-results').innerHTML = data?.length ? data.map(person => `<article class="platform-user-card">${personRow(person, `<button class="button button-danger" data-ban="${person.id}">Banear</button><button class="button button-secondary" data-mute="${person.id}">Silenciar</button><button class="button button-secondary" data-warn="${person.id}">Advertir</button><button class="button button-secondary" data-reset="${person.id}">Reset</button><button class="button button-secondary" data-unban="${person.id}">Desbanear</button>`)}<small>Alta: ${escapeHtml(formatAdminDate(person.created_at))} · Última actividad: ${escapeHtml(formatAdminDate(person.last_seen_at))}</small></article>`).join('') : '<div class="empty-state compact">No se han encontrado usuarios.</div>';
    $$('[data-ban]').forEach(button => button.addEventListener('click',()=>adminBan(button.dataset.ban)));
    $$('[data-unban]').forEach(button => button.addEventListener('click',()=>adminUnban(button.dataset.unban)));
    $$('[data-reset]').forEach(button => button.addEventListener('click',()=>adminReset(button.dataset.reset)));
    $$('[data-mute]').forEach(button=>button.addEventListener('click',()=>adminMute(button.dataset.mute)));
    $$('[data-warn]').forEach(button=>button.addEventListener('click',()=>adminWarn(button.dataset.warn)));
  }
  function formatAdminDate(value){if(!value)return 'Nunca';const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'}).format(date):'Desconocida';}
  async function adminMute(target){const raw=await ask('Silenciar cuenta','Duración en minutos (1 a 525600).','Minutos','60');if(raw===null)return;const minutes=Number(raw);if(!Number.isInteger(minutes)||minutes<1||minutes>525600){toast('Duración no válida.','error');return;}const reason=await ask('Motivo del silencio','El usuario recibirá un MD de Nexus (App).','Motivo','Incumplimiento de las normas.');const {error}=await client.rpc('admin_mute_user',{p_target:target,p_reason:reason||'',p_minutes:minutes});if(error)showError(error,'No se pudo silenciar la cuenta.');else toast('Cuenta silenciada.','success');}
  async function adminWarn(target){const reason=await ask('Enviar advertencia','Se enviará un mensaje del sistema Nexus (App).','Motivo','Revisa las normas de la comunidad.');if(reason===null||reason.trim().length<3)return;const {error}=await client.rpc('admin_warn_user',{p_target:target,p_reason:reason});if(error)showError(error,'No se pudo enviar la advertencia.');else toast('Advertencia enviada.','success');}
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
  let lastSeenWriteAt=0;
  document.addEventListener('visibilitychange', () => {
    if(document.hidden||!currentUser)return;
    const now=Date.now();if(now-lastSeenWriteAt>60000){lastSeenWriteAt=now;client.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',currentUser.id).then(({error})=>{if(error)console.debug('Last seen:',error.message);});}
    if(!currentContext)return;
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


  // -------------------------------------------------------------------------
  // Nexus 0.11.0 alpha modules: dialogs, forum boards, Channels+, notices,
  // badge requests, reputation and first-login changelog.
  // -------------------------------------------------------------------------
  let globalAnnouncementsLoaded=false;
  function showNexusLoading(show=true){
    const screen=$('#nexus-loading-screen');if(!screen)return;
    screen.classList.toggle('hidden',!show);screen.setAttribute('aria-hidden',String(!show));
    if(show)screen.dataset.startedAt=String(Date.now());
  }
  function markWhatsNewSeen(){
    if(!currentUser)return;try{localStorage.setItem(`nexus-whats-new-v0.11.0:${currentUser.id}`,'1');}catch{}
    $('#nexus-whats-new')?.close();
  }
  function showWhatsNewOnce(){
    if(!currentUser||!globalAnnouncementsLoaded||systemPopupShowing||activeSystemPopupQueue.length)return;
    let seen=false;try{seen=localStorage.getItem(`nexus-whats-new-v0.11.0:${currentUser.id}`)==='1';}catch{seen=true;}
    if(seen)return;const dialog=$('#nexus-whats-new');if(dialog&&!dialog.open)dialog.showModal();
  }
  ['nexus-whats-new-close','nexus-whats-new-ok'].forEach(id=>$('#'+id)?.addEventListener('click',markWhatsNewSeen));

  function showNexusPopup(title,body,kind='notice'){
    const settings=profile?.settings||{};
    if(settings.nativePopups){window.alert(`${title}\n\n${body}`);return Promise.resolve();}
    const dialog=$('#nexus-system-popup');if(!dialog)return Promise.resolve(window.alert(`${title}\n\n${body}`));
    $('#nexus-system-popup-title').textContent=title||'Nexus (App)';
    const content=$('#nexus-system-popup-body');content.textContent=body||'';content.dataset.kind=kind;
    return new Promise(resolve=>{
      const closeButton=$('#nexus-system-popup-close');const okButton=$('#nexus-system-popup-ok');
      const close=()=>{if(dialog.open)dialog.close();};
      const done=()=>{closeButton?.removeEventListener('click',close);okButton?.removeEventListener('click',close);resolve();};
      closeButton?.addEventListener('click',close);okButton?.addEventListener('click',close);
      dialog.addEventListener('close',done,{once:true});dialog.showModal();
    });
  }
  function nexusConfirm(title,body,acceptLabel='Continuar'){
    if(profile?.settings?.nativePopups)return Promise.resolve(window.confirm(`${title}\n\n${body}`));
    const dialog=$('#nexus-confirm-dialog');if(!dialog)return Promise.resolve(window.confirm(`${title}\n\n${body}`));
    $('#nexus-confirm-title').textContent=title;$('#nexus-confirm-body').textContent=body;$('#nexus-confirm-accept').textContent=acceptLabel;
    return new Promise(resolve=>{
      let result=false;const acceptButton=$('#nexus-confirm-accept');const cancelButtons=['nexus-confirm-close','nexus-confirm-cancel'].map(id=>$('#'+id)).filter(Boolean);
      const accept=()=>{result=true;if(dialog.open)dialog.close();};const cancel=()=>{result=false;if(dialog.open)dialog.close();};
      const closed=()=>{acceptButton?.removeEventListener('click',accept);cancelButtons.forEach(button=>button.removeEventListener('click',cancel));dialog.removeEventListener('cancel',onCancel);resolve(result);};
      const onCancel=()=>{result=false;};
      acceptButton?.addEventListener('click',accept);cancelButtons.forEach(button=>button.addEventListener('click',cancel));
      dialog.addEventListener('cancel',onCancel);dialog.addEventListener('close',closed,{once:true});dialog.showModal();
    });
  }
  async function showSystemInboxQueue(){
    if(systemPopupShowing||!activeSystemPopupQueue.length)return;systemPopupShowing=true;
    while(activeSystemPopupQueue.length){const row=activeSystemPopupQueue.shift();await showNexusPopup(row.title||'Nexus (App)',row.body||'',row.message_type||'notice');
      if(row.id&&client&&currentUser){const {error}=await client.from('nexus_system_messages').update({read_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',currentUser.id);if(error)console.debug('No se pudo marcar el aviso como leído:',error.message);}
      if(row.announcementId&&currentUser){let seen=[];try{seen=JSON.parse(localStorage.getItem(`nexus-global-notices:${currentUser.id}`)||'[]');}catch{};if(!seen.includes(row.announcementId))seen.push(row.announcementId);try{localStorage.setItem(`nexus-global-notices:${currentUser.id}`,JSON.stringify(seen.slice(-100)));}catch{}}
    }
    systemPopupShowing=false;
    if(globalAnnouncementsLoaded)showWhatsNewOnce();
  }
  // The previous inbox rendered warnings as permanent text. Replace it with a queue of dismissible dialogs.
  loadSystemInboxMessages=async function(){
    if(!currentUser||!client)return;try{const {data,error}=await client.from('nexus_system_messages').select('id,title,body,message_type,created_at').eq('user_id',currentUser.id).is('read_at',null).order('created_at',{ascending:true}).limit(12);if(error)throw error;activeSystemPopupQueue.push(...(data||[]));showSystemInboxQueue();}catch(error){console.debug('Buzón de Nexus no disponible:',error.message||error);}
  };
  async function loadMyBadgeRequests(){
    const host=$('#my-badge-requests');if(!host||!currentUser||!client)return;
    const {data,error}=await client.from('nexus_badge_requests').select('id,proposed_name,reason,status,admin_note,created_at,updated_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(12);
    if(error){host.innerHTML='<small class="muted">No se pudieron cargar tus solicitudes. Comprueba la migración 0.11.</small>';return;}
    host.innerHTML=(data||[]).map(row=>`<article class="badge-request-row"><div><strong>${escapeHtml(row.proposed_name)}</strong><small>${escapeHtml(row.status==='submitted'?'Enviada':row.status==='reviewing'?'En revisión':row.status==='accepted'?'Aceptada':'Rechazada')} · ${escapeHtml(formatPlatformDate(row.created_at))}</small>${row.admin_note?`<p>${escapeHtml(row.admin_note)}</p>`:''}</div></article>`).join('')||'<small class="muted">Todavía no has enviado solicitudes.</small>';
  }
  async function loadMyReputationStats(){
    const host=$('#nexus-reputation');if(!host||!currentUser||!client)return;
    const {data,error}=await client.from('nexus_moderation_history').select('action_type,duration_seconds,created_at').eq('user_id',currentUser.id);
    if(error){host.innerHTML='<small class="muted">Las estadísticas de reputación estarán disponibles cuando se aplique la migración 0.11.</small>';return;}
    const rows=data||[];const warnings=rows.filter(row=>row.action_type==='warning').length;
    const elapsedDuration=row=>{const assigned=Number(row.duration_seconds||0);if(assigned<=0)return 0;const started=Date.parse(row.created_at||'');const elapsed=Number.isFinite(started)?Math.max(0,(Date.now()-started)/1000):assigned;return Math.min(assigned,elapsed);};
    const banRows=rows.filter(row=>row.action_type==='ban');
    const banSeconds=banRows.reduce((sum,row)=>sum+elapsedDuration(row),0);
    const permanentBans=banRows.filter(row=>Number(row.duration_seconds||0)===0).length;
    const muteSeconds=rows.filter(row=>row.action_type==='mute').reduce((sum,row)=>sum+elapsedDuration(row),0);
    const duration=value=>{const days=Math.floor(value/86400);const hours=Math.floor(value%86400/3600);const minutes=Math.floor(value%3600/60);return `${days} d · ${hours} h · ${minutes} min`;};
    host.innerHTML=`<div class="reputation-title"><strong>Reputación</strong><small>Actividad de moderación registrada</small></div><div class="reputation-stats"><span><b>${warnings}</b><small>Avisos</small></span><span><b>${duration(banSeconds)}</b><small>Tiempo de ban${permanentBans?` · ${permanentBans} permanente(s)`:''}</small></span><span><b>${duration(muteSeconds)}</b><small>Tiempo de silencio</small></span></div>`;
  }
  $('#request-global-badge')?.addEventListener('click',()=>$('#badge-request-dialog')?.showModal());
  ['close-badge-request','cancel-badge-request'].forEach(id=>$('#'+id)?.addEventListener('click',()=>$('#badge-request-dialog')?.close()));
  $('#badge-request-form')?.addEventListener('submit',async event=>{
    event.preventDefault();if(!currentUser)return;const name=$('#badge-request-name').value.trim();const reason=$('#badge-request-reason').value.trim();
    if(name.length<2||reason.length<10){toast('Indica un nombre y una razón de al menos 10 caracteres.','error');return;}
    const button=$('#badge-request-form button[type="submit"]');button.disabled=true;
    try{const {error}=await client.from('nexus_badge_requests').insert({user_id:currentUser.id,proposed_name:name,reason});if(error)throw error;$('#badge-request-dialog').close();$('#badge-request-form').reset();toast('Solicitud enviada al equipo de Nexus.','success');await loadMyBadgeRequests();}
    catch(error){showError(error,'No se pudo enviar la solicitud. Comprueba la migración de insignias.');}finally{button.disabled=false;}
  });

  async function loadPlatformBadgeRequests(){
    if(!platformAdmin)return;const host=$('#platform-badge-requests');if(!host)return;
    const {data,error}=await client.from('nexus_badge_requests').select('id,user_id,proposed_name,reason,status,admin_note,created_at').order('created_at',{ascending:false}).limit(100);
    if(error){host.innerHTML='<p class="muted">No se pudieron cargar las solicitudes.</p>';return;}
    const people=await fetchProfiles([...new Set((data||[]).map(row=>row.user_id))]);
    const {data:badges}=await client.from('global_badges').select('id,name').order('name');
    host.innerHTML=(data||[]).map(row=>`<article class="badge-review-card"><div class="surface-heading"><strong>${escapeHtml(row.proposed_name)}</strong><small>@${escapeHtml(people[row.user_id]?.username||'usuario')} · ${escapeHtml(formatPlatformDate(row.created_at))}</small></div><p>${escapeHtml(row.reason)}</p><label class="field">Estado<select data-badge-request-status="${row.id}"><option value="submitted" ${row.status==='submitted'?'selected':''}>Recibida</option><option value="reviewing" ${row.status==='reviewing'?'selected':''}>En revisión</option><option value="accepted" ${row.status==='accepted'?'selected':''}>Aceptada</option><option value="rejected" ${row.status==='rejected'?'selected':''}>Rechazada</option></select></label><label class="field">Nota para el usuario<textarea data-badge-request-note="${row.id}" rows="2">${escapeHtml(row.admin_note||'')}</textarea></label><label class="field">Insignia a asignar al aceptar<select data-badge-request-award="${row.id}"><option value="">Asignar más adelante</option>${(badges||[]).map(b=>`<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}</select></label><button type="button" class="button button-primary" data-badge-request-save="${row.id}">Guardar revisión</button></article>`).join('')||'<p class="empty-state compact">No hay solicitudes de insignias.</p>';
    host.querySelectorAll('[data-badge-request-save]').forEach(button=>button.addEventListener('click',async()=>{const id=button.dataset.badgeRequestSave;const status=host.querySelector(`[data-badge-request-status="${id}"]`).value;const admin_note=host.querySelector(`[data-badge-request-note="${id}"]`).value.trim();const approved_badge_id=host.querySelector(`[data-badge-request-award="${id}"]`).value||null;const {error:updateError}=await client.from('nexus_badge_requests').update({status,admin_note,approved_badge_id,reviewed_by:currentUser.id}).eq('id',id);if(updateError)showError(updateError,'No se pudo actualizar la solicitud.');else{toast('Revisión guardada.','success');await loadPlatformBadgeRequests();}}));
  }
  async function loadPlatformAnnouncementCommunityOptions(){
    const select=$('#platform-announcement-community');if(!select)return;const {data,error}=await client.from('communities').select('id,name').order('name');if(error){console.warn(error);return;}select.innerHTML=(data||[]).map(row=>`<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('');
  }
  $('#platform-announcement-scope')?.addEventListener('change',()=>$('#platform-announcement-community-wrap')?.classList.toggle('hidden',$('#platform-announcement-scope').value!=='community'));
  $('#platform-announcement-form')?.addEventListener('submit',async event=>{
    event.preventDefault();if(!platformAdmin)return;const scope=$('#platform-announcement-scope').value;const communityId=scope==='community'?$('#platform-announcement-community').value:null;const title=$('#platform-announcement-title').value.trim();const body=$('#platform-announcement-body').value.trim();
    const {error}=await client.rpc('create_nexus_important_announcement',{p_scope:scope,p_community_id:communityId,p_title:title,p_body:body});if(error){showError(error,'No se pudo publicar el aviso importante. Comprueba la migración de 0.11.');return;}$('#platform-announcement-form').reset();$('#platform-announcement-community-wrap')?.classList.add('hidden');toast('Aviso importante publicado.','success');
  });
  async function loadGlobalImportantAnnouncements(){
    if(!currentUser)return;const {data,error}=await client.from('nexus_important_announcements').select('id,title,body,created_at').eq('scope','global').order('created_at',{ascending:false}).limit(10);
    globalAnnouncementsLoaded=true;
    if(error){console.debug('Avisos globales:',error.message);showWhatsNewOnce();return;}
    let seen=[];try{seen=JSON.parse(localStorage.getItem(`nexus-global-notices:${currentUser.id}`)||'[]');}catch{}
    const unseen=(data||[]).slice().reverse().filter(row=>!seen.includes(row.id));
    if(!unseen.length){showWhatsNewOnce();return;}
    activeSystemPopupQueue.push(...unseen.map(row=>({title:row.title,body:row.body,message_type:'important',announcementId:row.id})));
    showSystemInboxQueue();
  }
  async function loadImportantAnnouncementsForContext(){
    const host=$('#important-announcements');if(!host||!currentContext||!client)return;host.replaceChildren();
    try{
      const {data:globalRows,error:globalError}=await client.from('nexus_important_announcements').select('id,title,body,created_at').eq('scope','global').order('created_at',{ascending:false}).limit(3);if(globalError)throw globalError;
      let communityRows=[];if(currentContext.type==='channel'&&currentContext.importantAnnouncementsEnabled&&currentCommunity){const response=await client.from('nexus_important_announcements').select('id,title,body,created_at').eq('scope','community').eq('community_id',currentCommunity.id).order('created_at',{ascending:false}).limit(5);if(response.error)throw response.error;communityRows=response.data||[];}
      for(const row of [...(globalRows||[]),...communityRows].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))){const card=document.createElement('article');card.className='important-announcement-card';const title=document.createElement('strong');title.textContent=row.title;const body=document.createElement('p');body.textContent=row.body;const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Cerrar aviso');close.addEventListener('click',()=>card.remove());card.append(title,body,close);host.append(card);}
    }catch(error){console.debug('No se pudieron cargar avisos importantes:',error.message||error);}
  }

  // Channels+: channel-level role/member access control, backed by RLS.
  let activeChannelPermissionChannelId=null;
  async function refreshChannelPermissionTargets(){
    const type=$('#channel-permissions-target-type')?.value||'role';const select=$('#channel-permissions-target');if(!select||!currentCommunity)return;
    if(type==='role'){const {data,error}=await client.from('community_roles').select('id,name').eq('community_id',currentCommunity.id).order('position');if(error){showError(error);return;}select.innerHTML=(data||[]).map(row=>`<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('');}
    else{const {data:members,error}=await client.from('community_members').select('user_id').eq('community_id',currentCommunity.id);if(error){showError(error);return;}const ids=(members||[]).map(row=>row.user_id);const people=await fetchProfiles(ids);select.innerHTML=ids.map(id=>`<option value="${id}">${escapeHtml(people[id]?.nickname||people[id]?.username||id.slice(0,8))} (@${escapeHtml(people[id]?.username||'usuario')})</option>`).join('');}
    await loadChannelPermissionSelection();
  }
  async function loadChannelPermissionSelection(){
    if(!activeChannelPermissionChannelId||!currentCommunity)return;const subjectType=$('#channel-permissions-target-type').value;const subjectId=$('#channel-permissions-target').value;if(!subjectId)return;
    const {data,error}=await client.from('channel_permission_overrides').select('permissions').eq('channel_id',activeChannelPermissionChannelId).eq('subject_type',subjectType).eq('subject_id',subjectId).maybeSingle();if(error){showError(error);return;}const permissions=data?.permissions||{};
    $$('[data-channel-permission]').forEach(box=>{box.checked=permissions[box.dataset.channelPermission]===true;});
  }
  async function openChannelPermissionsDialog(channelId){
    if(!currentCommunity||(!communityPermissions.manage_channels&&!communityPermissions.manage_roles))return;activeChannelPermissionChannelId=channelId;$('#channel-permissions-id').value=channelId;const channel=currentCommunityChannels.find(row=>row.id===channelId);$('#channel-permissions-subtitle').textContent=`#${channel?.name||'canal'} · Los overrides se aplican sobre los permisos generales.`;
    await refreshChannelPermissionTargets();$('#channel-permissions-dialog')?.showModal();
  }
  $('#channel-permissions-target-type')?.addEventListener('change',refreshChannelPermissionTargets);
  $('#channel-permissions-target')?.addEventListener('change',loadChannelPermissionSelection);
  $('#close-channel-permissions')?.addEventListener('click',()=>$('#channel-permissions-dialog')?.close());
  $('#clear-channel-permissions')?.addEventListener('click',async()=>{const subjectId=$('#channel-permissions-target').value;if(!activeChannelPermissionChannelId||!subjectId)return;const {error}=await client.from('channel_permission_overrides').delete().eq('channel_id',activeChannelPermissionChannelId).eq('subject_type',$('#channel-permissions-target-type').value).eq('subject_id',subjectId);if(error)showError(error);else{toast('Se restauró la herencia de permisos.','success');await loadChannelPermissionSelection();}});
  $('#channel-permissions-form')?.addEventListener('submit',async event=>{event.preventDefault();if(!activeChannelPermissionChannelId||!currentCommunity)return;const subjectType=$('#channel-permissions-target-type').value;const subjectId=$('#channel-permissions-target').value;if(!subjectId)return;const permissions={};$$('[data-channel-permission]').forEach(box=>permissions[box.dataset.channelPermission]=Boolean(box.checked));const {error}=await client.from('channel_permission_overrides').upsert({channel_id:activeChannelPermissionChannelId,community_id:currentCommunity.id,subject_type:subjectType,subject_id:subjectId,permissions,updated_by:currentUser.id,updated_at:new Date().toISOString()},{onConflict:'channel_id,subject_type,subject_id'});if(error)showError(error,'No se pudieron guardar los permisos de Channels+.');else{$('#channel-permissions-dialog').close();toast('Permisos del canal actualizados.','success');await loadChannels();await loadForumUi();}});

  // Forum UI: boards use regular text channels, so existing mentions and history stay compatible.
  let loadedForumChannelIds=new Set();
  async function loadForumUi(){
    if(!currentCommunity)return;const list=$('#channel-list');if(!list)return;
    try{
      const {data:forums,error}=await client.from('community_forums').select('id,name,description,created_by').eq('community_id',currentCommunity.id).order('created_at');if(error)throw error;
      const forumIds=(forums||[]).map(row=>row.id);const {data:boards,error:boardError}=forumIds.length?await client.from('forum_boards').select('id,forum_id,channel_id,created_by').in('forum_id',forumIds):{data:[],error:null};if(boardError)throw boardError;
      loadedForumChannelIds=new Set((boards||[]).map(row=>row.channel_id));
      // Remove the standard category rendering for board channels; each board is rendered under its forum.
      list.querySelectorAll('[data-channel]').forEach(button=>{if(loadedForumChannelIds.has(button.dataset.channel))button.closest('.channel-row')?.remove();});
      list.querySelectorAll('.channel-category').forEach(section=>{if(!section.querySelector('.channel-row'))section.remove();});
      list.querySelectorAll('.forum-category').forEach(node=>node.remove());
      for(const forum of forums||[]){const forumBoards=(boards||[]).filter(row=>row.forum_id===forum.id);const ids=forumBoards.map(row=>row.channel_id);const channels=currentCommunityChannels.filter(row=>ids.includes(row.id));const section=document.createElement('section');section.className='forum-category channel-category';const heading=document.createElement('div');heading.className='forum-category-heading';const title=document.createElement('strong');title.textContent=`▤ ${forum.name}`;const create=document.createElement('button');create.type='button';create.className='tiny-button';create.textContent='+';create.title=`Crear tablero en ${forum.name}`;create.addEventListener('click',()=>createForumBoard(forum));heading.append(title,create);section.append(heading);
        const boardList=document.createElement('div');boardList.className='channel-category-items';for(const channel of channels){const row=document.createElement('div');row.className='channel-row';const open=document.createElement('button');open.type='button';open.className=`channel-item ${currentContext?.id===channel.id?'active':''}`;open.dataset.channel=channel.id;open.innerHTML=`<span class="channel-hash">▤</span><span class="channel-item-name">${escapeHtml(channel.name)}</span><span class="channel-type-mini">TABLERO</span>`;open.addEventListener('click',()=>openCommunityChannel(channel));row.append(open);if(communityPermissions.manage_channels||communityPermissions.manage_roles){const admin=document.createElement('span');admin.className='channel-admin-actions';const access=document.createElement('button');access.type='button';access.textContent='⚿';access.title='Channels+ · Permisos';access.addEventListener('click',()=>openChannelPermissionsDialog(channel.id));admin.append(access);row.append(admin);}boardList.append(row);}if(!channels.length){const empty=document.createElement('small');empty.className='muted small-muted forum-empty';empty.textContent='Todavía no hay tableros. Cualquier miembro puede crear el primero.';boardList.append(empty);}section.append(boardList);list.append(section);
      }
      const addForum=$('#add-forum');if(addForum){addForum.classList.toggle('hidden',!communityPermissions.manage_channels);addForum.onclick=createForumCategory;}
    }catch(error){console.warn('Foros no disponibles:',error.message||error);}
  }
  async function createForumCategory(){
    if(!currentCommunity||!communityPermissions.manage_channels)return;const name=await ask('Crear foro','Crea una categoría de foros dentro de este megagrupo.','Nombre del foro','Foros');if(!name)return;const description=await ask('Descripción del foro','Puedes dejarla vacía.','Descripción','');if(description===null)return;const {error}=await client.rpc('create_community_forum',{p_community_id:currentCommunity.id,p_name:name,p_description:description||''});if(error)showError(error,'No se pudo crear el foro.');else{toast('Foro creado.','success');await loadChannels();await loadForumUi();}
  }
  async function createForumBoard(forum){
    if(!forum||!currentCommunity)return;const name=await ask('Crear tablero',`Nuevo tablero dentro de «${forum.name}».`,'Nombre del tablero','Mi tablero');if(!name)return;const description=await ask('Descripción del tablero','Puedes dejarla vacía.','Descripción','');if(description===null)return;const {data:channelId,error}=await client.rpc('create_forum_board',{p_forum_id:forum.id,p_name:name,p_description:description||''});if(error){showError(error,'No se pudo crear el tablero.');return;}await loadChannels();await loadForumUi();const channel=currentCommunityChannels.find(row=>row.id===channelId);if(channel)await openCommunityChannel(channel);toast('Tablero creado.','success');
  }

  // Important announcements are also displayed inside opted-in megagroup channels.
  const oldShowMessagePanelForAnnouncements=showMessagePanel;
  showMessagePanel=async function(){await oldShowMessagePanelForAnnouncements();await loadImportantAnnouncementsForContext();};

  // Admin entry point loads the new 0.11 queues when the separated panel opens.
  const oldLoadPlatformFeedback=loadPlatformFeedback;
  if(typeof oldLoadPlatformFeedback==='function'){
    const originalSwitchView=switchView;
    switchView=function(view){originalSwitchView(view);if(view==='admin'&&platformAdmin){loadPlatformBadgeRequests();loadPlatformAnnouncementCommunityOptions();}};
  }

  // Repair megacompact navigation: move the category strip to the top of the DM list.
  function relocateMegacompactSwitcher(){
    const switcher=$('#megacompact-view-switcher');const panel=$('.chat-list-panel');const personal=$('#sidebar-personal');if(!switcher||!panel||!personal)return;
    const enabled=Boolean(profile?.settings?.compactPanels&&profile?.settings?.megacompact&&currentView==='chats'&&!currentCommunity);
    if(enabled&&switcher.parentElement!==panel){panel.insertBefore(switcher,panel.firstChild);}
    else if(!enabled&&switcher.parentElement!==personal){personal.insertBefore(switcher,personal.firstChild);}
    switcher.classList.toggle('hidden',!(profile?.settings?.compactPanels&&profile?.settings?.megacompact));
    switcher.querySelectorAll('[data-view]').forEach(button=>{const active=button.dataset.view===currentView;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'true':'false');});
  }
  $('#megacompact-view-switcher')?.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
  const oldApplyClientPreferences=applyClientPreferences;
  applyClientPreferences=function(){oldApplyClientPreferences();relocateMegacompactSwitcher();};
  const oldSwitchView=switchView;
  switchView=function(view){oldSwitchView(view);relocateMegacompactSwitcher();};


  // MegaCompact layout hotfix: use one real sidebar for the personal inbox.
  // Desktop: switcher + DM list share the sidebar column; the conversation stays
  // in the main panel. Mobile: keep the DM list in the main view and put the
  // switcher above it so the normal one-panel navigation remains usable.
  function syncMegacompactLayout(){
    const app=$('#app-screen');
    const sidebar=$('.sidebar');
    const sidebarTop=sidebar?.querySelector('.sidebar-top');
    const personal=$('#sidebar-personal');
    const switcher=$('#megacompact-view-switcher');
    const chatLayout=$('#view-chats .chat-layout');
    const listPanel=$('.chat-list-panel');
    const conversationPanel=$('#conversation-panel');
    const mainPanel=$('.main-panel');
    if(!app||!sidebar||!personal||!switcher||!chatLayout||!listPanel||!conversationPanel||!mainPanel)return;

    const preferences=profile?.settings||{};
    const enabled=Boolean(preferences.compactPanels&&preferences.megacompact);
    const communityContext=currentView==='community'||(currentView==='chats'&&currentContext?.type==='channel');
    const active=enabled&&!communityContext;
    const narrow=window.matchMedia('(max-width: 760px)').matches;

    app.classList.toggle('megacompact-mode',active);
    app.classList.toggle('megacompact-personal-mode',active);
    app.classList.toggle('megacompact-chat-active',active&&currentView==='chats'&&!narrow);

    // Always restore the chat list before moving it to another host. This also
    // makes resize/orientation changes safe and prevents detached panels.
    if(!active){
      if(listPanel.parentElement!==chatLayout)chatLayout.insertBefore(listPanel,conversationPanel);
      if(switcher.parentElement!==personal)personal.insertBefore(switcher,personal.firstChild);
      switcher.classList.add('hidden');
    }else if(narrow){
      if(listPanel.parentElement!==chatLayout)chatLayout.insertBefore(listPanel,conversationPanel);
      if(currentView==='chats'){
        if(switcher.parentElement!==listPanel)listPanel.insertBefore(switcher,listPanel.firstChild);
      }else{
        const firstView=mainPanel.querySelector('.view');
        if(switcher.parentElement!==mainPanel)mainPanel.insertBefore(switcher,firstView||null);
      }
      switcher.classList.remove('hidden');
    }else{
      if(switcher.parentElement!==sidebar){
        sidebar.insertBefore(switcher,personal);
      }
      if(currentView==='chats'){
        if(listPanel.parentElement!==sidebar)sidebar.insertBefore(listPanel,personal);
      }else if(listPanel.parentElement!==chatLayout){
        chatLayout.insertBefore(listPanel,conversationPanel);
      }
      switcher.classList.remove('hidden');
    }

    switcher.querySelectorAll('[data-view]').forEach(button=>{
      const selected=button.dataset.view===currentView;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-current',selected?'page':'false');
    });
  }

  // A tab switch back to Chats must leave a channel context first; otherwise
  // the community sidebar would keep the personal mega layout from activating.
  const previousMegaSwitchView=switchView;
  switchView=function(view){
    previousMegaSwitchView(view);
    syncMegacompactLayout();
  };
  // The Chats tab is the explicit route back from a community channel to the
  // personal inbox. Do this only for clicks on the mega switcher, not for the
  // programmatic switchView('chats') used when opening a channel.
  $('#megacompact-view-switcher')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-view]');
    if(button?.dataset.view==='chats'&&currentContext?.type==='channel')returnToPersonalInbox();
  },true);

  const previousMegaApplyPreferences=applyClientPreferences;
  applyClientPreferences=function(){
    previousMegaApplyPreferences();
    syncMegacompactLayout();
  };

  const previousMegaStartApp=startApp;
  startApp=async function(user){
    await previousMegaStartApp(user);
    syncMegacompactLayout();
  };

  window.addEventListener('resize',()=>syncMegacompactLayout(),{passive:true});
  window.addEventListener('orientationchange',()=>syncMegacompactLayout(),{passive:true});
  syncMegacompactLayout();

  // Hovers+: replace native badge title tooltips with themed lightweight cards.
  if(!document.documentElement.dataset.nexusHoverDelegated){
    document.documentElement.dataset.nexusHoverDelegated='1';
    let activeNexusHover=null;
    document.addEventListener('pointerover',event=>{
      if(!document.documentElement.classList.contains('nexus-hover-plus'))return;
      const target=event.target.closest('.message-badge-icon[title],.message-badge-emoji[title],.message-role-tag[title],.profile-badge[title],.global-badge-icon[title]');
      if(!target||activeNexusHover?.target===target)return;
      if(activeNexusHover){activeNexusHover.tip.remove();if(activeNexusHover.title)activeNexusHover.target.setAttribute('title',activeNexusHover.title);activeNexusHover=null;}
      const label=target.getAttribute('title');if(!label)return;
      target.removeAttribute('title');
      const tip=document.createElement('span');tip.className='nexus-themed-hover';tip.textContent=label;
      const rect=target.getBoundingClientRect();tip.style.left=`${rect.left+rect.width/2}px`;tip.style.top=`${Math.max(8,rect.top-8)}px`;
      document.body.append(tip);activeNexusHover={target,tip,title:label};
    });
    document.addEventListener('pointerout',event=>{
      if(!activeNexusHover||activeNexusHover.target!==event.target.closest('.message-badge-icon,.message-badge-emoji,.message-role-tag,.profile-badge,.global-badge-icon'))return;
      if(activeNexusHover.target.contains(event.relatedTarget))return;
      activeNexusHover.tip.remove();activeNexusHover.target.setAttribute('title',activeNexusHover.title);activeNexusHover=null;
    });
  }


  // Global announcement delivery is a per-account popup, shown once per notice.
  const oldStartAppForNotices=startApp;
  startApp=async function(user){globalAnnouncementsLoaded=false;await oldStartAppForNotices(user);if(currentUser&&profile){await loadGlobalImportantAnnouncements();await loadMyBadgeRequests();await loadMyReputationStats();}};

  // Helpful inline formatting shortcuts.
  $('#message-template').setAttribute('aria-hidden','true');
})();
