const app = document.querySelector('#app');
const mobileAnswerQuery = window.matchMedia('(max-width: 800px)');

let enhanceQueued = false;
let pendingTopScroll = false;
let previousQuestionLabel = '';
let lastRenderedQuestionLabel = '';

function escapeText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function scrollPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function resetPageTopAfterRender() {
  requestAnimationFrame(() => {
    scrollPageTop();
    requestAnimationFrame(scrollPageTop);
  });
  setTimeout(scrollPageTop, 80);
  setTimeout(scrollPageTop, 220);
}

function ensureQuestionStartsAtTop() {
  const currentQuestionLabel = app.querySelector('.progress-label')?.textContent || '';

  if (!currentQuestionLabel) {
    lastRenderedQuestionLabel = '';
    return;
  }
  if (currentQuestionLabel === lastRenderedQuestionLabel) return;

  lastRenderedQuestionLabel = currentQuestionLabel;
  resetPageTopAfterRender();
}

function scheduleEnhance() {
  if (enhanceQueued) return;
  enhanceQueued = true;
  queueMicrotask(() => {
    enhanceQueued = false;
    enhanceApp();
  });
}

function setAnswerDrawerExpanded(panel, expanded, { focus = false } = {}) {
  const toggle = panel.querySelector('[data-answer-drawer-toggle]');
  const stateLabel = panel.querySelector('[data-answer-drawer-state]');
  const answerInput = panel.querySelector('#answer-input');
  answerInput?.removeAttribute('autofocus');

  if (!mobileAnswerQuery.matches) {
    panel.classList.remove('is-collapsed');
    document.body.classList.remove('has-answer-drawer');
    toggle?.setAttribute('aria-expanded', 'true');
    if (stateLabel) stateLabel.textContent = '表示中';
    return;
  }

  document.body.classList.add('has-answer-drawer');
  panel.classList.toggle('is-collapsed', !expanded);
  toggle?.setAttribute('aria-expanded', String(expanded));
  if (stateLabel) stateLabel.textContent = expanded ? '閉じる' : '開く';

  if (!expanded && document.activeElement === answerInput) {
    answerInput.blur();
    toggle?.focus({ preventScroll: true });
  }

  if (expanded && focus) {
    setTimeout(() => {
      panel.querySelector('#answer-input')?.focus({ preventScroll: true });
    }, 80);
  }
}

function setupAnswerDrawer(panel) {
  const answerArea = panel.querySelector('#answer-area');
  if (!answerArea) return;

  let toggle = panel.querySelector('[data-answer-drawer-toggle]');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'answer-drawer-toggle';
    toggle.dataset.answerDrawerToggle = '';
    toggle.setAttribute('aria-controls', 'answer-area');
    toggle.innerHTML = `
      <span class="answer-drawer-title"><small>ANSWER</small><strong>回答する</strong></span>
      <span class="answer-drawer-state" data-answer-drawer-state>開く</span>
      <span class="answer-drawer-chevron" aria-hidden="true">⌃</span>
    `;
    panel.insertBefore(toggle, answerArea);

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      setAnswerDrawerExpanded(panel, !expanded, { focus: !expanded });
    });

    panel.dataset.answerDrawerReady = 'true';
    setAnswerDrawerExpanded(panel, !mobileAnswerQuery.matches);
  } else if (mobileAnswerQuery.matches) {
    document.body.classList.add('has-answer-drawer');
  }
}

function updateHintLabels() {
  const initialLabel = app.querySelector('#show-initial strong');
  const choiceLabel = app.querySelector('#request-choices strong');

  if (initialLabel && initialLabel.textContent !== 'ヒント：最初の１文字だけ知る') {
    initialLabel.textContent = 'ヒント：最初の１文字だけ知る';
  }
  if (choiceLabel && choiceLabel.textContent !== 'ヒント：４択にする') {
    choiceLabel.textContent = 'ヒント：４択にする';
  }
}

function updateNextButtonLabel() {
  const nextButton = app.querySelector('#next-question');
  if (!nextButton || !nextButton.textContent.includes('次の問題')) return;
  if (nextButton.textContent.includes('次の問題を見る')) return;
  nextButton.innerHTML = '次の問題を見る <span aria-hidden="true">→</span>';
}

function splitCustomUrlEntries(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readWikipediaUrl(input) {
  try {
    const url = new URL(String(input).trim());
    const host = url.hostname.toLowerCase();
    if (!['ja.wikipedia.org', 'ja.m.wikipedia.org'].includes(host)) return null;

    let rawTitle = '';
    if (url.pathname.startsWith('/wiki/')) {
      rawTitle = url.pathname.slice('/wiki/'.length);
    } else if (url.pathname === '/w/index.php') {
      rawTitle = url.searchParams.get('title') || '';
    }
    if (!rawTitle) return null;

    const title = decodeURIComponent(rawTitle).replaceAll('_', ' ').trim();
    if (!title) return null;

    return {
      title,
      readableUrl: `https://ja.wikipedia.org/wiki/${title.replaceAll(' ', '_')}`
    };
  } catch {
    return null;
  }
}

function renderCustomUrlPreview(textarea, preview) {
  const entries = splitCustomUrlEntries(textarea.value);
  const readable = entries.map(readWikipediaUrl).filter(Boolean);

  if (!readable.length) {
    preview.classList.add('is-empty');
    preview.innerHTML = '<span>URLを貼り付けると、記事名を日本語で表示します。</span>';
    return;
  }

  preview.classList.remove('is-empty');
  preview.innerHTML = `
    <strong>読み取る記事</strong>
    <ol>${readable.map((item) => `<li>${escapeText(item.title)}</li>`).join('')}</ol>
  `;
}

function normalizeCustomUrlDisplay(textarea, preview) {
  const entries = splitCustomUrlEntries(textarea.value);
  if (!entries.length) return;

  const normalized = entries.map((entry) => readWikipediaUrl(entry)?.readableUrl || entry).join('\n');
  if (normalized !== textarea.value.trim()) textarea.value = normalized;
  renderCustomUrlPreview(textarea, preview);
}

function setupCustomUrlHelper() {
  const textarea = app.querySelector('#custom-urls');
  if (!textarea || textarea.dataset.readableUrlReady === 'true') return;

  textarea.dataset.readableUrlReady = 'true';
  textarea.placeholder = 'https://ja.wikipedia.org/wiki/%E3%81%9F%E3%81%BE%E3%81%94%E3%81%A3%E3%81%A1';

  const preview = document.createElement('div');
  preview.className = 'custom-url-readable-preview is-empty';
  preview.setAttribute('aria-live', 'polite');
  textarea.insertAdjacentElement('afterend', preview);

  const note = textarea.closest('.custom-settings')?.querySelector('small');
  if (note) {
    note.textContent = '1行に1件、1〜10件まで入力できます。%E3%81…のURLも、日本語の記事名で確認できます。';
  }

  textarea.addEventListener('input', () => renderCustomUrlPreview(textarea, preview));
  textarea.addEventListener('paste', () => {
    setTimeout(() => normalizeCustomUrlDisplay(textarea, preview), 0);
  });
  textarea.addEventListener('blur', () => normalizeCustomUrlDisplay(textarea, preview));

  renderCustomUrlPreview(textarea, preview);
}

function handlePendingTopScroll() {
  if (!pendingTopScroll) return;

  const currentQuestionLabel = app.querySelector('.progress-label')?.textContent || '';
  const movedToResults = Boolean(app.querySelector('.result-hero'));
  const movedToNextQuestion = currentQuestionLabel && currentQuestionLabel !== previousQuestionLabel;

  if (!movedToResults && !movedToNextQuestion) return;

  pendingTopScroll = false;
  resetPageTopAfterRender();
}

function enhanceApp() {
  const answerPanel = app.querySelector('.answer-panel');
  if (answerPanel) setupAnswerDrawer(answerPanel);
  else document.body.classList.remove('has-answer-drawer');

  updateHintLabels();
  updateNextButtonLabel();
  setupCustomUrlHelper();
  ensureQuestionStartsAtTop();
  handlePendingTopScroll();
}

document.addEventListener('click', (event) => {
  const nextButton = event.target.closest('#next-question');
  if (!nextButton) return;

  previousQuestionLabel = app.querySelector('.progress-label')?.textContent || '';
  pendingTopScroll = true;
  setTimeout(handlePendingTopScroll, 250);
}, true);

document.addEventListener('focusin', (event) => {
  if (!mobileAnswerQuery.matches || event.target.id !== 'answer-input') return;
  const panel = event.target.closest('.answer-panel');
  if (!panel?.classList.contains('is-collapsed')) return;

  event.target.blur();
  panel.querySelector('[data-answer-drawer-toggle]')?.focus({ preventScroll: true });
}, true);

mobileAnswerQuery.addEventListener?.('change', () => {
  const panel = app.querySelector('.answer-panel');
  if (!panel) return;
  setAnswerDrawerExpanded(panel, !mobileAnswerQuery.matches);
});

new MutationObserver(scheduleEnhance).observe(app, { childList: true, subtree: true });
enhanceApp();
