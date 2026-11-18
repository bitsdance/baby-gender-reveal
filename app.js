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
let confettiFrame = 0;
let revealToken = '';
let gameUnlocked = false;
let revealPending = false;
const $ = id => document.getElementById(id);
const welcome = $('welcome'), quiz = $('quiz'), resultPanel = $('result');
const progress = $('progress-wrap'), content = $('quiz-content');

document.querySelector('[data-start]').addEventListener('click', () => { step = 0; welcome.hidden = true; quiz.hidden = false; progress.hidden = false; renderStep(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('back-button').addEventListener('click', () => { if (step > 0) { step--; renderStep(); } else { quiz.hidden = true; welcome.hidden = false; progress.hidden = true; } });
$('next-button').addEventListener('click', advance);
$('continue-game-button').addEventListener('click', startMiniGame);
$('final-reveal-button').addEventListener('click', revealBaby);
$('retry-button').addEventListener('click', () => {
  for (const question of questions) delete answers[question.key];
  delete answers.prediction;
  step = 1;
  resultPanel.hidden = true;
  resultPanel.classList.remove('reveal-active');
  resultPanel.removeAttribute('data-gender');
  $('incorrect-result').hidden = true;
  $('feedback-result').hidden = true;
  $('minigame-result').hidden = true;
  $('reveal-result').hidden = true;
  $('final-reveal-button').hidden = true;
  revealToken = '';
  gameUnlocked = false;
  revealPending = false;
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
  $('back-button').textContent = step === 0 ? '\u2190 Welcome' : '\u2190 Back';
  $('next-button').innerHTML = current === 'prediction' ? 'Send my answers <span>\u2661</span>' : 'Continue <span>\u2192</span>';
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
  button.textContent = 'Sending\u2026';
  $('back-button').disabled = true;
  try {
    const entry = { name, prediction: answers.prediction.toUpperCase(), answers: Object.fromEntries(questions.map(q => [q.key, answers[q.key]])) };
    const requestId = getRequestId(entry);
    const response = await fetch('/.netlify/functions/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...entry, requestId }) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'I could not send that just now. Please try again.');
    if (result.eligible && (typeof result.revealToken !== 'string' || !Array.isArray(result.wrongAnswers))) throw new Error('I could not prepare the reveal. Please try again.');
    localStorage.removeItem('babyRevealRequest');
    quiz.hidden = true; progress.hidden = true; resultPanel.hidden = false;
    resultPanel.classList.remove('reveal-active');
    resultPanel.removeAttribute('data-gender');
    $('incorrect-result').hidden = true;
    $('feedback-result').hidden = true;
    $('minigame-result').hidden = true;
    $('reveal-result').hidden = true;
    if (result.eligible) {
      revealToken = result.revealToken;
      renderMissedAnswers(result.wrongAnswers);
      $('feedback-result').hidden = false;
    } else {
      $('incorrect-result').hidden = false;
      $('retry-name').textContent = name + '!';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    $('step-error').textContent = error.message || 'Something went wrong. Please try again.';
    button.disabled = false; button.innerHTML = 'Try again <span>\u21bb</span>'; $('back-button').disabled = false;
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
function renderMissedAnswers(wrongAnswers) {
  const count = wrongAnswers.length;
  $('feedback-copy').textContent = count
    ? `You got ${count} ${count === 1 ? 'answer' : 'answers'} wrong. Here are the right answers:`
    : 'Perfect score! You got every answer right.';
  $('missed-answers').innerHTML = wrongAnswers.map(item => `
    <li class="missed-answer">
      <span class="missed-question">${escapeHtml(item.question)}</span>
      <span class="answer-pair"><span>You chose</span><strong>${escapeHtml(item.selected)}</strong></span>
      <span class="answer-pair correct-answer"><span>The right answer</span><strong>${escapeHtml(item.correct)}</strong></span>
    </li>`).join('');
}
function startMiniGame() {
  $('feedback-result').hidden = true;
  $('minigame-result').hidden = false;
  $('final-reveal-button').hidden = true;
  $('final-reveal-button').disabled = false;
  $('final-reveal-button').innerHTML = 'Open the real reveal <span aria-hidden="true">&#10023;</span>';
  $('tile-board').innerHTML = '';
  $('game-progress').textContent = 'Pick a tile to begin.';
  gameUnlocked = false;
  revealPending = false;
  const tiles = shuffle(['BOY', 'BOY', 'BOY', 'BOY', 'GIRL', 'GIRL', 'GIRL', 'GIRL', 'STAR']);
  const counts = { BOY: 0, GIRL: 0 };
  tiles.forEach((value, index) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'game-tile';
    tile.textContent = '?';
    tile.setAttribute('aria-label', `Covered lucky tile ${index + 1}`);
    tile.dataset.value = value;
    tile.addEventListener('click', () => {
      if (tile.disabled || gameUnlocked) return;
      tile.disabled = true;
      tile.classList.add('is-revealed');
      if (value === 'STAR') {
        tile.classList.add('is-star');
        tile.textContent = '\u2726';
        tile.setAttribute('aria-label', 'Lucky star tile');
        $('game-progress').textContent = 'A lucky star! Pick another tile.';
        return;
      }
      counts[value]++;
      const label = value === 'BOY' ? 'Boy' : 'Girl';
      tile.textContent = label;
      tile.classList.add(value === 'BOY' ? 'is-boy' : 'is-girl');
      tile.setAttribute('aria-label', `${label} guess tile`);
      if (counts[value] >= 3) {
        gameUnlocked = true;
        $('tile-board').querySelectorAll('.game-tile:not(.is-revealed)').forEach(button => { button.disabled = true; });
        $('game-progress').textContent = `Three ${label} guesses! Your tiles were just for fun. The real answer is still waiting.`;
        $('final-reveal-button').hidden = false;
      } else {
        $('game-progress').textContent = `You have ${counts[value]} of 3 ${label} guesses. Keep picking.`;
      }
    });
    $('tile-board').appendChild(tile);
  });
}
async function revealBaby() {
  if (!gameUnlocked || revealPending || !revealToken) return;
  revealPending = true;
  const button = $('final-reveal-button');
  button.disabled = true;
  button.textContent = 'Opening the surprise\u2026';
  try {
    const response = await fetch('/.netlify/functions/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: revealToken })
    });
    const result = await response.json();
    if (!response.ok || !result.ok || !['BOY', 'GIRL'].includes(result.gender)) throw new Error(result.error || 'I could not open the reveal just yet. Please try again.');
    $('minigame-result').hidden = true;
    $('reveal-result').hidden = false;
    $('reveal-title').textContent = `It's a ${result.gender === 'BOY' ? 'Boy' : 'Girl'}!`;
    $('reveal-copy').textContent = `Thank you for playing, ${name}. Our little one is already surrounded by so much love.`;
    resultPanel.dataset.gender = result.gender;
    resultPanel.classList.remove('reveal-active');
    requestAnimationFrame(() => resultPanel.classList.add('reveal-active'));
    window.setTimeout(launchConfetti, 1200);
  } catch (error) {
    $('game-progress').textContent = error.message || 'I could not open the reveal just yet. Please try again.';
    button.disabled = false;
    button.innerHTML = 'Try the reveal again <span aria-hidden="true">&#10023;</span>';
    revealPending = false;
  }
}
function shuffle(items) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}
function launchConfetti() {
  const canvas = $('confetti-canvas');
  const context = canvas && canvas.getContext('2d');
  if (!canvas || !context || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (confettiFrame) cancelAnimationFrame(confettiFrame);

  const bounds = canvas.getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const palette = ['#d99bad', '#a9c7e6', '#c5a56e', '#f5dbe4', '#dceafb', '#fff9ec'];
  const shower = Array.from({ length: 220 }, () => ({
    x: Math.random() * width,
    y: -Math.random() * height * 0.8,
    vx: (Math.random() - 0.5) * 1.3,
    vy: Math.random() * 3.4 + 2.2,
    gravity: 0.025,
    size: Math.random() * 7 + 5,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.12,
    color: palette[Math.floor(Math.random() * palette.length)],
    round: Math.random() < 0.28
  }));
  const burst = Array.from({ length: 90 }, () => ({
    x: width / 2 + (Math.random() - 0.5) * 70,
    y: height * 0.47,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 12 - 3,
    gravity: 0.24,
    size: Math.random() * 8 + 5,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.16,
    color: palette[Math.floor(Math.random() * palette.length)],
    round: Math.random() < 0.25
  }));
  const pieces = [...shower, ...burst];
  const start = performance.now();

  function draw(now) {
    const elapsed = now - start;
    const fade = Math.max(0, 1 - Math.max(0, elapsed - 2600) / 1300);
    context.clearRect(0, 0, width, height);
    for (const piece of pieces) {
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.vy += piece.gravity;
      piece.rotation += piece.spin;
      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.globalAlpha = fade;
      context.fillStyle = piece.color;
      if (piece.round) {
        context.beginPath();
        context.ellipse(0, 0, piece.size * 0.48, piece.size * 0.34, 0, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(-piece.size * 0.42, -piece.size * 0.24, piece.size * 0.84, piece.size * 0.48);
      }
      context.restore();
    }
    if (elapsed < 3900 && pieces.some(piece => piece.y < height + piece.size)) {
      confettiFrame = requestAnimationFrame(draw);
    } else {
      context.clearRect(0, 0, width, height);
      confettiFrame = 0;
    }
  }

  confettiFrame = requestAnimationFrame(draw);
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
