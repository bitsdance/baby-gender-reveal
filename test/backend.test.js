const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSubmission, QUESTIONS, QUALIFYING_SCORE, issueRevealToken, handler: submitHandler } = require('../netlify/functions/submit');
const { safeEqual, handler: adminHandler } = require('../netlify/functions/admin');
const { handler: revealHandler } = require('../netlify/functions/reveal');
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
test('uses seven of nine as the qualifying score', () => assert.equal(QUALIFYING_SCORE, 7));
test('qualifying submissions return corrections and a reveal token, but no gender', async () => {
  process.env.GOOGLE_SCRIPT_URL = 'https://example.invalid/exec';
  process.env.APP_SHARED_SECRET = 'shared';
  process.env.BABY_GENDER = 'GIRL';
  const originalFetch = global.fetch;
  const answers = { ...good.answers, q1: '8 December', q2: '6 November', q3: 'Scorpio', q4: 'Lister Hospital', q5: 'Papa', q6: 'Mama', q7: 'Papa', q8: 'Everyone', q9: 'Everyone, including friends and family' };
  const sevenCorrect = { ...good, answers };
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, score: 7 }) });
    const response = await submitHandler({ httpMethod: 'POST', body: JSON.stringify(sevenCorrect) });
    const result = JSON.parse(response.body);
    assert.equal(result.eligible, true);
    assert.equal(result.gender, undefined);
    assert.equal(result.wrongAnswers.length, 2);
    assert.equal(result.wrongAnswers[0].correct, '9 December');
    assert.equal(result.wrongAnswers[1].correct, '7 November');
    assert.ok(result.revealToken);

    global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, score: 6 }) });
    const retry = await submitHandler({ httpMethod: 'POST', body: JSON.stringify(sevenCorrect) });
    assert.equal(JSON.parse(retry.body).eligible, false);
    assert.equal(JSON.parse(retry.body).gender, undefined);
    assert.equal(JSON.parse(retry.body).revealToken, undefined);
  } finally { global.fetch = originalFetch; }
});
test('reveal endpoint returns the gender only with a valid unexpired token', async () => {
  process.env.APP_SHARED_SECRET = 'shared';
  process.env.BABY_GENDER = 'GIRL';
  const token = issueRevealToken(good.requestId, 'shared');
  const reveal = await revealHandler({ httpMethod: 'POST', body: JSON.stringify({ token }) });
  assert.equal(reveal.statusCode, 200);
  assert.equal(JSON.parse(reveal.body).gender, 'GIRL');

  const rejected = await revealHandler({ httpMethod: 'POST', body: JSON.stringify({ token: `${token}x` }) });
  assert.equal(rejected.statusCode, 401);
});
