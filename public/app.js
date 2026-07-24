import { CURATED_QUESTIONS } from './questions.js';
import { discoverQuestions } from './wiki.js';
import {
  buildChallengeUrl,
  decodeChallenge,
  encodeChallenge,
  escapeHtml,
  formatDuration,
  getChallengeFromHash,
  hashString,
  isCorrectAnswer,
  saveBestScore,
  scoreAnswer,
  shuffle
} from './utils.js';

const app = document.querySelector('#app');
const headerShareButton = document.querySelector('#share-header');
const loadingTemplate = document.querySelector('#loading-template');

const LABELS = {
  categories: {
    all: 'すべて', food: '食べ物', people: '人物', works: '作品', places: '場所', science: '科学', sports: 'スポーツ'
  },
  difficulties: { easy: 'やさしい', normal: 'ふつう', hard: 'むずかしい', mixed: 'まぜこぜ' }
};

const state = {
  challenge: null,
  encoded: null,
  shareUrl: null,
  index: 0,
  answers: [],
  startedAt: 0,
  questionStartedAt: 0,
  resolved: false,
  gaveUp: false
};

function clearState() {
  Object.assign(state, {
    challenge: null,
    encoded: null,
    shareUrl: null,
    index: 0,
    answers: [],
    startedAt: 0,
    questionStartedAt: 0,
    resolved: false,
    gaveUp: false
  });
}

function setHeaderShare(visible) {
  headerShareButton.classList.toggle('is-hidden', !visible);
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  existing?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 250);
  }, 1800);
}

function setLoading(message = 'Wikipediaを探索中…') {
  app.replaceChildren(loadingTemplate.content.cloneNode(true));
  const target = app.querySelector('[data-loading-message]');
  if (target) target.textContent = message;
}

function updateLoading(message) {
  const target = app.querySelector('[data-loading-message]');
  if (target) target.textContent = message;
}

function buildCuratedQuestions({ category, difficulty, count }) {
  const requestedCount = Math.min(10, Math.max(5, Number(count) || 5));
  const preferred = CURATED_QUESTIONS.filter((question) => {
    const categoryMatches = category === 'all' || question.category === category;
    const difficultyMatches = difficulty === 'mixed' || question.difficulty === difficulty;
    return categoryMatches && difficultyMatches;
  });
  const remainder = CURATED_QUESTIONS.filter((question) => !preferred.includes(question));
  const selected = [...shuffle(preferred), ...shuffle(remainder)].slice(0, requestedCount);
  const allTitles = CURATED_QUESTIONS.map((question) => question.title);
  return selected.map((question) => ({
    ...question,
    choices: shuffle([
      question.title,
      ...shuffle(allTitles.filter((title) => title !== question.title)).slice(0, 3)
    ])
  }));
}

function renderHome() {
  clearState();
  setHeaderShare(false);
  document.title = "What's This Wiki?｜目次だけで何の記事？";
  history.replaceState(null, '', `${location.pathname}${location.search}`);

  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow">OPEN. GUESS. SHARE.</p>
      <h1>目次だけで、<br><em>何の記事？</em></h1>
      <p class="hero-copy">ログインなし。Wikipediaの記事を目次だけで当てる、ちょっと変なクイズ。</p>
    </section>

    <section class="panel setup-panel">
      <form id="setup-form">
        <fieldset>
          <legend>問題の探し方</legend>
          <div class="segmented">
            <label><input type="radio" name="source" value="curated" checked><span>確認済み問題</span></label>
            <label><input type="radio" name="source" value="experimental"><span>Wikipedia探索 <small>実験</small></span></label>
          </div>
          <p id="source-note" class="field-note">遊びやすさを確認した問題から出題します。</p>
        </fieldset>

        <div class="field-grid">
          <label class="field">
            <span>ジャンル</span>
            <select name="category">
              ${Object.entries(LABELS.categories).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>難易度</span>
            <select name="difficulty">
              <option value="mixed">まぜこぜ</option>
              <option value="easy">やさしい</option>
              <option value="normal">ふつう</option>
              <option value="hard">むずかしい</option>
            </select>
          </label>
          <label class="field">
            <span>問題数</span>
            <select id="question-count" name="count">
              <option value="5">5問</option>
              <option value="10">10問</option>
            </select>
          </label>
        </div>

        <button class="button button-primary button-large" type="submit">すぐ遊ぶ <span aria-hidden="true">→</span></button>
      </form>
    </section>

    <section class="how-to">
      <article><strong>01</strong><span>目次を見る</span></article>
      <article><strong>02</strong><span>自由入力で答える</span></article>
      <article><strong>03</strong><span>無理なら自分でギブアップ</span></article>
      <article><strong>04</strong><span>同じ問題を友達へ送る</span></article>
    </section>
  `;

  const form = document.querySelector('#setup-form');
  const sourceNote = document.querySelector('#source-note');
  const countSelect = document.querySelector('#question-count');

  form.addEventListener('change', (event) => {
    if (event.target.name !== 'source') return;
    const experimental = event.target.value === 'experimental';
    sourceNote.textContent = experimental
      ? 'Wikipediaをその場で探索します。記事によっては難問・珍問になります。'
      : '遊びやすさを確認した問題から出題します。';
    countSelect.innerHTML = experimental
      ? '<option value="3">3問</option><option value="5" selected>5問</option>'
      : '<option value="5">5問</option><option value="10">10問</option>';
  });

  form.addEventListener('submit', createGameFromForm);
}

async function createGameFromForm(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const settings = Object.fromEntries(formData.entries());
  setLoading(settings.source === 'experimental' ? 'Wikipediaを探索中…' : '問題を準備中…');

  try {
    const questions = settings.source === 'experimental'
      ? await discoverQuestions({ ...settings, onProgress: updateLoading })
      : buildCuratedQuestions(settings);
    const challenge = {
      source: settings.source,
      category: settings.category,
      difficulty: settings.difficulty,
      questions
    };
    await prepareChallenge(challenge, { replaceHash: true });
    startGame();
  } catch (error) {
    renderError(error.message, renderHome);
  }
}

async function prepareChallenge(challenge, { replaceHash = false, encoded = null } = {}) {
  state.challenge = challenge;
  state.encoded = encoded || await encodeChallenge(challenge);
  state.shareUrl = buildChallengeUrl(state.encoded);
  if (replaceHash) history.replaceState(null, '', new URL(state.shareUrl).hash);
  setHeaderShare(true);
}

function renderSharedIntro(challenge, encoded) {
  clearState();
  state.challenge = challenge;
  state.encoded = encoded;
  state.shareUrl = buildChallengeUrl(encoded);
  setHeaderShare(true);
  document.title = `共有クイズ ${challenge.questions.length}問｜What's This Wiki?`;

  app.innerHTML = `
    <section class="panel invite-panel">
      <p class="eyebrow">A FRIEND SENT YOU THIS QUIZ</p>
      <div class="invite-icon">W?</div>
      <h1>同じ${challenge.questions.length}問に<br>挑戦しよう。</h1>
      <dl class="challenge-summary">
        <div><dt>問題数</dt><dd>${challenge.questions.length}問</dd></div>
        <div><dt>ジャンル</dt><dd>${escapeHtml(LABELS.categories[challenge.category] || 'まぜこぜ')}</dd></div>
        <div><dt>難易度</dt><dd>${escapeHtml(LABELS.difficulties[challenge.difficulty] || 'まぜこぜ')}</dd></div>
      </dl>
      <button id="start-shared" class="button button-primary button-large">挑戦する <span aria-hidden="true">→</span></button>
      <button id="back-home" class="button button-text">自分で問題を選ぶ</button>
    </section>
  `;
  document.querySelector('#start-shared').addEventListener('click', startGame);
  document.querySelector('#back-home').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    renderHome();
  });
}

function startGame() {
  state.index = 0;
  state.answers = [];
  state.startedAt = performance.now();
  renderQuestion();
}

function tocMarkup(sections) {
  return sections.map((section, index) => `
    <li style="--depth:${Math.max(0, Number(section.level || 1) - 1)}">
      <span class="toc-number">${index + 1}</span>
      <span>${escapeHtml(section.text)}</span>
    </li>
  `).join('');
}

function renderQuestion() {
  const question = state.challenge.questions[state.index];
  state.questionStartedAt = performance.now();
  state.resolved = false;
  state.gaveUp = false;
  document.title = `${state.index + 1}/${state.challenge.questions.length}｜What's This Wiki?`;

  app.innerHTML = `
    <section class="game-topbar">
      <div>
        <span class="progress-label">QUESTION ${state.index + 1} / ${state.challenge.questions.length}</span>
        <div class="progress-track"><span style="width:${((state.index + 1) / state.challenge.questions.length) * 100}%"></span></div>
      </div>
      <strong>${state.answers.reduce((sum, answer) => sum + answer.score, 0).toLocaleString()} pt</strong>
    </section>

    <section class="question-layout">
      <article class="panel toc-panel">
        <div class="panel-heading">
          <span>Wikipedia</span>
          <strong>CONTENTS</strong>
        </div>
        <ol class="toc-list">${tocMarkup(question.sections)}</ol>
      </article>

      <aside class="answer-panel">
        <div id="answer-area">
          <p class="answer-kicker">この記事は何？</p>
          <form id="answer-form" autocomplete="off">
            <label class="answer-input-wrap">
              <span class="sr-only">記事名を入力</span>
              <input id="answer-input" name="answer" maxlength="80" placeholder="記事名を入力" enterkeyhint="done" required autofocus>
            </label>
            <button class="button button-primary" type="submit">これで回答</button>
          </form>
          <button id="give-up" class="button button-text danger-text" type="button">わからないのでギブアップ</button>
          <div id="give-up-confirm" class="give-up-confirm is-hidden">
            <p>ギブアップすると自由入力には戻れず、4択の得点になります。</p>
            <div>
              <button id="cancel-give-up" class="button button-quiet" type="button">まだ考える</button>
              <button id="confirm-give-up" class="button button-danger" type="button">4択を見る</button>
            </div>
          </div>
        </div>
      </aside>
    </section>
  `;

  const input = document.querySelector('#answer-input');
  setTimeout(() => input?.focus(), 50);
  document.querySelector('#answer-form').addEventListener('submit', (event) => {
    event.preventDefault();
    resolveAnswer({ mode: 'text', submitted: new FormData(event.currentTarget).get('answer') });
  });
  document.querySelector('#give-up').addEventListener('click', () => {
    document.querySelector('#give-up-confirm').classList.remove('is-hidden');
    document.querySelector('#give-up').classList.add('is-hidden');
  });
  document.querySelector('#cancel-give-up').addEventListener('click', () => {
    document.querySelector('#give-up-confirm').classList.add('is-hidden');
    document.querySelector('#give-up').classList.remove('is-hidden');
    input.focus();
  });
  document.querySelector('#confirm-give-up').addEventListener('click', showChoices);
}

function showChoices() {
  if (state.resolved) return;
  state.gaveUp = true;
  const question = state.challenge.questions[state.index];
  document.querySelector('#answer-area').innerHTML = `
    <p class="answer-kicker">4択から選んでください</p>
    <div class="choice-list">
      ${question.choices.map((choice, index) => `
        <button class="choice-button" type="button" data-choice="${escapeHtml(choice)}">
          <span>${String.fromCharCode(65 + index)}</span>${escapeHtml(choice)}
        </button>
      `).join('')}
    </div>
  `;
  document.querySelectorAll('[data-choice]').forEach((button) => {
    button.addEventListener('click', () => resolveAnswer({ mode: 'choice', submitted: button.dataset.choice }));
  });
}

function resolveAnswer({ mode, submitted }) {
  if (state.resolved) return;
  const question = state.challenge.questions[state.index];
  const elapsedMs = performance.now() - state.questionStartedAt;
  const correct = isCorrectAnswer(submitted, question);
  const score = scoreAnswer({ correct, mode, elapsedMs });
  state.resolved = true;
  state.answers.push({
    questionId: question.id,
    title: question.title,
    submitted: String(submitted || ''),
    mode,
    correct,
    score,
    elapsedMs
  });

  document.querySelector('#answer-area').innerHTML = `
    <div class="answer-result ${correct ? 'is-correct' : 'is-wrong'}">
      <span class="result-mark">${correct ? '○' : '×'}</span>
      <p>${correct ? '正解！' : mode === 'choice' ? '残念！' : '不正解'}</p>
      <h2>${escapeHtml(question.title)}</h2>
      <div class="result-points">+${score.toLocaleString()} pt</div>
      ${mode === 'text' && !correct ? `<small>あなたの回答：${escapeHtml(submitted)}</small>` : ''}
      <a href="${escapeHtml(question.sourceUrl)}" target="_blank" rel="noopener noreferrer">Wikipediaで記事を読む ↗</a>
      <button id="next-question" class="button button-primary">
        ${state.index + 1 === state.challenge.questions.length ? '結果を見る' : '次の問題'} <span aria-hidden="true">→</span>
      </button>
    </div>
  `;
  document.querySelector('#next-question').addEventListener('click', () => {
    state.index += 1;
    if (state.index >= state.challenge.questions.length) renderResults();
    else renderQuestion();
  });
}

function renderResults() {
  const elapsedMs = performance.now() - state.startedAt;
  const score = state.answers.reduce((sum, answer) => sum + answer.score, 0);
  const correctCount = state.answers.filter((answer) => answer.correct).length;
  const giveUps = state.answers.filter((answer) => answer.mode === 'choice').length;
  const result = { score, correctCount, giveUps, elapsedMs, savedAt: Date.now() };
  const challengeKey = hashString(state.encoded);
  const best = saveBestScore(challengeKey, result);
  const isBest = best?.score === score && best?.elapsedMs === elapsedMs;
  document.title = `${score.toLocaleString()}点｜What's This Wiki?`;

  app.innerHTML = `
    <section class="result-hero">
      <p class="eyebrow">RESULT</p>
      <div class="score-display"><strong>${score.toLocaleString()}</strong><span>pt</span></div>
      ${isBest ? '<p class="best-badge">この端末のベスト記録</p>' : ''}
      <div class="result-stats">
        <div><strong>${correctCount}</strong><span>正解 / ${state.challenge.questions.length}問</span></div>
        <div><strong>${giveUps}</strong><span>ギブアップ</span></div>
        <div><strong>${formatDuration(elapsedMs)}</strong><span>回答時間</span></div>
      </div>
    </section>

    <section class="panel result-actions">
      <h2>同じ問題、友達にも送る？</h2>
      <p>問題・順番・4択まで、まったく同じ内容で遊べます。</p>
      <button id="share-result" class="button button-primary button-large">結果とクイズを共有</button>
      <button id="retry" class="button button-quiet">同じ問題にもう一度挑戦</button>
      <button id="new-game" class="button button-text">別の問題で遊ぶ</button>
    </section>

    <section class="answer-review">
      <h2>答え合わせ</h2>
      ${state.answers.map((answer, index) => `
        <article>
          <span class="review-number">${index + 1}</span>
          <div><strong>${escapeHtml(answer.title)}</strong><small>${answer.correct ? '正解' : '不正解'}・${answer.mode === 'choice' ? '4択' : '自由入力'}・${answer.score}pt</small></div>
          <span class="review-mark ${answer.correct ? 'correct' : 'wrong'}">${answer.correct ? '○' : '×'}</span>
        </article>
      `).join('')}
    </section>
  `;

  document.querySelector('#share-result').addEventListener('click', () => shareChallenge(result));
  document.querySelector('#retry').addEventListener('click', startGame);
  document.querySelector('#new-game').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    renderHome();
  });
}

async function shareChallenge(result = null) {
  if (!state.shareUrl) return;
  const text = result
    ? `Wikipedia目次クイズ：${state.challenge.questions.length}問中${result.correctCount}問正解、${result.score.toLocaleString()}点！同じ問題に挑戦してみて。`
    : `Wikipediaの目次だけで記事を当てるクイズ。同じ${state.challenge.questions.length}問に挑戦してみて。`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "What's This Wiki?", text, url: state.shareUrl });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${state.shareUrl}`);
    showToast('共有文をコピーしました');
  } catch (error) {
    if (error.name !== 'AbortError') {
      try {
        await navigator.clipboard.writeText(state.shareUrl);
        showToast('URLをコピーしました');
      } catch {
        window.prompt('このURLをコピーしてください', state.shareUrl);
      }
    }
  }
}

function renderError(message, retry) {
  setHeaderShare(false);
  app.innerHTML = `
    <section class="panel error-panel">
      <span class="error-icon">!</span>
      <h1>うまく作れませんでした</h1>
      <p>${escapeHtml(message)}</p>
      <button id="retry-action" class="button button-primary">条件を選び直す</button>
    </section>
  `;
  document.querySelector('#retry-action').addEventListener('click', retry);
}

async function boot() {
  headerShareButton.addEventListener('click', () => shareChallenge());
  const encoded = getChallengeFromHash();
  if (!encoded) {
    renderHome();
    return;
  }
  setLoading('共有クイズを開いています…');
  try {
    const challenge = await decodeChallenge(encoded);
    renderSharedIntro(challenge, encoded);
  } catch (error) {
    renderError(error.message, renderHome);
  }
}

window.addEventListener('hashchange', boot);
boot();
