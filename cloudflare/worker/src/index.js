import { DurableObject } from 'cloudflare:workers';

const MEDIA_BUCKETS = new Set(['chat-media', 'profile-media', 'nexus-assets']);
const PRIVATE_MEDIA_BUCKETS = new Set(['chat-media', 'nexus-assets']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = !origin || origin === env.APP_ORIGIN ? env.APP_ORIGIN : 'null';
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}
function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function cleanPath(value) {
  if (typeof value !== 'string' || !value || value.length > 900) return null;
  let path;
  try { path = decodeURIComponent(value); } catch { path = value; }
  path = path.replace(/^\/+/, '');
  if (!path || path.includes('\\') || path.includes('\0')) return null;
  const segments = path.split('/');
  if (segments.some(part => !part || part === '.' || part === '..' || part.length > 180)) return null;
  return path;
}
function storagePath(path) {
  return path.startsWith('edge/') ? path.slice(5) : path;
}
function objectKey(bucket, path) { return `${bucket}/${path}`; }
function allowedMime(bucket, mime) {
  const type = String(mime || '').split(';')[0].trim().toLowerCase();
  if (bucket === 'profile-media') return /^(image\/(png|jpeg|webp|gif)|font\/(woff|woff2|ttf))$/.test(type);
  if (bucket === 'nexus-assets') return ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type);
  if (bucket === 'chat-media') return /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|audio\/(webm|ogg|mp4|mpeg|wav|x-wav)|application\/(pdf|zip|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.oasis\.opendocument\.spreadsheet)|text\/(plain|csv|tab-separated-values))$/.test(type);
  return false;
}
function maxBytes(bucket) {
  if (bucket === 'profile-media') return 8 * 1024 * 1024;
  if (bucket === 'nexus-assets') return 5 * 1024 * 1024;
  return 50 * 1024 * 1024;
}
function b64url(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64url(value) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
async function authUser(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? { id: user.id, authorization } : null;
}
async function userRpc(env, auth, name, args) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: auth.authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`Supabase RPC ${name} devolvió ${response.status}.`);
  return response.json();
}
async function authorizeMedia(env, auth, bucket, paths, action) {
  // Preserve the `edge/` marker so PostgreSQL can distinguish new R2 uploads
  // from legacy Storage objects when checking ownership on delete.
  const submitted = paths;
  const result = await userRpc(env, auth, 'nexus_edge_authorize_media', {
    p_bucket: bucket,
    p_object_names: submitted,
    p_action: action,
  });
  const map = new Map((Array.isArray(result) ? result : []).map(row => [row.object_name, row.allowed === true]));
  return submitted.map(path => map.get(path) === true);
}
function roomName(kind, id) { return kind === 'notifications' ? 'notifications:global' : `${kind}:${id}`; }
function validRoom(kind, id) {
  if (kind === 'notifications') return id === 'global';
  return ['conversation', 'channel'].includes(kind) && UUID_RE.test(id || '');
}
async function issueRoomTicket(env, kind, id, userId) {
  const stub = env.ROOMS.get(env.ROOMS.idFromName(roomName(kind, id)));
  const ticket = crypto.randomUUID();
  const response = await stub.fetch('https://room.internal/ticket', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nexus-edge-internal': env.EDGE_INTERNAL_SECRET },
    body: JSON.stringify({ ticket, userId, kind, id, expiresAt: Date.now() + 60_000 }),
  });
  if (!response.ok) throw new Error('No se pudo emitir el ticket WebSocket.');
  return ticket;
}
async function publishRoom(env, kind, id, payload) {
  const stub = env.ROOMS.get(env.ROOMS.idFromName(roomName(kind, id)));
  return stub.fetch('https://room.internal/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nexus-edge-internal': env.EDGE_INTERNAL_SECRET },
    body: JSON.stringify(payload),
  });
}
async function signMediaUrl(env, bucket, path, expiresAt) {
  const signature = await hmac(env.MEDIA_SIGNING_SECRET, `${bucket}\n${path}\n${expiresAt}`);
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${env.EDGE_PUBLIC_URL || 'https://api.nexuscollective.app'}/media/secure/${bucket}/${encodedPath}?exp=${expiresAt}&sig=${signature}`;
}
async function handleMediaUpload(request, env) {
  const auth = await authUser(request, env);
  if (!auth) return json({ error: 'Sesión no válida.' }, 401);
  const url = new URL(request.url);
  const bucket = url.searchParams.get('bucket') || '';
  const submittedPath = cleanPath(url.searchParams.get('path') || '');
  if (!MEDIA_BUCKETS.has(bucket) || !submittedPath) return json({ error: 'Bucket o ruta no permitidos.' }, 400);
  const path = storagePath(submittedPath);
  const mime = request.headers.get('Content-Type') || 'application/octet-stream';
  const contentLengthHeader = request.headers.get('Content-Length');
  const sizeParam = url.searchParams.get('size');
  const length = Number(sizeParam ?? contentLengthHeader ?? NaN);
  if (!allowedMime(bucket, mime)) return json({ error: 'Tipo MIME no permitido.' }, 415);
  if (!Number.isSafeInteger(length) || length <= 0) {
    return json({ error: 'No se pudo determinar el tamaño del archivo. Actualiza Nexus e inténtalo de nuevo.' }, 411);
  }
  const headerLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (headerLength > 0 && headerLength !== length) {
    return json({ error: 'El tamaño declarado no coincide con Content-Length.' }, 400);
  }
  if (length > maxBytes(bucket)) return json({ error: 'El archivo supera el límite del bucket.' }, 413);
  const allowed = await authorizeMedia(env, auth, bucket, [submittedPath], 'upload');
  if (!allowed[0]) return json({ error: 'No tienes permiso para subir este archivo.' }, 403);

  let observedBytes = 0;
  const source = request.body;
  if (!source) return json({ error: 'El cuerpo del archivo está vacío.' }, 400);
  const limited = source.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      observedBytes += chunk.byteLength;
      if (observedBytes > maxBytes(bucket)) throw new Error('El archivo supera el límite del bucket.');
      controller.enqueue(chunk);
    },
  }));
  const cacheControl = bucket === 'profile-media' ? 'public, max-age=31536000, immutable' : 'private, max-age=300';
  // A TransformStream does not retain the source stream's known length. R2.put()
  // therefore rejects it unless it is wrapped in FixedLengthStream.
  // The stream enforces that the received bytes exactly match the declared size,
  // without buffering the complete file in Worker memory.
  const fixedLength = new FixedLengthStream(length);
  const pipeAbort = new AbortController();
  const pipePromise = limited.pipeTo(fixedLength.writable, { signal: pipeAbort.signal });
  const cacheControl = bucket === 'profile-media' ? 'public, max-age=31536000, immutable' : 'private, max-age=300';
  try {
    await Promise.all([
      env.MEDIA.put(objectKey(bucket, path), fixedLength.readable, {
        httpMetadata: { contentType: mime.split(';')[0].trim(), cacheControl },
        customMetadata: { ownerId: auth.id, bucket, originalPath: path, uploadedAt: new Date().toISOString() },
      }),
      pipePromise,
    ]);
  } catch (error) {
    pipeAbort.abort(error);
    await pipePromise.catch(() => {});
    if (observedBytes > maxBytes(bucket)) {
      return json({ error: 'El archivo supera el límite del bucket.' }, 413);
    }
    if (observedBytes !== length) {
      return json({ error: 'La subida se interrumpió o el tamaño recibido no coincide con el declarado.' }, 400);
    }
    return json({ error: String(error?.message || 'No se pudo guardar el archivo en R2.') }, 500);
  }
  const publicUrl = bucket === 'profile-media'
    ? `${env.EDGE_PUBLIC_URL || 'https://api.nexuscollective.app'}/media/public/profile-media/${path.split('/').map(encodeURIComponent).join('/')}`
    : null;
  return json({ ok: true, path: submittedPath, publicUrl });
}
async function handleMediaSign(request, env) {
  const auth = await authUser(request, env);
  if (!auth) return json({ error: 'Sesión no válida.' }, 401);
  const body = await request.json().catch(() => null);
  const bucket = String(body?.bucket || '');
  const paths = Array.isArray(body?.paths) ? body.paths.slice(0, 80).map(cleanPath) : [];
  if (!PRIVATE_MEDIA_BUCKETS.has(bucket) || !paths.length || paths.some(path => !path)) return json({ error: 'Solicitud de archivos no válida.' }, 400);
  const allowed = await authorizeMedia(env, auth, bucket, paths, 'read');
  if (allowed.some(value => !value)) return json({ error: 'No tienes acceso a uno o más archivos.' }, 403);
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const items = [];
  for (let index = 0; index < paths.length; index++) {
    const submittedPath = paths[index];
    const path = storagePath(submittedPath);
    if (!submittedPath.startsWith('edge/')) {
      const object = await env.MEDIA.head(objectKey(bucket, path));
      if (!object) {
        items.push({ path: submittedPath, legacy: true });
        continue;
      }
    }
    items.push({ path: submittedPath, url: await signMediaUrl(env, bucket, path, expiresAt) });
  }
  return json({ items });
}
async function handleMediaDelete(request, env) {
  const auth = await authUser(request, env);
  if (!auth) return json({ error: 'Sesión no válida.' }, 401);
  const body = await request.json().catch(() => null);
  const bucket = String(body?.bucket || '');
  const submittedPath = cleanPath(body?.path || '');
  if (!MEDIA_BUCKETS.has(bucket) || !submittedPath) return json({ error: 'Solicitud de borrado no válida.' }, 400);
  const path = storagePath(submittedPath);
  const allowed = await authorizeMedia(env, auth, bucket, [submittedPath], 'delete');
  if (!allowed[0]) return json({ error: 'No tienes permiso para borrar este archivo.' }, 403);
  const object = await env.MEDIA.head(objectKey(bucket, path));
  if (!object) return json({ ok: true, missing: true });
  if (bucket === 'chat-media' && (object.customMetadata?.ownerId || object.customMetadata?.ownerid) && (object.customMetadata.ownerId || object.customMetadata.ownerid) !== auth.id) return json({ error: 'Solo quien subió el archivo puede borrarlo.' }, 403);
  if (bucket === 'chat-media' && submittedPath.startsWith('edge/') && (object.customMetadata?.ownerId || object.customMetadata?.ownerid) !== auth.id) return json({ error: 'No se pudo verificar la propiedad del archivo.' }, 403);
  await env.MEDIA.delete(objectKey(bucket, path));
  return json({ ok: true });
}
async function serveR2Object(request, env, bucket, path, isPublic = false) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  if (!MEDIA_BUCKETS.has(bucket) || !cleanPath(path)) return new Response('Not found', { status: 404 });
  if (!isPublic) {
    const expiresAt = Number(new URL(request.url).searchParams.get('exp'));
    const signature = new URL(request.url).searchParams.get('sig') || '';
    if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000) || expiresAt > Math.floor(Date.now() / 1000) + 3700) return new Response('Expired URL', { status: 403 });
    const expected = await hmac(env.MEDIA_SIGNING_SECRET, `${bucket}\n${path}\n${expiresAt}`);
    if (!safeEqual(signature, expected)) return new Response('Invalid signature', { status: 403 });
  } else if (bucket !== 'profile-media') {
    return new Response('Not found', { status: 404 });
  }

  const rangeHeader = request.headers.get('Range');
  const isHead = request.method === 'HEAD';
  let head = null;
  let range = null;
  if (rangeHeader || isHead) {
    head = await env.MEDIA.head(objectKey(bucket, path));
    if (!head) return new Response('Not found', { status: 404 });
  }
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match || (!match[1] && !match[2])) return new Response('Invalid range', { status: 416, headers: { 'content-range': `bytes */${head.size}` } });
    let start;
    let end;
    if (!match[1]) {
      const suffixLength = Number(match[2]);
      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${head.size}` } });
      start = Math.max(0, head.size - suffixLength);
      end = head.size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : head.size - 1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= head.size) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${head.size}` } });
    }
    const safeEnd = Math.min(end, head.size - 1);
    range = { offset: start, length: safeEnd - start + 1 };
  }

  // A HEAD request and a ranged response use metadata first. A normal GET uses
  // one R2 get operation rather than an unnecessary head + get pair.
  let object = null;
  if (!isHead) {
    object = await env.MEDIA.get(objectKey(bucket, path), range ? { range } : undefined);
    if (!object) return new Response('Not found', { status: 404 });
  }
  const metadata = object || head;
  const headers = new Headers();
  metadata.writeHttpMetadata(headers);
  headers.set('etag', metadata.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('access-control-allow-origin', env.APP_ORIGIN);
  headers.set('vary', 'Origin');
  if (isPublic) headers.set('cache-control', 'public, max-age=86400');
  else headers.set('cache-control', 'private, max-age=300');
  if (range) {
    const start = range.offset;
    const end = start + range.length - 1;
    headers.set('content-range', `bytes ${start}-${end}/${head.size}`);
    headers.set('content-length', String(range.length));
    return new Response(isHead ? null : object.body, { status: 206, headers });
  }
  headers.set('content-length', String(metadata.size));
  return new Response(isHead ? null : object.body, { status: 200, headers });
}

async function recipientIds(env, message) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/nexus_edge_message_recipients`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      p_conversation_id: message.conversation_id || null,
      p_channel_id: message.channel_id || null,
      p_sender_id: message.sender_id || null,
    }),
  });
  if (!response.ok) throw new Error(`Consulta de destinatarios falló (${response.status}).`);
  const result = await response.json();
  return Array.isArray(result) ? result.filter(value => typeof value === 'string' && UUID_RE.test(value)) : [];
}
async function handleMessageWebhook(request, env) {
  if (!env.EDGE_WEBHOOK_SECRET || !safeEqual(request.headers.get('x-nexus-edge-secret') || '', env.EDGE_WEBHOOK_SECRET)) return json({ error: 'Unauthorized' }, 401);
  const payload = await request.json().catch(() => null);
  if (!payload || payload.schema !== 'public' || payload.table !== 'messages') return json({ error: 'Unsupported event' }, 400);
  const eventType = String(payload.type || '').toUpperCase();
  if (!['INSERT', 'UPDATE', 'DELETE'].includes(eventType)) return json({ ignored: true });
  const record = eventType === 'DELETE' ? payload.old_record : payload.record;
  if (!record?.id) return json({ ignored: true });
  const kind = record.conversation_id ? 'conversation' : record.channel_id ? 'channel' : null;
  const contextId = record.conversation_id || record.channel_id;
  if (!kind || !contextId) return json({ ignored: true });
  const roomResponse = await publishRoom(env, kind, contextId, { type: 'message_event', eventType, record });
  if (!roomResponse.ok) throw new Error(`No se pudo distribuir el evento a ${kind}:${contextId} (${roomResponse.status}).`);

  let notificationError = false;
  if (eventType === 'INSERT') {
    try {
      const recipients = await recipientIds(env, record);
      if (recipients.length) {
        const notificationResponse = await publishRoom(env, 'notifications', 'global', {
          type: 'notification_fanout',
          recipients,
          message: {
            id: record.id,
            sender_id: record.sender_id,
            conversation_id: record.conversation_id || null,
            channel_id: record.channel_id || null,
            body: record.body || '',
            attachment: record.attachment || null,
            created_at: record.created_at,
          },
        });
        if (!notificationResponse.ok) throw new Error(`El hub de notificaciones respondió ${notificationResponse.status}.`);
      }
    } catch (error) {
      notificationError = true;
      console.error('Nexus Edge: falló el fan-out de notificaciones; el mensaje ya se distribuyó a su sala:', error);
    }
  }
  return json({ ok: true, eventType, room: `${kind}:${contextId}`, notificationError });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), request, env);
    if (url.pathname === '/health') return json({ ok: true, service: 'nexus-edge', version: '0.13.1-alpha1-hotfix1' });

    if (url.pathname.startsWith('/media/public/profile-media/')) {
      let path;
      try { path = url.pathname.slice('/media/public/profile-media/'.length).split('/').map(decodeURIComponent).join('/'); }
      catch { return withCors(new Response('Invalid path', { status: 400 }), request, env); }
      const response = await serveR2Object(request, env, 'profile-media', path, true);
      return withCors(response, request, env);
    }
    if (url.pathname.startsWith('/media/secure/')) {
      const parts = url.pathname.slice('/media/secure/'.length).split('/');
      const bucket = parts.shift() || '';
      let path;
      try { path = parts.map(decodeURIComponent).join('/'); }
      catch { return withCors(new Response('Invalid path', { status: 400 }), request, env); }
      const response = await serveR2Object(request, env, bucket, path, false);
      return withCors(response, request, env);
    }

    try {
      if (url.pathname === '/api/media/upload' && request.method === 'POST') return withCors(await handleMediaUpload(request, env), request, env);
      if (url.pathname === '/api/media/sign' && request.method === 'POST') return withCors(await handleMediaSign(request, env), request, env);
      if (url.pathname === '/api/media/delete' && request.method === 'POST') return withCors(await handleMediaDelete(request, env), request, env);
      if (url.pathname === '/api/realtime/ticket' && request.method === 'POST') {
        const auth = await authUser(request, env);
        if (!auth) return withCors(json({ error: 'Sesión no válida.' }, 401), request, env);
        const body = await request.json().catch(() => null);
        const kind = String(body?.kind || '');
        const id = String(body?.id || '');
        if (!validRoom(kind, id)) return withCors(json({ error: 'Sala no válida.' }, 400), request, env);
        const topic = kind === 'notifications' ? `nexus-notifications-${auth.id}` : `nexus-${kind}-${id}`;
        const allowed = await userRpc(env, auth, 'can_join_nexus_app_topic', { p_topic: topic });
        if (allowed !== true) return withCors(json({ error: 'No tienes permiso para conectarte a esta sala.' }, 403), request, env);
        const ticket = await issueRoomTicket(env, kind, id, auth.id);
        return withCors(json({ ticket, expiresIn: 60 }), request, env);
      }
      if (url.pathname === '/api/webhooks/supabase/messages' && request.method === 'POST') return handleMessageWebhook(request, env);
      if (url.pathname.startsWith('/ws/')) {
        const [, , kind, id] = url.pathname.split('/');
        if (!validRoom(kind, id) || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Bad WebSocket request', { status: 400 });
        const stub = env.ROOMS.get(env.ROOMS.idFromName(roomName(kind, id)));
        return stub.fetch(new Request(`https://room.internal/ws?ticket=${encodeURIComponent(url.searchParams.get('ticket') || '')}`, request));
      }
      return withCors(json({ error: 'Not found' }, 404), request, env);
    } catch (error) {
      console.error('Nexus Edge request failed:', error);
      return withCors(json({ error: String(error?.message || 'Internal error') }, 500), request, env);
    }
  },
};

export class NexusRoomHub extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/ticket' && request.method === 'POST') {
      if (!this.env.EDGE_INTERNAL_SECRET || !safeEqual(request.headers.get('x-nexus-edge-internal') || '', this.env.EDGE_INTERNAL_SECRET)) return new Response('Forbidden', { status: 403 });
      const payload = await request.json();
      if (!payload.ticket || !payload.userId || !payload.kind || !payload.id || payload.expiresAt < Date.now()) return new Response('Bad ticket', { status: 400 });
      await this.ctx.storage.put(`ticket:${payload.ticket}`, payload);
      const alarm = await this.ctx.storage.getAlarm();
      if (!alarm || alarm > Date.now() + 60_000) await this.ctx.storage.setAlarm(Date.now() + 60_000);
      return new Response('ok');
    }
    if (url.pathname === '/publish' && request.method === 'POST') {
      if (!this.env.EDGE_INTERNAL_SECRET || !safeEqual(request.headers.get('x-nexus-edge-internal') || '', this.env.EDGE_INTERNAL_SECRET)) return new Response('Forbidden', { status: 403 });
      const payload = await request.json();
      this.publish(payload);
      return new Response('ok');
    }
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      const ticket = url.searchParams.get('ticket') || '';
      const data = await this.ctx.storage.get(`ticket:${ticket}`);
      if (!data || data.expiresAt < Date.now()) return new Response('Invalid or expired ticket', { status: 401 });
      await this.ctx.storage.delete(`ticket:${ticket}`);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const now = Date.now();
      server.serializeAttachment({ userId: data.userId, kind: data.kind, id: data.id, connectedAt: now, revalidateAt: now + 60_000 });
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (!currentAlarm || currentAlarm > now + 60_000) await this.ctx.storage.setAlarm(now + 60_000);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Not found', { status: 404 });
  }

  publish(payload) {
    const notificationMode = payload?.type === 'notification_fanout';
    const recipients = notificationMode ? new Set(payload.recipients || []) : null;
    const message = JSON.stringify(notificationMode
      ? { type: 'notification', message: payload.message }
      : payload);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const attachment = socket.deserializeAttachment() || {};
        if (notificationMode && !recipients.has(attachment.userId)) continue;
        socket.send(message);
      } catch {
        try { socket.close(1011, 'Delivery failed'); } catch {}
      }
    }
  }

  async webSocketMessage(socket, message) {
    try {
      const payload = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
      if (payload?.type === 'ping') socket.send(JSON.stringify({ type: 'pong', at: Date.now() }));
    } catch {
      socket.close(1008, 'Invalid message');
    }
  }

  async webSocketClose(socket, code, reason) {
    try { socket.close(code, reason); } catch {}
  }

  async alarm() {
    const now = Date.now();
    const entries = await this.ctx.storage.list({ prefix: 'ticket:' });
    let next = Infinity;
    for (const [key, value] of entries) {
      if (!value || value.expiresAt <= now) await this.ctx.storage.delete(key);
      else next = Math.min(next, value.expiresAt);
    }
    // Re-authorize every WebSocket periodically by forcing the client to obtain
    // a fresh ticket. This limits stale membership after a user is removed/banned.
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const attachment = socket.deserializeAttachment() || {};
        if (!attachment.revalidateAt || attachment.revalidateAt <= now) {
          socket.close(4001, 'Revalidation required');
        } else {
          next = Math.min(next, attachment.revalidateAt);
        }
      } catch {
        try { socket.close(1011, 'Session state unavailable'); } catch {}
      }
    }
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next + 100);
    else await this.ctx.storage.deleteAlarm();
  }
}
