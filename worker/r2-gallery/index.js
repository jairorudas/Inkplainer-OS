// Read-only gallery for a private R2 bucket, used by Inkplainer's "Import from R2".
//
//   GET /list?prefix=&cursor=   -> { items: [{ key, size, uploaded }], cursor, truncated }
//   GET /file?key=              -> the image bytes
//
// Bindings / variables (see README.md):
//   ASSETS           R2 bucket binding (only ever read from here)
//   API_TOKEN        secret; every request must send "Authorization: Bearer <token>"
//   ALLOWED_ORIGINS  comma-separated origins allowed by CORS, e.g. "http://localhost:8123,https://app.example.com"
//   PREFIX           folder that may be listed/read, e.g. "production/" (default: whole bucket)

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const MAX_PAGE = 100;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const corsOk = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': corsOk ? origin : 'null',
      'Access-Control-Allow-Headers': 'Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: corsOk ? 204 : 403, headers: cors });
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);
    // Browsers always send Origin on cross-origin fetches; refuse anything not on the list.
    if (!corsOk) return json({ error: 'origin not allowed' }, 403);
    if (!(await tokenOk(request, env))) return json({ error: 'unauthorized' }, 401);

    const prefix = env.PREFIX || '';
    const url = new URL(request.url);

    if (url.pathname === '/list') {
      const sub = url.searchParams.get('prefix') || '';
      const listPrefix = prefix + sub;
      if (!safeKey(listPrefix, prefix)) return json({ error: 'bad prefix' }, 400);
      const res = await env.ASSETS.list({
        prefix: listPrefix,
        cursor: url.searchParams.get('cursor') || undefined,
        limit: MAX_PAGE,
      });
      return json({
        items: res.objects
          .filter(o => IMAGE_EXT.test(o.key))
          .map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded })),
        cursor: res.truncated ? res.cursor : null,
        truncated: res.truncated,
      });
    }

    if (url.pathname === '/file') {
      const key = url.searchParams.get('key') || '';
      if (!safeKey(key, prefix) || !IMAGE_EXT.test(key)) return json({ error: 'bad key' }, 400);
      const obj = await env.ASSETS.get(key);
      if (!obj) return json({ error: 'not found' }, 404);
      const headers = new Headers(cors);
      obj.writeHttpMetadata(headers);
      headers.set('ETag', obj.httpEtag);
      headers.set('Cache-Control', 'private, max-age=3600');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(obj.body, { headers });
    }

    return json({ error: 'not found' }, 404);
  },
};

function safeKey(key, prefix) {
  return key.startsWith(prefix) && !key.includes('..') && !key.startsWith('/');
}

// Constant-time comparison of SHA-256 digests, so the token length/content doesn't leak by timing.
async function tokenOk(request, env) {
  if (!env.API_TOKEN) return false; // never run open by accident
  const header = request.headers.get('Authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(env.API_TOKEN)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
