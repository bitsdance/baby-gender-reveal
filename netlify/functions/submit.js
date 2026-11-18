const { createHmac, randomUUID } = require('node:crypto');
const QUALIFYING_SCORE = 7;
const QUESTIONS = {
  q1: ['8 December', '9 December', '10 December', '11 December'],
  q2: ['6 November', '7 November', '8 November', '9 November'],
  q3: ['Libra', 'Scorpio', 'Sagittarius', 'Capricorn'],
  q4: ["Sainsbury's", 'Restaurant', "Friend's house", 'Lister Hospital'],
  q5: ['Mama', 'Papa', 'ChatGPT', 'Claude'],
  q6: ['Mama', 'Papa', 'Both', 'Grandparents'],
  q7: ['Mama', 'Papa', 'Both', 'Nobody'],
  q8: ['Mama', 'Papa', 'Dadaji and Nana', 'Everyone'],
  q9: ['Mama', 'Papa', 'Grandparents', 'Everyone, including friends and family']
};
const ANSWER_KEY = {
  q1: '9 December', q2: '7 November', q3: 'Scorpio', q4: 'Lister Hospital',
  q5: 'Papa', q6: 'Mama', q7: 'Papa', q8: 'Everyone',
  q9: 'Everyone, including friends and family'
};
const QUESTION_TITLES = {
  q1: 'When is the baby originally due?',
  q2: "When was Surabhi's baby shower?",
  q3: "What is Surabhi's zodiac sun sign?",
  q4: "Where was Surabhi's last outing outside the home?",
  q5: 'Who do you think built this game?',
  q6: 'Who will Google every tiny baby sneeze?',
  q7: 'Who will fall asleep first while putting baby to sleep?',
  q8: "Who will baby have wrapped around their little finger?",
  q9: 'Who will spoil this baby with the most unnecessary shopping?'
};
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.APP_SHARED_SECRET;
  const babyGender = String(process.env.BABY_GENDER || '').toUpperCase();
  if (!scriptUrl || !secret) return json(503, { ok: false, error: 'The submission service is not configured yet.' });
  if (!['BOY', 'GIRL'].includes(babyGender)) return json(503, { ok: false, error: 'The reveal is not configured yet.' });
  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Please try again; the request was not readable.' }); }
  const issue = validateSubmission(data);
  if (issue) return json(400, { ok: false, error: issue });
  const payload = { action: 'save', secret, requestId: data.requestId || randomUUID(), name: data.name.trim(), prediction: data.prediction.toUpperCase(), answers: data.answers };
  try {
    const upstream = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) });
    const result = await upstream.json();
    if (!upstream.ok || !result.ok) return json(502, { ok: false, error: 'Could not save your entry. Please try again.' });
    const score = Number(result.score);
    if (!Number.isInteger(score) || score < 0 || score > 9) return json(502, { ok: false, error: 'The response store returned an invalid score.' });
    const eligible = score >= QUALIFYING_SCORE;
    if (!eligible) return json(200, { ok: true, eligible, score });
    const wrongAnswers = Object.keys(ANSWER_KEY)
      .filter(key => data.answers[key] !== ANSWER_KEY[key])
      .map(key => ({ question: QUESTION_TITLES[key], selected: data.answers[key], correct: ANSWER_KEY[key] }));
    const revealToken = issueRevealToken(payload.requestId, secret);
    return json(200, { ok: true, eligible, score, wrongAnswers, revealToken });
  } catch { return json(502, { ok: false, error: 'Could not reach the response store. Please try again.' }); }
};
function validateSubmission(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Please send a valid entry.';
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 60 || /[\u0000-\u001f\u007f]/.test(data.name)) return 'Please enter a valid name of 1 to 60 characters.';
  if (typeof data.prediction !== 'string' || !['BOY', 'GIRL'].includes(data.prediction.toUpperCase())) return 'Please choose Boy or Girl.';
  if (!data.answers || typeof data.answers !== 'object' || Array.isArray(data.answers)) return 'Quiz answers are missing.';
  const keys = Object.keys(data.answers).sort();
  if (keys.join(',') !== Object.keys(QUESTIONS).sort().join(',')) return 'Please answer all nine quiz questions.';
  for (const [key, choices] of Object.entries(QUESTIONS)) if (typeof data.answers[key] !== 'string' || !choices.includes(data.answers[key])) return 'One of your quiz answers is invalid. Please check your answers.';
  if (data.requestId != null && (typeof data.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.requestId))) return 'Please refresh the page and send your entry again.';
  return null;
}
function json(statusCode, body, headers = {}) { return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }, body: JSON.stringify(body) }; }
exports.validateSubmission = validateSubmission;
exports.QUESTIONS = QUESTIONS;
exports.QUALIFYING_SCORE = QUALIFYING_SCORE;
exports.issueRevealToken = issueRevealToken;
function issueRevealToken(requestId, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ requestId, exp: now + 20 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
