import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Tiny .env reader to keep the utility dependency-light. Existing shell vars win.
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const rewriteProfiles = args.has('--rewrite-profiles');
const bucketsArg = process.argv.find(value => value.startsWith('--buckets='));
const limitArg = process.argv.find(value => value.startsWith('--limit='));
const buckets = bucketsArg
  ? bucketsArg.slice('--buckets='.length).split(',').map(value => value.trim()).filter(Boolean)
  : ['chat-media', 'nexus-assets', 'profile-media'];
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Infinity;
const allowedBuckets = new Set(['chat-media', 'nexus-assets', 'profile-media']);

function required(name) {
  const value = process.env[name];
  if (!value || value.startsWith('YOUR_')) throw new Error(`Falta configurar ${name} en tools/r2-migrate/.env.`);
  return value;
}

if (rewriteProfiles && !execute) throw new Error('--rewrite-profiles requiere también --execute.');
if (rewriteProfiles && !buckets.includes('profile-media')) throw new Error('--rewrite-profiles requiere incluir profile-media en --buckets.');
if (!buckets.length || buckets.some(bucket => !allowedBuckets.has(bucket))) throw new Error('Buckets permitidos: chat-media,nexus-assets,profile-media.');
if (!(limit > 0)) throw new Error('--limit debe ser un número positivo.');

const supabaseUrl = required('SUPABASE_URL').replace(/\/$/, '');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const accountId = required('CLOUDFLARE_ACCOUNT_ID');
const bucketName = process.env.R2_BUCKET_NAME || 'nexus-edge-media';
const edgePublicUrl = (process.env.EDGE_PUBLIC_URL || 'https://api.nexuscollective.app').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY') },
});

async function listAllObjects(bucket, prefix = '') {
  const results = [];
  let offset = 0;
  const pageSize = 100;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`Storage.list(${bucket}/${prefix}) falló: ${error.message}`);
    for (const item of data || []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      const isFolder = item.id == null && item.metadata == null;
      if (isFolder) results.push(...await listAllObjects(bucket, path));
      else results.push({ path, metadata: item.metadata || {} });
    }
    if (!data || data.length < pageSize) break;
    offset += data.length;
  }
  return results;
}

async function ownerMapForChatMedia(paths) {
  const map = new Map();
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    const { data, error } = await supabase.rpc('nexus_edge_media_owner_lookup', {
      p_bucket: 'chat-media',
      p_object_names: batch,
    });
    if (error) throw new Error(`No se pudo recuperar la propiedad original de los adjuntos: ${error.message}`);
    for (const [path, ownerId] of Object.entries(data || {})) if (ownerId) map.set(path, String(ownerId));
  }
  return map;
}

async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') return false;
    throw error;
  }
}

async function migrateBucket(bucket, files) {
  const owners = execute && bucket === 'chat-media' ? await ownerMapForChatMedia(files.map(item => item.path)) : new Map();
  let copied = 0;
  let skipped = 0;
  let bytes = 0;
  for (let index = 0; index < files.length && copied + skipped < limit; index++) {
    const item = files[index];
    const key = `${bucket}/${item.path}`;
    if (await objectExists(key)) { skipped++; continue; }
    if (!execute) {
      copied++;
      bytes += Number(item.metadata?.size || 0);
      continue;
    }
    const { data, error } = await supabase.storage.from(bucket).download(item.path);
    if (error || !data) throw new Error(`No se pudo descargar ${bucket}/${item.path}: ${error?.message || 'archivo vacío'}`);
    const body = Buffer.from(await data.arrayBuffer());
    const ownerId = owners.get(item.path);
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentLength: body.length,
      ContentType: item.metadata?.mimetype || data.type || 'application/octet-stream',
      CacheControl: bucket === 'profile-media' ? 'public, max-age=86400' : 'private, max-age=300',
      Metadata: { source: 'supabase', ...(ownerId ? { ownerid: ownerId } : {}) },
    }));
    copied++;
    bytes += body.length;
    if (copied % 25 === 0) console.log(`[${bucket}] ${copied} copiados; ${skipped} ya existían.`);
  }
  return { copied, skipped, bytes };
}

function profileObjectPath(value) {
  if (typeof value !== 'string' || !value.startsWith('https://')) return null;
  try {
    const url = new URL(value);
    const markers = ['/storage/v1/object/public/profile-media/', '/storage/v1/object/sign/profile-media/'];
    const marker = markers.find(candidate => url.pathname.includes(candidate));
    if (!marker) return null;
    const raw = url.pathname.slice(url.pathname.indexOf(marker) + marker.length);
    const path = decodeURIComponent(raw).replace(/^\/+/, '');
    if (!path || path.split('/').some(part => !part || part === '.' || part === '..')) return null;
    return path;
  } catch { return null; }
}

async function rewriteProfileUrls() {
  const fields = ['avatar_url','banner_url','profile_frame_url','profile_plate_url','name_effect_url','profile_effect_url','name_font_url','message_font_url'];
  let offset = 0;
  let rewritten = 0;
  const pageSize = 250;
  while (true) {
    const { data, error } = await supabase.from('profiles').select(['id', ...fields].join(',')).order('id').range(offset, offset + pageSize - 1);
    if (error) throw new Error(`No se pudieron leer los perfiles: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      const patch = {};
      for (const field of fields) {
        const path = profileObjectPath(row[field]);
        if (!path) continue;
        const key = `profile-media/${path}`;
        if (!await objectExists(key)) continue;
        patch[field] = `${edgePublicUrl}/media/public/profile-media/${path.split('/').map(encodeURIComponent).join('/')}`;
      }
      if (Object.keys(patch).length) {
        const { error: updateError } = await supabase.from('profiles').update(patch).eq('id', row.id);
        if (updateError) throw new Error(`No se pudo actualizar el perfil ${row.id}: ${updateError.message}`);
        rewritten++;
      }
    }
    offset += data.length;
    console.log(`[perfiles] revisados ${offset}; actualizados ${rewritten}.`);
    if (data.length < pageSize) break;
  }
  return rewritten;
}

console.log(execute ? 'MODO EJECUCIÓN: se descargarán archivos desde Supabase y se copiarán a R2.' : 'MODO SIMULACIÓN: no se descargará ni copiará ningún archivo.');
console.log('Buckets:', buckets.join(', '));
console.log('Destino R2:', bucketName);
if (!execute) console.log('Nota: la simulación solo lista metadatos. Usa --execute únicamente cuando tengas margen de egress.');
let total = { copied: 0, skipped: 0, bytes: 0 };
for (const bucket of buckets) {
  const files = await listAllObjects(bucket);
  const result = await migrateBucket(bucket, files);
  total.copied += result.copied;
  total.skipped += result.skipped;
  total.bytes += result.bytes;
  console.log(`[${bucket}] ${result.copied} ${execute ? 'copiados' : 'por copiar'}, ${result.skipped} ya existentes, ${(result.bytes / (1024 ** 3)).toFixed(3)} GiB.`);
}
let rewritten = 0;
if (rewriteProfiles) rewritten = await rewriteProfileUrls();
console.log(`\nResumen: ${total.copied} ${execute ? 'copiados' : 'previstos'}, ${total.skipped} omitidos, ${(total.bytes / (1024 ** 3)).toFixed(3)} GiB, ${rewritten} perfiles actualizados.`);
if (!execute) console.log('Para copiar: node migrate.mjs --execute [--buckets=chat-media,nexus-assets,profile-media]');
