const crypto = require('node:crypto');
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.APP_SHARED_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!scriptUrl || !secret || !adminPassword) return json(503, { ok: false, error: 'The dashboard is not configured yet.' });
  const supplied = (event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(supplied, adminPassword)) return json(401, { ok: false, error: 'Incorrect organiser password.' });
  try {
    const upstream = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'list', secret }), signal: AbortSignal.timeout(12000) });
    const result = await upstream.json();
    if (!upstream.ok || !result.ok || !Array.isArray(result.rows)) return json(502, { ok: false, error: 'Could not load submissions.' });
    return json(200, { ok: true, rows: result.rows.map(row => ({ submittedAt: row.submittedAt, name: row.name, prediction: row.prediction, score: Number(row.score) || 0, answers: row.answers })) });
  } catch { return json(502, { ok: false, error: 'Could not reach the response store.' }); }
};
function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  const paddedX = Buffer.alloc(256); const paddedY = Buffer.alloc(256);
  if (x.length > 256 || y.length > 256) return false;
  x.copy(paddedX); y.copy(paddedY);
  return crypto.timingSafeEqual(paddedX, paddedY) && x.length === y.length;
}
function json(statusCode, body, headers = {}) { return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }, body: JSON.stringify(body) }; }
exports.safeEqual = safeEqual;
