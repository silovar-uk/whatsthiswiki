import { decodeChallenge, getChallengeFromHash } from './utils.js';

const SUMMARY_SCORE_FLAG = '__whatsthiswikiSummaryHintUsed';
const MAX_SUMMARY_LENGTH = 520;

let cachedEncoded = null;
let cachedChallengePromise = null;
let currentQuestionIndex = null;
let previousScreen = 'boot';
let syncQueued = false;

const summaryUsed = new Set();
const summaryTexts = new Map();

function setSummaryScoreFlag(active) {
  globalThis[SUMMARY_SCORE_FLAG] = Boolean(active);
}

function resetRunState() {
  summaryUsed.clear();
  summaryTexts.clear();
  currentQuestionIndex = null;
  setSummaryScoreFlag(false);
}

function getQuestionIndex() {
  const label = document.querySelector('.progress-label')?.textContent || '';
  const match = label.match(/QUESTION\s+(\d+)\s*\//i);
  return match ? Math.max(0, Number(match[1]) - 1) : null;
}

async function getChallenge() {
  const encoded = getChallengeFromHash();
  if (!encoded) return null;
  if (encoded !== cachedEncoded) {
    cachedEncoded = encoded;
    cachedChallengePromise = decodeChallenge(encoded).catch((error) => {
      cachedChallengePromise = null;
      throw error;
    });
  }
  return cachedChallengePromise;
}

function sourceUrlFor(question) {
  if (question?.sourceUrl) return question.sourceUrl;
  return `https://ja.wikipedia.org/wiki/${encodeURIComponent(String(question?.title || '').replace(/ /g, '_'))}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function directAnswerTargets(question) {
  const values = [question?.title, ...(question?.aliases || [])]
    .flatMap((value) => {
      const text = String(value || '').trim();
      const withoutQualifier = text.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim();
      return [text, withoutQualifier];
    })
    .filter((value) => value.length >= 2);
  return [...new Set(values)].sort((a, b) => b.length - a.length);
}

function truncateSummary(text) {
  if (text.length <= MAX_SUMMARY_LENGTH) return text;
  const draft = text.slice(0, MAX_SUMMARY_LENGTH);
  const sentenceEnd = Math.max(draft.lastIndexOf('。'), draft.lastIndexOf('！'), draft.lastIndexOf('？'));
  return `${sentenceEnd >= 260 ? draft.slice(0, sentenceEnd + 1) : draft.trimEnd()}…`;
}

function maskDirectReferences(text, question) {
  let masked = String(text || '').replace(/\s+/g, ' ').trim();
  directAnswerTargets(question).forEach((target) => {
    masked = masked.replace(new RegExp(escapeRegExp(target), 'giu'), '〇〇');
  });

  // 冒頭の読み仮名・別名・英語名など、答えを直接示す括弧書きも伏せる。
  masked = masked.replace(/^(\s*〇〇)\s*[（(][^）)\n]{1,120}[）)]/, '$1（〇〇）');
  return truncateSummary(masked);
}

async function fetchMaskedSummary(question) {
  const url = new URL('https://ja.wikipedia.org/w/api.php');
  Object.entries({
    action: 'query',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    redirects: '1',
    titles: question.title,
    format: 'json',
    formatversion: '2',
    origin: '*'
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Wikipedia API: ${response.status}`);
    const data = await response.json();
    const page = data.query?.pages?.[0];
    const extract = page?.extract?.trim();
    if (!extract) throw new Error('概要文を取得できませんでした。');
    return maskDirectReferences(extract, question);
  } finally {
    clearTimeout(timeout);
  }
}

function lockAnswerControls() {
  const controls = [...document.querySelectorAll('#answer-area input, #answer-area button')];
  const states = controls.map((control) => [control, control.disabled]);
  controls.forEach((control) => { control.disabled = true; });
  return () => states.forEach(([control, wasDisabled]) => {
    if (control.isConnected) control.disabled = wasDisabled;
  });
}

function summaryBoxMarkup() {
  const box = document.createElement('div');
  box.id = 'summary-hint-box';
  box.className = 'summary-hint-box is-hidden';
  box.setAttribute('aria-live', 'polite');
  return box;
}

async function showSummary(button, box, questionIndex) {
  if (summaryUsed.has(questionIndex) || button.dataset.loading === 'true') return;
  button.dataset.loading = 'true';
  const restoreControls = lockAnswerControls();
  box.classList.remove('is-hidden', 'is-error');
  box.innerHTML = '<strong>概要文を読み込んでいます…</strong>';

  try {
    const challenge = await getChallenge();
    const question = challenge?.questions?.[questionIndex];
    if (!question) throw new Error('問題情報を読み取れませんでした。');
    const summary = await fetchMaskedSummary(question);

    summaryUsed.add(questionIndex);
    summaryTexts.set(questionIndex, summary);
    setSummaryScoreFlag(true);
    box.textContent = summary;
    button.querySelector('strong').textContent = '概要文を表示中';
    button.querySelector('small').textContent = 'この問題は最大600pt';
  } catch (error) {
    summaryUsed.delete(questionIndex);
    summaryTexts.delete(questionIndex);
    setSummaryScoreFlag(false);
    box.classList.add('is-error');
    box.textContent = error.name === 'AbortError'
      ? '概要文の取得に時間がかかっています。もう一度お試しください。'
      : (error.message || '概要文を取得できませんでした。');
  } finally {
    restoreControls();
    button.dataset.loading = 'false';
    button.disabled = summaryUsed.has(questionIndex);
  }
}

function enhanceQuestion(questionIndex) {
  const hintActions = document.querySelector('.hint-actions');
  if (!hintActions || document.querySelector('#show-summary')) return;

  hintActions.classList.add('has-summary-hint');
  const button = document.createElement('button');
  button.id = 'show-summary';
  button.className = 'hint-button hint-button--summary';
  button.type = 'button';
  button.innerHTML = '<strong>概要文を見る</strong><small>最大600pt</small>';

  const choiceButton = hintActions.querySelector('#request-choices');
  hintActions.insertBefore(button, choiceButton || null);

  const box = summaryBoxMarkup();
  hintActions.insertAdjacentElement('afterend', box);

  if (summaryUsed.has(questionIndex) && summaryTexts.has(questionIndex)) {
    box.textContent = summaryTexts.get(questionIndex);
    box.classList.remove('is-hidden');
    button.querySelector('strong').textContent = '概要文を表示中';
    button.querySelector('small').textContent = 'この問題は最大600pt';
    button.disabled = true;
  }

  button.addEventListener('click', () => showSummary(button, box, questionIndex));
}

function summaryModeLabel(original) {
  if (original.includes('4択')) return '概要文＋4択';
  if (original.includes('1文字ヒント')) return '概要文＋1文字ヒント';
  return '概要文ヒント';
}

function annotateCurrentResult(questionIndex) {
  if (!summaryUsed.has(questionIndex)) return;
  const method = [...document.querySelectorAll('.answer-result small')]
    .find((element) => element.textContent.startsWith('回答方法：'));
  if (!method || method.dataset.summaryAdjusted === 'true') return;
  const original = method.textContent.replace(/^回答方法：/, '');
  method.textContent = `回答方法：${summaryModeLabel(original)}`;
  method.dataset.summaryAdjusted = 'true';
}

async function enhanceFinalResults() {
  const review = document.querySelector('.answer-review');
  if (!review || review.dataset.wikiLinksReady === 'true') return;
  review.dataset.wikiLinksReady = 'loading';

  try {
    const challenge = await getChallenge();
    const articles = [...review.querySelectorAll('article')];
    let hintCount = 0;

    articles.forEach((article, index) => {
      const question = challenge?.questions?.[index];
      const details = article.querySelector('div');
      const mode = details?.querySelector('small');
      if (!details || !mode || !question) return;

      const originalModeText = mode.dataset.originalModeText || mode.textContent;
      mode.dataset.originalModeText = originalModeText;
      const usedStandardHint = !originalModeText.includes('ヒントなし');
      const usedSummary = summaryUsed.has(index);
      if (usedStandardHint || usedSummary) hintCount += 1;

      if (usedSummary && mode.dataset.summaryAdjusted !== 'true') {
        mode.textContent = originalModeText
          .replace('ヒントなし', '概要文ヒント')
          .replace('1文字ヒント', '概要文＋1文字ヒント')
          .replace('4択', '概要文＋4択');
        mode.dataset.summaryAdjusted = 'true';
      }

      if (!details.querySelector('.review-source-link')) {
        const link = document.createElement('a');
        link.className = 'review-source-link';
        link.href = sourceUrlFor(question);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Wikipediaで読む ↗';
        details.append(link);
      }
    });

    const hintStat = document.querySelector('.result-stats > div:nth-child(2) strong');
    if (hintStat) hintStat.textContent = String(hintCount);
    review.dataset.wikiLinksReady = 'true';
  } catch {
    review.dataset.wikiLinksReady = 'false';
  }
}

function syncUi() {
  syncQueued = false;

  if (document.querySelector('.result-hero')) {
    setSummaryScoreFlag(false);
    previousScreen = 'results';
    enhanceFinalResults();
    return;
  }

  const questionIndex = getQuestionIndex();
  if (questionIndex !== null) {
    if (previousScreen === 'results') resetRunState();
    currentQuestionIndex = questionIndex;
    setSummaryScoreFlag(summaryUsed.has(questionIndex));
    previousScreen = 'question';

    if (document.querySelector('.answer-result')) annotateCurrentResult(questionIndex);
    else enhanceQuestion(questionIndex);
    return;
  }

  if (document.querySelector('.hero, .invite-panel')) {
    resetRunState();
    previousScreen = 'setup';
  }
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(syncUi);
}

new MutationObserver(queueSync).observe(document.querySelector('#app'), {
  childList: true,
  subtree: true
});

window.addEventListener('hashchange', () => {
  cachedEncoded = null;
  cachedChallengePromise = null;
  resetRunState();
  queueSync();
});

queueSync();
