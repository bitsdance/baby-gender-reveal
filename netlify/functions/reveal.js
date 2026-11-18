const { createHmac, timingSafeEqual } = require('node:crypto');

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
  const secret = process.env.APP_SHARED_SECRET;
  const gender = String(process.env.BABY_GENDER || '').toUpperCase();
  if (!secret || !['BOY', 'GIRL'].includes(gender)) return json(503, { ok: false, error: 'The reveal is not configured yet.' });

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Please try again; the request was not readable.' }); }
  const token = data && typeof data === 'object' && !Array.isArray(data) ? data.token : '';
  if (!verifyRevealToken(token, secret)) return json(401, { ok: false, error: 'This reveal session expired. Please play again.' });
  return json(200, { ok: true, gender });
};

function verifyRevealToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 512) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, suppliedSignature] = parts;
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64url');
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims.requestId === 'string'
      && /^[0-9a-f-]{36}$/i.test(claims.requestId)
      && Number.isFinite(claims.exp)
      && now <= claims.exp;
  } catch { return false; }
}

function json(statusCode, body, headers = {}) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }, body: JSON.stringify(body) };
}

exports.verifyRevealToken = verifyRevealToken;
