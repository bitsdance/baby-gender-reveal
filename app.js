const questions = [
  { key: 'q1', title: 'When is the baby originally due?', options: ['8 December', '9 December', '10 December', '11 December'] },
  { key: 'q2', title: "When was Surabhi's baby shower?", options: ['6 November', '7 November', '8 November', '9 November'] },
  { key: 'q3', title: "What is Surabhi's zodiac sun sign?", options: ['Libra', 'Scorpio', 'Sagittarius', 'Capricorn'] },
  { key: 'q4', title: "Where was Surabhi's last outing outside the home?", options: ["Sainsbury's", 'Restaurant', "Friend's house", 'Lister Hospital'] },
  { key: 'q5', title: 'Who do you think built this game?', options: ['Mama', 'Papa', 'ChatGPT', 'Claude'] },
  { key: 'q6', title: 'Who will Google every tiny baby sneeze?', options: ['Mama', 'Papa', 'Both', 'Grandparents'] },
  { key: 'q7', title: 'Who will fall asleep first while putting baby to sleep?', options: ['Mama', 'Papa', 'Both', 'Nobody'] },
  { key: 'q8', title: 'Who will baby have wrapped around their little finger?', options: ['Mama', 'Papa', 'Dadaji and Nana', 'Everyone'] },
  { key: 'q9', title: 'Who will spoil this baby with the most unnecessary shopping?', options: ['Mama', 'Papa', 'Grandparents', 'Everyone, including friends and family'] }
];
const steps = ['name', ...questions.map(q => q.key), 'prediction'];
const answers = {};
let name = '';
let step = -1;
let submitting = false;
const $ = id => document.getElementById(id);
const welcome = $('welcome'), quiz = $('quiz'), resultPanel = $('result');
const progress = $('progress-wrap'), content = $('quiz-content');

document.querySelector('[data-start]').addEventListener('click', () => { step = 0; welcome.hidden = true; quiz.hidden = false; progress.hidden = false; renderStep(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('back-button').addEventListener('click', () => { if (step > 0) { step--; renderStep(); } else { quiz.hidden = true; welcome.hidden = false; progress.hidden = true; } });
$('next-button').addEventListener('click', advance);
$('retry-button').addEventListener('click', () => {
  for (const question of questions) delete answers[question.key];
  delete answers.prediction;
  step = 1;
  resultPanel.hidden = true;
  resultPanel.classList.remove('reveal-active');
  $('incorrect-result').hidden = true;
  progress.hidden = false;
  quiz.hidden = false;
  $('next-button').disabled = false;
  $('back-button').disabled = false;
  renderStep();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function renderStep() {
  const current = steps[step];
  const quizNumber = Math.max(0, step);
  $('step-label').textContent = current === 'name' ? 'First, a little introduction' : current === 'prediction' ? 'Your big guess' : 'How well do you know Mama and Papa?';
  $('step-count').textContent = current === 'name' ? 'Your name' : current === 'prediction' ? 'Final question' : `Question ${quizNumber} of 9`;
  $('progress-fill').style.width = `${Math.round(((step + 1) / steps.length) * 100)}%`;
  $('back-button').textContent = step === 0 ? '← Welcome' : '← Back';
  $('next-button').innerHTML = current === 'prediction' ? 'Send my answers <span>♡</span>' : 'Continue <span>→</span>';
  if (current === 'name') {
    content.innerHTML = `<p class="question-number">LET'S GET TO KNOW YOU</p><h2>What should I call you?</h2><label class="field">Your name<input id="guest-name" type="text" maxlength="60" autocomplete="name" placeholder="e.g. Auntie Priya" required></label><p class="error" id="step-error" role="alert"></p>`;
    $('guest-name').value = name;
    $('guest-name').addEventListener('keydown', e => { if (e.key === 'Enter') advance(); });
  } else if (current === 'prediction') {
    content.innerHTML = `<p class="question-number">THE BIG QUESTION</p><h2>Do you think I'll be a...</h2><div class="options">${['Boy', 'Girl'].map(value => optionMarkup('prediction', value, answers.prediction)).join('')}</div><p class="error" id="step-error" role="alert"></p>`;
  } else {
    const q = questions.find(item => item.key === current);
    content.innerHTML = `<p class="question-number">A LITTLE FAMILY TRIVIA</p><h2>${escapeHtml(q.title)}</h2><div class="options">${q.options.map(value => optionMarkup(q.key, value, answers[q.key])).join('')}</div><p class="error" id="step-error" role="alert"></p>`;
  }
}
function optionMarkup(key, value, selected) {
  const id = `${key}-${Math.random().toString(36).slice(2, 8)}`;
  return `<label class="option" for="${id}"><input id="${id}" type="radio" name="${key}" value="${escapeHtml(value)}" ${selected === value ? 'checked' : ''}><span>${escapeHtml(value)}</span></label>`;
}
function advance() {
  if (submitting) return;
  const current = steps[step];
  if (current === 'name') {
    const field = $('guest-name');
    name = field.value.trim();
    if (!name) { field.focus(); $('step-error').textContent = 'Please tell me your name before we start.'; return; }
    if (name.length > 60) { $('step-error').textContent = 'Please keep your name to 60 characters or fewer.'; return; }
  } else {
    const selected = document.querySelector(`input[name="${current}"]:checked`);
    if (!selected) { $('step-error').textContent = 'Choose one little answer to continue.'; return; }
    answers[current] = selected.value;
  }
  if (current === 'prediction') return submitEntry();
  step++;
  renderStep();
}
async function submitEntry() {
  submitting = true;
  const button = $('next-button');
  button.disabled = true;
  button.textContent = 'Sending…';
  $('back-button').disabled = true;
  try {
    const entry = { name, prediction: answers.prediction.toUpperCase(), answers: Object.fromEntries(questions.map(q => [q.key, answers[q.key]])) };
    const requestId = getRequestId(entry);
    const response = await fetch('/.netlify/functions/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...entry, requestId }) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'I could not send that just now. Please try again.');
    localStorage.removeItem('babyRevealRequest');
    quiz.hidden = true; progress.hidden = true; resultPanel.hidden = false;
    if (result.eligible && ['BOY', 'GIRL'].includes(result.gender)) {
      $('incorrect-result').hidden = true;
      $('reveal-result').hidden = false;
      $('reveal-title').textContent = `It's a ${result.gender === 'BOY' ? 'Boy' : 'Girl'}!`;
      $('reveal-copy').textContent = `Thank you for playing, ${name}. Our little one is already surrounded by so much love.`;
      resultPanel.classList.remove('reveal-active');
      requestAnimationFrame(() => resultPanel.classList.add('reveal-active'));
    } else {
      $('reveal-result').hidden = true;
      $('incorrect-result').hidden = false;
      $('retry-name').textContent = name + '!';
      resultPanel.classList.remove('reveal-active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    $('step-error').textContent = error.message || 'Something went wrong. Please try again.';
    button.disabled = false; button.innerHTML = 'Try again <span>↻</span>'; $('back-button').disabled = false;
  } finally { submitting = false; }
}
function getRequestId(entry) {
  const payload = JSON.stringify(entry);
  let saved;
  try { saved = JSON.parse(localStorage.getItem('babyRevealRequest') || 'null'); } catch { saved = null; }
  if (!saved || saved.payload !== payload) {
    saved = { payload, id: crypto.randomUUID() };
    localStorage.setItem('babyRevealRequest', JSON.stringify(saved));
  }
  return saved.id;
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
