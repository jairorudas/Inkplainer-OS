// Cloudflare Pages Function: checks the access token against the ACCESS_TOKEN environment variable.
//   GET  /api/login            -> { required: true | false }   (false when ACCESS_TOKEN is not set: the gate stays off)
//   POST /api/login {token}    -> 200 { ok: true } | 401 { ok: false }
// Set it in Pages > Settings > Variables and secrets (or `wrangler pages secret put ACCESS_TOKEN`).
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Compare digests, not the strings, so the check takes the same time wherever they differ.
async function same(a, b) {
  const enc = new TextEncoder(), h = s => crypto.subtle.digest('SHA-256', enc.encode(s));
  const [x, y] = await Promise.all([h(a), h(b)]);
  const A = new Uint8Array(x), B = new Uint8Array(y); let d = 0;
  for (let i = 0; i < A.length; i++) d |= A[i] ^ B[i];
  return d === 0;
}

export async function onRequest({ request, env }) {
  const want = env.ACCESS_TOKEN;
  if (!want) return json({ required: false });
  if (request.method === 'GET') return json({ required: true });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let got = '';
  try { got = String((await request.json()).token || ''); } catch (e) {}
  const ok = await same(got, want);
  return json({ ok }, ok ? 200 : 401);
}
