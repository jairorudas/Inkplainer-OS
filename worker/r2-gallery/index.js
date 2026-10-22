// Gallery gateway for a private R2 bucket, used by Inkplainer's "Import from R2".
//
//   GET    /list?prefix=&cursor=  -> { prefix, items: [{ key, size, uploaded }], cursor, truncated }   (API_TOKEN)
//   GET    /list?kind=audio       -> same, for the narration folder (AUDIO_PREFIX, audio files only)    (API_TOKEN)
//   GET    /file?key=             -> the image (or narration audio) bytes                               (API_TOKEN)
//   PUT    /file?key=[&overwrite=1] body = image                                                        (WRITE_TOKEN)
//   DELETE /file?key=             -> moves the image to <PREFIX>.trash/<timestamp>/..., never erases    (WRITE_TOKEN)
//
// Bindings / variables (see README.md):
//   ASSETS           R2 bucket binding
//   API_TOKEN        secret; read access:  "Authorization: Bearer <token>"
//   WRITE_TOKEN      secret; upload/delete access. Without it, writes are refused (the Worker stays read-only).
//   ALLOWED_ORIGINS  comma-separated origins allowed by CORS
//   PREFIX           folder that may be listed/read/written, e.g. "production/" (default: whole bucket)
//   AUDIO_PREFIX     optional folder with narration audio, e.g. "narration/". READ-ONLY: never writable or deletable.

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm)$/i;
const KEY_CHARS = /^[\p{L}\p{N} ._\-/()+@,&']+$/u;
const MAX_PAGE = 100;
const MAX_UPLOAD = 20 * 1024 * 1024; // 20 MB
const TRASH = '.trash/';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const corsOk = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': corsOk ? origin : 'null',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: corsOk ? 204 : 403, headers: cors });
    // Browsers always send Origin on cross-origin fetches; refuse anything not on the list.
    if (!corsOk) return json({ error: 'origin not allowed' }, 403);

    const prefix = env.PREFIX || '';
    const audioPrefix = env.AUDIO_PREFIX || '';
    const url = new URL(request.url);
    const isWrite = request.method === 'PUT' || request.method === 'DELETE';
    if (!isWrite && request.method !== 'GET') return json({ error: 'method not allowed' }, 405);

    if (!(await tokenOk(request, isWrite ? env.WRITE_TOKEN : env.API_TOKEN))) return json({ error: 'unauthorized' }, 401);

    if (request.method === 'GET' && url.pathname === '/list') {
      const audio = url.searchParams.get('kind') === 'audio';
      if (audio && !audioPrefix) return json({ error: 'narration folder not configured' }, 404);
      const base = audio ? audioPrefix : prefix, ext = audio ? AUDIO_EXT : IMAGE_EXT;
      const sub = url.searchParams.get('prefix') || '';
      const listPrefix = base + sub;
      if (!safeKey(listPrefix, base)) return json({ error: 'bad prefix' }, 400);
      const res = await env.ASSETS.list({
        prefix: listPrefix,
        cursor: url.searchParams.get('cursor') || undefined,
        limit: MAX_PAGE,
      });
      return json({
        prefix: base,
        items: res.objects
          .filter(o => ext.test(o.key) && !o.key.startsWith(base + TRASH))
          .map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded })),
        cursor: res.truncated ? res.cursor : null,
        truncated: res.truncated,
      });
    }

    if (url.pathname === '/file') {
      const key = url.searchParams.get('key') || '';
      // Narration audio is readable only; every write below is limited to the image prefix.
      const isAudio = !!audioPrefix && key.startsWith(audioPrefix) && safeKey(key, audioPrefix) && !key.startsWith(audioPrefix + TRASH) && AUDIO_EXT.test(key);
      const isImage = safeKey(key, prefix) && !key.startsWith(prefix + TRASH) && IMAGE_EXT.test(key);
      if (request.method === 'GET' ? !(isImage || isAudio) : !isImage) return json({ error: 'bad key' }, 400);

      if (request.method === 'GET') {
        const obj = await env.ASSETS.get(key);
        if (!obj) return json({ error: 'not found' }, 404);
        const headers = new Headers(cors);
        obj.writeHttpMetadata(headers);
        headers.set('ETag', obj.httpEtag);
        headers.set('Cache-Control', 'private, max-age=3600');
        headers.set('X-Content-Type-Options', 'nosniff');
        // Neutralise active content (e.g. a script inside an SVG) if the URL is ever opened directly.
        headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        return new Response(obj.body, { headers });
      }

      if (request.method === 'PUT') {
        if (!KEY_CHARS.test(key)) return json({ error: 'bad key characters' }, 400);
        const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
        if (!type.startsWith('image/')) return json({ error: 'only images' }, 415);
        const declared = parseInt(request.headers.get('Content-Length') || '0', 10);
        if (declared > MAX_UPLOAD) return json({ error: 'too large (max 20 MB)' }, 413);
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength === 0) return json({ error: 'empty body' }, 400);
        if (bytes.byteLength > MAX_UPLOAD) return json({ error: 'too large (max 20 MB)' }, 413);
        if (!looksLikeImage(new Uint8Array(bytes), key)) return json({ error: 'not a valid image' }, 415);
        if (url.searchParams.get('overwrite') !== '1' && await env.ASSETS.head(key)) return json({ error: 'already exists' }, 409);
        await env.ASSETS.put(key, bytes, { httpMetadata: { contentType: type } });
        return json({ key, size: bytes.byteLength }, 201);
      }

      if (request.method === 'DELETE') {
        // Soft delete: copy under <PREFIX>.trash/<timestamp>/ then remove the original.
        const obj = await env.ASSETS.get(key);
        if (!obj) return json({ error: 'not found' }, 404);
        const trashKey = `${prefix}${TRASH}${Date.now()}/${key.slice(prefix.length)}`;
        await env.ASSETS.put(trashKey, obj.body, { httpMetadata: obj.httpMetadata, customMetadata: { originalKey: key } });
        await env.ASSETS.delete(key);
        return json({ trashed: trashKey });
      }
    }

    return json({ error: 'not found' }, 404);
  },
};

function safeKey(key, prefix) {
  return key.startsWith(prefix) && !key.includes('..') && !key.startsWith('/') && !key.includes('//');
}

// Cheap content sniffing so a renamed non-image can't be stored under an image name.
function looksLikeImage(b, key) {
  const eq = (off, sig) => sig.every((v, i) => b[off + i] === v);
  if (/\.png$/i.test(key)) return eq(0, [0x89, 0x50, 0x4e, 0x47]);
  if (/\.jpe?g$/i.test(key)) return eq(0, [0xff, 0xd8, 0xff]);
  if (/\.gif$/i.test(key)) return eq(0, [0x47, 0x49, 0x46, 0x38]);
  if (/\.webp$/i.test(key)) return eq(0, [0x52, 0x49, 0x46, 0x46]) && eq(8, [0x57, 0x45, 0x42, 0x50]);
  if (/\.avif$/i.test(key)) return eq(4, [0x66, 0x74, 0x79, 0x70]);
  if (/\.svg$/i.test(key)) return /<svg[\s>]/i.test(new TextDecoder().decode(b.slice(0, 2048)));
  return false;
}

// Constant-time comparison of SHA-256 digests, so the token length/content doesn't leak by timing.
async function tokenOk(request, expected) {
  if (!expected) return false; // a missing secret means "closed", never "open by accident"
  const header = request.headers.get('Authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
