const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSubmission, QUESTIONS, handler: submitHandler } = require('../netlify/functions/submit');
const { safeEqual, handler: adminHandler } = require('../netlify/functions/admin');
const good = { name: 'Auntie Priya', prediction: 'GIRL', requestId: '123e4567-e89b-12d3-a456-426614174000', answers: Object.fromEntries(Object.entries(QUESTIONS).map(([key, values]) => [key, values[0]])) };
test('accepts complete answer set and normal name', () => assert.equal(validateSubmission(good), null));
test('rejects missing and oversized names', () => {
  assert.match(validateSubmission({ ...good, name: '  ' }), /valid name/);
  assert.match(validateSubmission({ ...good, name: 'x'.repeat(61) }), /valid name/);
});
test('rejects invalid prediction and omitted answers', () => {
  assert.match(validateSubmission({ ...good, prediction: 'UNKNOWN' }), /Boy or Girl/);
  const answers = { ...good.answers }; delete answers.q9;
  assert.match(validateSubmission({ ...good, answers }), /all nine/);
});
test('rejects answers outside published choices and extra fields', () => {
  assert.match(validateSubmission({ ...good, answers: { ...good.answers, q1: '9 December<script>' } }), /invalid/);
  assert.match(validateSubmission({ ...good, answers: { ...good.answers, surprise: 'value' } }), /all nine/);
});
test('compares organiser passwords without accepting a length mismatch', () => {
  assert.equal(safeEqual('same', 'same'), true);
  assert.equal(safeEqual('same', 'different'), false);
  assert.equal(safeEqual('same', 'same-but-longer'), false);
});
test('admin endpoint rejects unauthorized access before contacting Apps Script', async () => {
  process.env.GOOGLE_SCRIPT_URL = 'https://example.invalid/exec'; process.env.APP_SHARED_SECRET = 'shared'; process.env.ADMIN_PASSWORD = 'correct';
  const response = await adminHandler({ httpMethod: 'POST', headers: { authorization: 'Bearer wrong' }, body: '{}' });
  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).ok, false);
});
test('reveals the Netlify environment gender only after a server score of at least eight', async () => {
  process.env.GOOGLE_SCRIPT_URL = 'https://example.invalid/exec';
  process.env.APP_SHARED_SECRET = 'shared';
  process.env.BABY_GENDER = 'GIRL';
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, score: 7 }) });
    const body = JSON.stringify(good);
    const retry = await submitHandler({ httpMethod: 'POST', body });
    assert.equal(JSON.parse(retry.body).eligible, false);
    assert.equal(JSON.parse(retry.body).gender, undefined);

    global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, score: 8 }) });
    const reveal = await submitHandler({ httpMethod: 'POST', body });
    assert.equal(JSON.parse(reveal.body).eligible, true);
    assert.equal(JSON.parse(reveal.body).gender, 'GIRL');
  } finally { global.fetch = originalFetch; }
});
