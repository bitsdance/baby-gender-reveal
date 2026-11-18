const questionLabels = ['Due date', 'Baby shower', 'Sun sign', 'Last outing', 'Game creator', 'Google every sneeze', 'Fall asleep first', 'Wrapped around finger', 'Shopping'];
let currentRows = [];
const $ = id => document.getElementById(id);
$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('login-error').textContent = '';
  const password = $('password').value;
  try {
    const result = await loadRows(password);
    renderDashboard(result.rows || []);
    $('password').value = '';
  } catch (error) { $('login-error').textContent = error.message; }
});
$('logout-button').addEventListener('click', () => { $('dashboard').hidden = true; $('login-box').hidden = false; $('password').value = ''; });
$('export-button').addEventListener('click', exportCsv);
async function loadRows(password) {
  const response = await fetch('/.netlify/functions/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }, body: '{}' });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to open the dashboard.');
  return result;
}
function renderDashboard(rows) {
  currentRows = rows;
  $('login-box').hidden = true; $('dashboard').hidden = false;
  $('response-count').textContent = `${rows.length} ${rows.length === 1 ? 'little guess' : 'little guesses'} received`;
  const boys = rows.filter(row => String(row.prediction).toUpperCase() === 'BOY').length;
  const girls = rows.filter(row => String(row.prediction).toUpperCase() === 'GIRL').length;
  const percent = count => rows.length ? `${Math.round(count / rows.length * 100)}%` : '0%';
  $('stats').innerHTML = statMarkup(rows.length, 'TOTAL GUESSES') + statMarkup(boys, `BOY · ${percent(boys)}`) + statMarkup(girls, `GIRL · ${percent(girls)}`);
  const popular = questionLabels.map((label, i) => {
    const counts = {};
    rows.forEach(row => { const value = row.answers?.[`q${i+1}`]; if (value) counts[value] = (counts[value] || 0) + 1; });
    const top = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
    return `<div class="popular-item"><b>${escapeHtml(label)}:</b> ${top ? `${escapeHtml(top[0])} (${top[1]})` : 'No answers yet'}</div>`;
  }).join('');
  $('popular').innerHTML = `<h2>Most popular answers</h2><div class="popular-grid">${popular}</div>`;
  $('rows').innerHTML = rows.map((row, index) => `<tr><td>${escapeHtml(row.name || '')}</td><td>${escapeHtml(row.prediction || '')}</td><td>${Number(row.score || 0)} / 9</td><td>${escapeHtml(formatDate(row.submittedAt))}</td><td><button class="expand" data-row="${index}">View answers</button><div class="answer-list" id="answers-${index}" hidden>${questionLabels.map((label,i) => `<div><b>${i+1}. ${escapeHtml(label)}:</b> ${escapeHtml(row.answers?.[`q${i+1}`] || '—')}</div>`).join('')}</div></td></tr>`).join('');
  document.querySelectorAll('.expand').forEach(button => button.addEventListener('click', () => { const box = $(`answers-${button.dataset.row}`); box.hidden = !box.hidden; button.textContent = box.hidden ? 'View answers' : 'Hide answers'; }));
}
function statMarkup(value, label) { return `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`; }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? String(value || '') : date.toLocaleString(); }
function exportCsv() {
  const headers = ['Submitted at', 'Guest name', 'Gender prediction', 'Quiz score', ...questionLabels.map((label,i) => `Q${i+1}: ${label}`)];
  const rows = currentRows.map(row => [row.submittedAt, row.name, row.prediction, row.score, ...questionLabels.map((_,i) => row.answers?.[`q${i+1}`] || '')]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'baby-reveal-submissions.csv'; link.click(); URL.revokeObjectURL(url);
}
function csvCell(value) { let text = String(value ?? ''); if (/^[=+@\-]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
