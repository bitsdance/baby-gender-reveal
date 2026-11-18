/** Baby Reveal private response store. Configure SPREADSHEET_ID and APP_SHARED_SECRET in Script Properties. */
const ANSWER_KEY_ = { q1: '9 December', q2: '7 November', q3: 'Scorpio', q4: 'Lister Hospital', q5: 'Papa', q6: 'Mama', q7: 'Papa', q8: 'Everyone', q9: 'Everyone, including friends and family' };
const HEADERS_ = ['Submitted at', 'Guest name', 'Gender prediction', 'Q1 – Due date', 'Q2 – Baby shower', 'Q3 – Sun sign', 'Q4 – Last outing', 'Q5 – Game creator', 'Q6 – Google every sneeze', 'Q7 – Fall asleep first', 'Q8 – Wrapped around finger', 'Q9 – Most unnecessary shopping', 'Quiz score', 'Request ID'];
function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const props = PropertiesService.getScriptProperties();
    const expected = props.getProperty('APP_SHARED_SECRET');
    if (!expected || !constantTimeEquals_(String(data.secret || ''), expected)) return output_({ ok: false, error: 'Unauthorised' });
    if (data.action === 'save') return saveEntry_(data, props);
    if (data.action === 'list') return listEntries_(props);
    return output_({ ok: false, error: 'Unknown action' });
  } catch (err) { return output_({ ok: false, error: 'Request could not be processed.' }); }
}
function saveEntry_(data, props) {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const prediction = String(data.prediction || '').toUpperCase();
  const answers = data.answers;
  const requestId = String(data.requestId || '');
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name) || !['BOY', 'GIRL'].includes(prediction) || !validAnswers_(answers) || !/^[0-9a-f-]{36}$/i.test(requestId)) return output_({ ok: false, error: 'Invalid entry' });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    let sheet = ss.getSheetByName('Responses');
    if (!sheet) sheet = ss.insertSheet('Responses');
    if (sheet.getLastRow() === 0) { sheet.appendRow(HEADERS_); sheet.setFrozenRows(1); }
    const score = Object.keys(ANSWER_KEY_).reduce((total, key) => total + (answers[key] === ANSWER_KEY_[key] ? 1 : 0), 0);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const duplicate = sheet.getRange(2, 14, lastRow - 1, 1).createTextFinder(requestId).matchEntireCell(true).findNext();
      if (duplicate) return output_({ ok: true, duplicate: true, score: Number(sheet.getRange(duplicate.getRow(), 13).getValue()) || 0 });
    }
    const safeAnswers = Object.keys(ANSWER_KEY_).map(key => clean_(answers[key]));
    sheet.appendRow([new Date(), clean_(name), prediction, ...safeAnswers, score, requestId]);
    return output_({ ok: true, score });
  } finally { lock.releaseLock(); }
}
function listEntries_(props) {
  const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  const sheet = ss.getSheetByName('Responses');
  if (!sheet || sheet.getLastRow() < 2) return output_({ ok: true, rows: [] });
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).map(r => ({ submittedAt: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), name: String(r[1] || ''), prediction: String(r[2] || ''), answers: Object.fromEntries(Object.keys(ANSWER_KEY_).map((key, i) => [key, String(r[i + 3] || '')])), score: Number(r[12]) || 0 }));
  return output_({ ok: true, rows });
}
function validAnswers_(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
  const keys = Object.keys(answers).sort();
  const expected = Object.keys(ANSWER_KEY_).sort();
  if (keys.join('|') !== expected.join('|')) return false;
  const allowed = {
    q1: ['8 December', '9 December', '10 December', '11 December'], q2: ['6 November', '7 November', '8 November', '9 November'],
    q3: ['Libra', 'Scorpio', 'Sagittarius', 'Capricorn'], q4: ["Sainsbury's", 'Restaurant', "Friend's house", 'Lister Hospital'],
    q5: ['Mama', 'Papa', 'ChatGPT', 'Claude'], q6: ['Mama', 'Papa', 'Both', 'Grandparents'], q7: ['Mama', 'Papa', 'Both', 'Nobody'],
    q8: ['Mama', 'Papa', 'Dadaji and Nana', 'Everyone'], q9: ['Mama', 'Papa', 'Grandparents', 'Everyone, including friends and family']
  };
  return expected.every(key => typeof answers[key] === 'string' && allowed[key].includes(answers[key]));
}
function clean_(value) { const text = String(value == null ? '' : value).replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 300); return /^[=+@-]/.test(text) ? "'" + text : text; }
function constantTimeEquals_(a, b) { const aa = Utilities.newBlob(a).getBytes(); const bb = Utilities.newBlob(b).getBytes(); if (aa.length !== bb.length) return false; let diff = 0; for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i]; return diff === 0; }
function output_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
