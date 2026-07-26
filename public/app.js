import { CURATED_QUESTIONS } from './questions.js';
import { createQuestionsFromUrls, discoverQuestions } from './wiki.js';
import {
  buildChallengeUrl,
  decodeChallenge,
  encodeChallenge,
  escapeHtml,
  formatDuration,
  getChallengeFromHash,
  getInitialCharacter,
  hashString,
  isCorrectAnswer,
  saveBestScore,
  scoreAnswer,
  shuffle,
  trailingCorrectCount
} from './utils.js';

const app = document.querySelector('#app');
const headerShareButton = document.querySelector('#share-header');
const loadingTemplate = document.querySelector('#loading-template');
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const MOBILE_LAYOUT = matchMedia('(max-width: 820px)');

function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function withTransition(fn) {
  if (!document.startViewTransition || REDUCED_MOTION.matches) {
    fn();
    scrollToTop();
    return;
  }
  const transition = document.startViewTransition(fn);
  transition.finished.then(scrollToTop).catch(scrollToTop);
  return transition;
}

function setAnswerDrawerActive(active) {
  document.body.classList.toggle('has-answer-drawer', active);
}

function burstConfetti(host) {
  if (REDUCED_MOTION.matches) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 24; i += 1) {
    const piece = document.createElement('i');
    piece.style.setProperty('--x', `${Math.random() * 100}%`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 140}px`);
    piece.style.setProperty('--spin', `${360 + Math.random() * 540}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 0.28}s`);
    layer.append(piece);
  }
  host.append(layer);
  setTimeout(() => layer.remove(), 2400);
}

function countUp(el, from, to, ms = 620) {
  if (REDUCED_MOTION.matches || from === to) {
    el.textContent = to.toLocaleString();
    return;
  }
  const started = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - started) / ms);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const LABELS = {
  categories: {
    all: 'すべて',
    food: '食べ物',
    people: '人物',
    works: '作品',
    places: '場所',
    science: '科学',
    sports: 'スポーツ',
    custom: 'オリジナル'
  },
  difficulties: {
    easy: 'やさしい',
    normal: 'ふつう',
    hard: 'むずかしい',
    mixed: 'まぜこぜ'
  }
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
  hintMode: 'none'
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
    hintMode: 'none'
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

function setLoading(message = '問題を準備しています…') {
  setAnswerDrawerActive(false);
  app.replaceChildren(loadingTemplate.content.cloneNode(true));
  const target = app.querySelector('[data-loading-message]');
  if (target) target.textContent = message;
}

function updateLoading(message) {
  const target = app.querySelector('[data-loading-message]');
  if (target) target.textContent = message;
}

function parseCustomUrls(value) {
  return [...new Set(
    String(value || '')
      .split(/[\n,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function wikipediaTitleFromUrl(value) {
  try {
    const url = new URL(value);
    if (!/(^|\.)wikipedia\.org$/i.test(url.hostname)) return null;
    const prefix = '/wiki/';
    if (!url.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length)).replaceAll('_', ' ').trim() || null;
  } catch {
    return null;
  }
}

function renderCustomUrlPreview(textarea, preview) {
  const urls = parseCustomUrls(textarea.value);
  const titles = urls.map(wikipediaTitleFromUrl).filter(Boolean);
  if (!urls.length) {
    preview.classList.add('is-hidden');
    preview.innerHTML = '';
    return;
  }
  const invalidCount = urls.length - titles.length;
  preview.classList.remove('is-hidden');
  preview.innerHTML = `
    <strong>読み取りプレビュー</strong>
    ${titles.length ? `<ol>${titles.map((title) => `<li>${escapeHtml(title)}</li>`).join('')}</ol>` : '<p>読み取れるWikipedia URLがありません。</p>'}
    ${invalidCount ? `<small>${invalidCount}件はWikipediaの記事URLとして読み取れませんでした。</small>` : ''}
  `;
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
  setAnswerDrawerActive(false);
  setHeaderShare(false);
  document.title = "What's This Wiki?｜目次だけで何の記事？";
  history.replaceState(null, '', `${location.pathname}${location.search}`);

  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow">OPEN. GUESS. SHARE.</p>
      <h1>目次だけで、<br><em>何の記事？</em></h1>
      <p class="hero-copy">Wikipediaの記事を、目次だけで当てるクイズです。ログインなしで遊べます。</p>
    </section>

    <section class="panel setup-panel">
      <form id="setup-form">
        <button id="setup-submit" class="button button-primary button-large" type="submit">すぐ遊ぶ <span aria-hidden="true">→</span></button>

        <details class="setup-details">
          <summary>問題の作り方を選ぶ</summary>
          <div class="setup-details__body"><div>
            <fieldset>
              <div class="segmented">
                <label><input type="radio" name="source" value="curated" checked><span>確認済み問題</span></label>
                <label><input type="radio" name="source" value="experimental"><span>Wikipedia探索 <small>実験</small></span></label>
                <label><input type="radio" name="source" value="custom"><span>URLから作る</span></label>
              </div>
              <p id="source-note" class="field-note">遊びやすさを確認した問題から出題します。</p>
            </fieldset>

            <div id="standard-settings" class="source-details">
              <div class="field-grid">
                <label class="field">
                  <span>ジャンル</span>
                  <select name="category">
                    ${Object.entries(LABELS.categories)
                      .filter(([value]) => value !== 'custom')
                      .map(([value, label]) => `<option value="${value}">${label}</option>`)
                      .join('')}
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
            </div>

            <section id="custom-settings" class="custom-settings is-hidden">
              <label for="custom-urls">
                <span>日本語版Wikipediaの記事URL</span>
                <textarea id="custom-urls" name="customUrls" placeholder="https://ja.wikipedia.org/wiki/富士山&#10;https://ja.wikipedia.org/wiki/東京タワー"></textarea>
              </label>
              <small>1行に1件、1〜10件まで入力できます。1件だけなら1問のクイズになります。</small>
              <div id="custom-url-preview" class="custom-url-preview is-hidden" aria-live="polite"></div>
            </section>
          </div></div>
        </details>
      </form>
    </section>

    <section class="how-to">
      <article><strong>01</strong><span>目次を見る</span></article>
      <article><strong>02</strong><span>記事名を入力する</span></article>
      <article><strong>03</strong><span>必要ならヒントを使う</span></article>
      <article><strong>04</strong><span>同じ問題を共有する</span></article>
    </section>
  `;

  const form = document.querySelector('#setup-form');
  const sourceNote = document.querySelector('#source-note');
  const countSelect = document.querySelector('#question-count');
  const standardSettings = document.querySelector('#standard-settings');
  const customSettings = document.querySelector('#custom-settings');
  const submitButton = document.querySelector('#setup-submit');
  const customUrls = document.querySelector('#custom-urls');
  const customUrlPreview = document.querySelector('#custom-url-preview');

  customUrls.addEventListener('input', () => renderCustomUrlPreview(customUrls, customUrlPreview));

  form.addEventListener('change', (event) => {
    if (event.target.name !== 'source') return;
    const source = event.target.value;
    const isCustom = source === 'custom';
    standardSettings.classList.toggle('is-hidden', isCustom);
    customSettings.classList.toggle('is-hidden', !isCustom);

    if (source === 'experimental') {
      sourceNote.textContent = 'Wikipediaをその場で探索し、目次がクイズに向く記事を選びます。';
      countSelect.innerHTML = '<option value="3">3問</option><option value="5" selected>5問</option>';
      submitButton.innerHTML = 'すぐ遊ぶ <span aria-hidden="true">→</span>';
    } else if (source === 'custom') {
      sourceNote.textContent = '入力した記事URLから、オリジナルの問題セットを作ります。';
      submitButton.innerHTML = '問題を作る <span aria-hidden="true">→</span>';
      renderCustomUrlPreview(customUrls, customUrlPreview);
      setTimeout(() => customUrls.focus(), 0);
    } else {
      sourceNote.textContent = '遊びやすさを確認した問題から出題します。';
      countSelect.innerHTML = '<option value="5">5問</option><option value="10">10問</option>';
      submitButton.innerHTML = 'すぐ遊ぶ <span aria-hidden="true">→</span>';
    }
  });

  form.addEventListener('submit', createGameFromForm);
}

async function createGameFromForm(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const settings = Object.fromEntries(formData.entries());

  try {
    let questions;
    let category = settings.category;
    let difficulty = settings.difficulty;

    if (settings.source === 'custom') {
      const urls = parseCustomUrls(settings.customUrls);
      if (urls.length < 1 || urls.length > 10) throw new Error('WikipediaのURLを1〜10件入力してください。');
      setLoading(`${urls.length}件の記事を読み込んでいます…`);
      questions = await createQuestionsFromUrls({ urls, onProgress: updateLoading });
      category = 'custom';
      difficulty = 'mixed';
    } else if (settings.source === 'experimental') {
      setLoading('Wikipediaを探索しています…');
      questions = await discoverQuestions({ ...settings, onProgress: updateLoading });
    } else {
      setLoading('問題を準備しています…');
      questions = buildCuratedQuestions(settings);
    }

    const challenge = { source: settings.source, category, difficulty, questions };
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
  setAnswerDrawerActive(false);
  state.challenge = challenge;
  state.encoded = encoded;
  state.shareUrl = buildChallengeUrl(encoded);
  setHeaderShare(true);
  document.title = `${challenge.questions.length}問｜What's This Wiki?`;

  app.innerHTML = `
    <section class="panel invite-panel">
      <p class="eyebrow">WIKIPEDIA CONTENTS QUIZ</p>
      <div class="invite-icon"><img src="./assets/favicon.svg" alt=""></div>
      <h1>${challenge.questions.length}問やってみる</h1>
      <dl class="challenge-summary">
        <div><dt>問題数</dt><dd>${challenge.questions.length}問</dd></div>
        <div><dt>ジャンル</dt><dd>${escapeHtml(LABELS.categories[challenge.category] || 'まぜこぜ')}</dd></div>
        <div><dt>難易度</dt><dd>${escapeHtml(LABELS.difficulties[challenge.difficulty] || 'まぜこぜ')}</dd></div>
      </dl>
      <button id="start-shared" class="button button-primary button-large">はじめる <span aria-hidden="true">→</span></button>
      <button id="back-home" class="button button-text">別の問題を選ぶ</button>
    </section>
  `;
  document.querySelector('#start-shared').addEventListener('click', startGame);
  document.querySelector('#back-home').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    withTransition(() => renderHome());
  });
}

function startGame() {
  state.index = 0;
  state.answers = [];
  state.startedAt = performance.now();
  withTransition(() => renderQuestion());
}

function tocMarkup(sections) {
  return sections.map((section, index) => `
    <li style="--depth:${Math.max(0, Number(section.level || 1) - 1)}; --i:${index}">
      <span class="toc-number">${index + 1}</span>
      <span>${escapeHtml(section.text)}</span>
    </li>
  `).join('');
}

function setupAnswerDrawer() {
  const panel = document.querySelector('.answer-panel');
  const toggle = document.querySelector('#answer-drawer-toggle');
  if (!panel || !toggle) return;
  const label = toggle.querySelector('.answer-drawer-state');
  toggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    label.textContent = collapsed ? '開く' : '閉じる';
    if (!collapsed) {
      setTimeout(() => panel.querySelector('#answer-input')?.focus({ preventScroll: true }), 80);
    }
  });
}

function renderQuestion() {
  const question = state.challenge.questions[state.index];
  setAnswerDrawerActive(true);
  state.questionStartedAt = performance.now();
  state.resolved = false;
  state.hintMode = 'none';
  document.title = `${state.index + 1}/${state.challenge.questions.length}｜What's This Wiki?`;

  app.innerHTML = `
    <section class="game-topbar">
      <div>
        <span class="progress-label">QUESTION ${state.index + 1} / ${state.challenge.questions.length}</span>
        <div class="progress-track"><span style="width:${(state.index / state.challenge.questions.length) * 100}%"></span></div>
      </div>
      <strong><span id="score-total">${state.answers.reduce((sum, answer) => sum + answer.score, 0).toLocaleString()}</span> pt</strong>
    </section>

    <section class="question-layout">
      <article class="panel toc-panel">
        <div class="panel-heading"><span>Wikipedia</span><strong>CONTENTS</strong></div>
        <ol class="toc-list">${tocMarkup(question.sections)}</ol>
      </article>

      <aside class="answer-panel is-collapsed">
        <button class="answer-drawer-toggle" type="button" id="answer-drawer-toggle" aria-controls="answer-area" aria-expanded="false">
          <span class="answer-drawer-title"><small>ANSWER</small><strong>回答する</strong></span>
          <span class="answer-drawer-state">開く</span>
          <span class="answer-drawer-chevron" aria-hidden="true">⌃</span>
        </button>
        <div id="answer-area">
          <p class="answer-kicker">この記事は何？</p>
          <form id="answer-form" autocomplete="off">
            <label class="answer-input-wrap">
              <span class="sr-only">記事名を入力</span>
              <input id="answer-input" name="answer" maxlength="80" placeholder="記事名を入力" enterkeyhint="done" required>
            </label>
            <button class="button button-primary" type="submit">回答する</button>
          </form>

          <div class="hint-actions" aria-label="ヒント">
            <button id="show-initial" class="hint-button" type="button">
              <strong>ヒント：最初の１文字だけ知る</strong>
              <small>正解時 最大900pt</small>
            </button>
            <button id="request-choices" class="hint-button" type="button">
              <strong>ヒント：４択にする</strong>
              <small>正解時 350pt</small>
            </button>
          </div>
          <p id="hint-status" class="hint-status is-hidden"></p>
          <div id="choice-confirm" class="choice-confirm" inert>
            <div>
              <p>4択を表示すると、自由入力には戻れません。</p>
              <div>
                <button id="cancel-choices" class="button button-quiet" type="button">戻る</button>
                <button id="confirm-choices" class="button button-danger" type="button">4択を表示</button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </section>
  `;

  const total = state.challenge.questions.length;
  const bar = document.querySelector('.progress-track span');
  requestAnimationFrame(() => { bar.style.width = `${((state.index + 1) / total) * 100}%`; });
  setupAnswerDrawer();

  const input = document.querySelector('#answer-input');
  if (!MOBILE_LAYOUT.matches) setTimeout(() => input?.focus(), 50);
  document.querySelector('#answer-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const mode = state.hintMode === 'initial' ? 'initial' : 'text';
    resolveAnswer({ mode, submitted: new FormData(event.currentTarget).get('answer') });
  });
  document.querySelector('#show-initial').addEventListener('click', showInitialHint);
  document.querySelector('#request-choices').addEventListener('click', () => {
    const confirmPanel = document.querySelector('#choice-confirm');
    confirmPanel.classList.add('is-open');
    confirmPanel.removeAttribute('inert');
    document.querySelector('#request-choices').disabled = true;
  });
  document.querySelector('#cancel-choices').addEventListener('click', () => {
    const confirmPanel = document.querySelector('#choice-confirm');
    confirmPanel.classList.remove('is-open');
    confirmPanel.setAttribute('inert', '');
    document.querySelector('#request-choices').disabled = false;
    input.focus();
  });
  document.querySelector('#confirm-choices').addEventListener('click', showChoices);
}

function showInitialHint() {
  if (state.resolved || state.hintMode === 'initial') return;
  const question = state.challenge.questions[state.index];
  const input = document.querySelector('#answer-input');
  const initial = getInitialCharacter(question.title);
  state.hintMode = 'initial';
  input.value = initial;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  document.querySelector('#show-initial').disabled = true;
  const status = document.querySelector('#hint-status');
  status.textContent = `最初の1文字「${initial}」を入力しました。`;
  status.classList.remove('is-hidden');
}

function showChoices() {
  if (state.resolved) return;
  state.hintMode = 'choice';
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

function modeLabel(mode) {
  if (mode === 'choice') return '4択';
  if (mode === 'initial') return '1文字ヒント';
  return 'ヒントなし';
}

function openDrawerForResult() {
  const panel = document.querySelector('.answer-panel');
  const toggle = document.querySelector('#answer-drawer-toggle');
  if (!panel || !toggle) return;
  panel.classList.remove('is-collapsed');
  panel.classList.add('is-result-state');
  toggle.setAttribute('aria-expanded', 'true');
  toggle.querySelector('.answer-drawer-state').textContent = '閉じる';
}

function resolveAnswer({ mode, submitted }) {
  if (state.resolved) return;
  const question = state.challenge.questions[state.index];
  const elapsedMs = performance.now() - state.questionStartedAt;
  const correct = isCorrectAnswer(submitted, question);
  const score = scoreAnswer({ correct, mode, elapsedMs });
  const previousTotal = state.answers.reduce((sum, answer) => sum + answer.score, 0);
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

  const combo = trailingCorrectCount(state.answers);
  const comboMarkup = correct && combo >= 2 ? `<p class="combo-badge">${combo} 問連続正解</p>` : '';

  document.querySelector('#answer-area').innerHTML = `
    <div class="answer-result ${correct ? 'is-correct' : 'is-wrong'}">
      <span class="result-mark">${correct ? '○' : '×'}</span>
      <p>${correct ? '正解' : '不正解'}</p>
      <h2>${escapeHtml(question.title)}</h2>
      ${comboMarkup}
      <div class="result-points">+${score.toLocaleString()} pt</div>
      ${mode !== 'choice' && !correct ? `<small>あなたの回答：${escapeHtml(submitted)}</small>` : ''}
      <small>回答方法：${modeLabel(mode)}</small>
      <a href="${escapeHtml(question.sourceUrl)}" target="_blank" rel="noopener noreferrer">Wikipediaで記事を読む ↗</a>
      <button id="next-question" class="button button-primary">
        ${state.index + 1 === state.challenge.questions.length ? '結果を見る' : '次の問題を見る'} <span aria-hidden="true">→</span>
      </button>
    </div>
  `;
  openDrawerForResult();

  const resultBox = document.querySelector('.answer-result');
  if (correct) burstConfetti(resultBox);

  const scoreEl = document.querySelector('#score-total');
  if (scoreEl) countUp(scoreEl, previousTotal, previousTotal + score);

  const nextButton = document.querySelector('#next-question');
  nextButton.focus({ preventScroll: true });
  nextButton.addEventListener('click', () => {
    state.index += 1;
    withTransition(() => {
      if (state.index >= state.challenge.questions.length) renderResults();
      else renderQuestion();
    });
  });
}

function renderResults() {
  setAnswerDrawerActive(false);
  const elapsedMs = performance.now() - state.startedAt;
  const score = state.answers.reduce((sum, answer) => sum + answer.score, 0);
  const correctCount = state.answers.filter((answer) => answer.correct).length;
  const hintCount = state.answers.filter((answer) => answer.mode !== 'text').length;
  const result = { score, correctCount, hintCount, elapsedMs, savedAt: Date.now() };
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
        <div><strong>${hintCount}</strong><span>ヒント使用</span></div>
        <div><strong>${formatDuration(elapsedMs)}</strong><span>回答時間</span></div>
      </div>
    </section>

    <section class="panel result-actions">
      <h2>同じ問題を共有</h2>
      <p>問題・順番・選択肢が同じURLを共有できます。</p>
      <button id="share-result" class="button button-primary button-large">結果とクイズを共有</button>
      <button id="retry" class="button button-quiet">同じ問題にもう一度挑戦</button>
      <button id="new-game" class="button button-text">別の問題で遊ぶ</button>
    </section>

    <section class="answer-review">
      <h2>答え合わせ</h2>
      ${state.answers.map((answer, index) => `
        <article style="--i:${index}">
          <span class="review-number">${index + 1}</span>
          <div><strong>${escapeHtml(answer.title)}</strong><small>${answer.correct ? '正解' : '不正解'}・${modeLabel(answer.mode)}・${answer.score}pt</small></div>
          <span class="review-mark ${answer.correct ? 'correct' : 'wrong'}">${answer.correct ? '○' : '×'}</span>
        </article>
      `).join('')}
    </section>
  `;

  document.querySelector('#share-result').addEventListener('click', () => shareChallenge(result));
  document.querySelector('#retry').addEventListener('click', startGame);
  document.querySelector('#new-game').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    withTransition(() => renderHome());
  });
}

async function shareChallenge(result = null) {
  if (!state.shareUrl) return;
  const text = result
    ? `Wikipedia目次クイズ：${state.challenge.questions.length}問中${result.correctCount}問正解、${result.score.toLocaleString()}点。同じ問題をやってみる。`
    : `Wikipediaの目次だけで記事を当てるクイズ。${state.challenge.questions.length}問やってみる。`;
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
  setAnswerDrawerActive(false);
  setHeaderShare(false);
  app.innerHTML = `
    <section class="panel error-panel">
      <span class="error-icon">!</span>
      <h1>問題を作成できませんでした</h1>
      <p>${escapeHtml(message)}</p>
      <button id="retry-action" class="button button-primary">入力画面に戻る</button>
    </section>
  `;
  document.querySelector('#retry-action').addEventListener('click', () => withTransition(retry));
}

async function boot() {
  headerShareButton.addEventListener('click', () => shareChallenge());
  const encoded = getChallengeFromHash();
  if (!encoded) {
    withTransition(() => renderHome());
    return;
  }
  setLoading('共有クイズを開いています…');
  try {
    const challenge = await decodeChallenge(encoded);
    withTransition(() => renderSharedIntro(challenge, encoded));
  } catch (error) {
    renderError(error.message, renderHome);
  }
}

window.addEventListener('hashchange', boot);
boot();
