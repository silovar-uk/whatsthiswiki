const app = document.querySelector('#app');
const headerShareButton = document.querySelector('#share-header');
const loadingTemplate = document.querySelector('#loading-template');

const CATEGORY_LABELS = {
  food: '食べ物',
  people: '人物',
  works: '作品',
  places: '場所',
  science: '科学'
};

const DIFFICULTY_LABELS = {
  easy: 'やさしい',
  normal: 'ふつう',
  hard: 'むずかしい',
  mixed: 'まぜこぜ'
};

let routeCleanup = null;

window.addEventListener('popstate', renderRoute);
document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-link]');
  if (!link || link.origin !== location.origin) return;
  event.preventDefault();
  navigate(link.pathname);
});

renderRoute();

async function renderRoute() {
  routeCleanup?.();
  routeCleanup = null;
  headerShareButton.classList.add('is-hidden');
  headerShareButton.onclick = null;

  const path = location.pathname;
  const challengeMatch = path.match(/^\/challenge\/([^/]+)$/);
  const playMatch = path.match(/^\/play\/([^/]+)$/);

  if (challengeMatch) {
    await renderChallenge(challengeMatch[1]);
    return;
  }

  if (playMatch) {
    await renderPlay(playMatch[1]);
    return;
  }

  renderHome();
}

function navigate(path) {
  history.pushState({}, '', path);
  window.scrollTo({ top: 0, behavior: 'instant' });
  renderRoute();
}

function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow">TABLE OF CONTENTS QUIZ</p>
      <h1>目次だけで、<br>何の記事かわかる？</h1>
      <p class="lead">Wikipediaをランダム探索して問題を生成。同じ問題を友達に送り、好きな時間にスコアを競えます。</p>
    </section>

    <section class="panel create-panel">
      <div class="section-heading">
        <span class="step-number">01</span>
        <div>
          <h2>チャレンジを作る</h2>
          <p>出題条件を選ぶと、共有用URLを発行します。</p>
        </div>
      </div>

      <form id="create-form" class="form-stack">
        <fieldset>
          <legend>問題の出どころ</legend>
          <div class="segmented-control">
            <label>
              <input type="radio" name="questionSource" value="curated" checked>
              <span>確認済み問題</span>
            </label>
            <label>
              <input type="radio" name="questionSource" value="experimental">
              <span>Wikipedia探索（実験）</span>
            </label>
          </div>
          <p class="field-note">通常は人が確認した問題を使用。探索モードはWikipediaからその場で候補を選別します。</p>
        </fieldset>

        <div id="experimental-settings" class="form-stack is-hidden">
          <fieldset>
            <legend>記事の探し方</legend>
            <div class="segmented-control">
              <label>
                <input type="radio" name="sourceMode" value="random" checked>
                <span>完全ランダム</span>
              </label>
              <label>
                <input type="radio" name="sourceMode" value="category">
                <span>ジャンル指定</span>
              </label>
            </div>
          </fieldset>

        <label id="category-field" class="field is-hidden">
          <span>ジャンル</span>
          <select name="category">
            <option value="food">食べ物</option>
            <option value="people">人物</option>
            <option value="works">作品</option>
            <option value="places">場所</option>
            <option value="science">科学</option>
          </select>
        </label>
        </div>

        <label class="field">
          <span>難易度</span>
          <select name="difficulty">
            <option value="mixed">まぜこぜ</option>
            <option value="easy">やさしい</option>
            <option value="normal">ふつう</option>
            <option value="hard">むずかしい</option>
          </select>
        </label>

        <fieldset>
          <legend>問題数</legend>
          <div class="segmented-control">
            <label>
              <input type="radio" name="questionCount" value="5" checked>
              <span>5問</span>
            </label>
            <label>
              <input type="radio" name="questionCount" value="10">
              <span>10問</span>
            </label>
          </div>
        </fieldset>

        <div id="create-error" class="notice notice-error is-hidden" role="alert"></div>
        <button class="button button-primary button-large" type="submit">Wikipediaから問題を探す</button>
      </form>
    </section>

    <section class="rules-grid">
      <article class="mini-card">
        <span>FREE ANSWER</span>
        <h3>まずは自由入力</h3>
        <p>表記揺れは正規化して判定。正解が早いほど高得点。</p>
      </article>
      <article class="mini-card">
        <span>GIVE UP</span>
        <h3>自分で諦めたら4択</h3>
        <p>時間切れで勝手に開きません。ギブアップした本人だけ選択肢を表示。</p>
      </article>
      <article class="mini-card">
        <span>SHARE</span>
        <h3>同じ問題で競う</h3>
        <p>URLをLINEやDiscordへ。得点と回答時間でランキング。</p>
      </article>
    </section>
  `;

  const form = document.querySelector('#create-form');
  const categoryField = document.querySelector('#category-field');
  const experimentalSettings = document.querySelector('#experimental-settings');
  const sourceInputs = form.elements.sourceMode;
  const questionSourceInputs = form.elements.questionSource;

  const updateSourceVisibility = () => {
    const isExperimental = questionSourceInputs.value === 'experimental';
    experimentalSettings.classList.toggle('is-hidden', !isExperimental);
    categoryField.classList.toggle('is-hidden', !isExperimental || sourceInputs.value !== 'category');
  };
  form.addEventListener('change', updateSourceVisibility);
  updateSourceVisibility();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const errorBox = document.querySelector('#create-error');
    const values = new FormData(form);

    submitButton.disabled = true;
    errorBox.classList.add('is-hidden');
    showLoading();

    try {
      const challenge = await api('/api/challenges', {
        method: 'POST',
        body: {
          questionSource: values.get('questionSource'),
          sourceMode: values.get('sourceMode'),
          category: values.get('category'),
          difficulty: values.get('difficulty'),
          questionCount: Number(values.get('questionCount'))
        }
      });
      navigate(`/challenge/${challenge.id}`);
    } catch (error) {
      renderHome();
      const restoredError = document.querySelector('#create-error');
      restoredError.textContent = error.message;
      restoredError.classList.remove('is-hidden');
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function renderChallenge(challengeId) {
  showLoading('チャレンジを読み込み中…');

  try {
    const challenge = await api(`/api/challenges/${challengeId}`);
    const leaderboardData = await api(`/api/challenges/${challengeId}/leaderboard`);
    const shareUrl = `${location.origin}/challenge/${challengeId}`;

    headerShareButton.classList.remove('is-hidden');
    headerShareButton.onclick = () => shareChallenge(shareUrl, challenge);

    app.innerHTML = `
      <section class="hero hero-compact">
        <p class="eyebrow">SHARED CHALLENGE</p>
        <h1>目次クイズ<br>全${challenge.questionCount}問</h1>
        <div class="tag-row">
          <span class="tag">${challenge.questionSource === 'curated' ? '確認済み問題' : 'Wikipedia探索・実験'}</span>
          <span class="tag">${challenge.questionSource === 'curated' ? '全ジャンル' : (challenge.sourceMode === 'random' ? '完全ランダム' : CATEGORY_LABELS[challenge.category] ?? 'ジャンル指定')}</span>
          <span class="tag">${DIFFICULTY_LABELS[challenge.difficulty]}</span>
        </div>
      </section>

      <section class="panel start-panel">
        <div class="section-heading">
          <span class="step-number">02</span>
          <div>
            <h2>名前を入れて挑戦</h2>
            <p>自由入力は1回勝負。4択を見たい時は、自分でギブアップを選びます。</p>
          </div>
        </div>

        <form id="start-form" class="form-stack">
          <label class="field">
            <span>ランキング表示名</span>
            <input name="nickname" maxlength="24" autocomplete="nickname" placeholder="例：ゆうすけ" required>
          </label>
          <div id="start-error" class="notice notice-error is-hidden" role="alert"></div>
          <button class="button button-primary button-large" type="submit">挑戦を始める</button>
          <button id="share-main" class="button button-secondary" type="button">友達にURLを送る</button>
        </form>
      </section>

      ${renderLeaderboard(leaderboardData.leaderboard, '現在のランキング')}
    `;

    document.querySelector('#share-main').onclick = () => shareChallenge(shareUrl, challenge);
    document.querySelector('#start-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const errorBox = document.querySelector('#start-error');
      button.disabled = true;
      errorBox.classList.add('is-hidden');

      try {
        const data = await api(`/api/challenges/${challengeId}/plays`, {
          method: 'POST',
          body: { nickname: new FormData(form).get('nickname') }
        });
        navigate(data.path);
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.remove('is-hidden');
      } finally {
        button.disabled = false;
      }
    });
  } catch (error) {
    renderFatal(error.message);
  }
}

async function renderPlay(playId) {
  showLoading('プレイデータを読み込み中…');

  try {
    const data = await api(`/api/plays/${playId}`);
    const firstUnanswered = data.questions.findIndex((question) => !question.answered);

    if (data.play.completedAt || firstUnanswered === -1) {
      await renderFinishedPlay(playId, data);
      return;
    }

    renderQuestion(data, firstUnanswered);
  } catch (error) {
    renderFatal(error.message);
  }
}

function renderQuestion(data, questionIndex) {
  const question = data.questions[questionIndex];
  const answeredCount = data.questions.filter((item) => item.answered).length;
  const startedAt = performance.now();
  let timerId = null;

  const cleanTimer = () => timerId && clearInterval(timerId);
  routeCleanup = cleanTimer;

  app.innerHTML = `
    <section class="quiz-header">
      <div>
        <p class="eyebrow">QUESTION ${questionIndex + 1} / ${data.questions.length}</p>
        <h1>この記事は何？</h1>
      </div>
      <div class="timer" aria-label="経過時間">
        <span>TIME</span>
        <strong id="timer">0:00</strong>
      </div>
    </section>

    <div class="progress-track" aria-hidden="true">
      <span style="width:${(answeredCount / data.questions.length) * 100}%"></span>
    </div>

    <section class="panel toc-panel">
      <div class="toc-label">CONTENTS</div>
      <ol class="toc-list">
        ${question.sections.map((section) => `
          <li style="--level:${Math.max(0, Number(section.level || 1) - 1)}">
            <span>${escapeHtml(section.text)}</span>
          </li>
        `).join('')}
      </ol>
    </section>

    <section class="panel answer-panel">
      <form id="answer-form" class="form-stack">
        <label class="field">
          <span>記事名を入力</span>
          <input name="answer" autocomplete="off" autofocus placeholder="わかったら入力" required>
        </label>
        <div id="answer-error" class="notice notice-error is-hidden" role="alert"></div>
        <button class="button button-primary button-large" type="submit">この答えで決定</button>
        <button id="give-up" class="button button-ghost" type="button">ギブアップして4択を見る</button>
      </form>
      <div id="choice-area" class="is-hidden"></div>
      <div id="answer-result" class="is-hidden"></div>
    </section>
  `;

  const timerElement = document.querySelector('#timer');
  timerId = setInterval(() => {
    timerElement.textContent = formatClock(Math.floor((performance.now() - startedAt) / 1000));
  }, 250);

  const answerForm = document.querySelector('#answer-form');
  answerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const answer = new FormData(answerForm).get('answer');
    await submitAnswer({
      playId: data.play.id,
      question,
      mode: 'text',
      answer,
      elapsedMs: Math.round(performance.now() - startedAt),
      cleanTimer,
      next: () => moveNext(data, questionIndex)
    });
  });

  document.querySelector('#give-up').addEventListener('click', async () => {
    const button = document.querySelector('#give-up');
    const errorBox = document.querySelector('#answer-error');
    button.disabled = true;
    errorBox.classList.add('is-hidden');

    try {
      const result = await api(`/api/plays/${data.play.id}/questions/${question.id}/give-up`, { method: 'POST' });
      answerForm.classList.add('is-hidden');
      renderChoices(result.choices, async (choice) => {
        await submitAnswer({
          playId: data.play.id,
          question,
          mode: 'choice',
          answer: choice,
          elapsedMs: Math.round(performance.now() - startedAt),
          cleanTimer,
          next: () => moveNext(data, questionIndex)
        });
      });
    } catch (error) {
      button.disabled = false;
      errorBox.textContent = error.message;
      errorBox.classList.remove('is-hidden');
    }
  });
}

function renderChoices(choices, onSelect) {
  const choiceArea = document.querySelector('#choice-area');
  choiceArea.classList.remove('is-hidden');
  choiceArea.innerHTML = `
    <div class="choice-heading">
      <strong>4択から選ぶ</strong>
      <span>正解しても350点</span>
    </div>
    <div class="choice-grid">
      ${choices.map((choice, index) => `
        <button class="choice-button" type="button" data-choice="${escapeAttribute(choice)}">
          <span>${String.fromCharCode(65 + index)}</span>${escapeHtml(choice)}
        </button>
      `).join('')}
    </div>
  `;

  choiceArea.querySelectorAll('[data-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      choiceArea.querySelectorAll('button').forEach((item) => { item.disabled = true; });
      onSelect(button.dataset.choice);
    });
  });
}

async function submitAnswer({ playId, question, mode, answer, elapsedMs, cleanTimer, next }) {
  const errorBox = document.querySelector('#answer-error');
  errorBox?.classList.add('is-hidden');
  document.querySelectorAll('#answer-form button, #choice-area button').forEach((button) => { button.disabled = true; });

  try {
    const result = await api(`/api/plays/${playId}/questions/${question.id}/answer`, {
      method: 'POST',
      body: { mode, answer, elapsedMs }
    });
    cleanTimer();
    document.querySelector('#answer-form')?.classList.add('is-hidden');
    document.querySelector('#choice-area')?.classList.add('is-hidden');
    renderAnswerResult(result, next);
  } catch (error) {
    document.querySelectorAll('#answer-form button, #choice-area button').forEach((button) => { button.disabled = false; });
    if (errorBox) {
      errorBox.textContent = error.message;
      errorBox.classList.remove('is-hidden');
    }
  }
}

function renderAnswerResult(result, next) {
  const container = document.querySelector('#answer-result');
  container.classList.remove('is-hidden');
  container.innerHTML = `
    <div class="result-mark ${result.isCorrect ? 'is-correct' : 'is-wrong'}">
      <span>${result.isCorrect ? 'CORRECT' : 'WRONG'}</span>
      <strong>${result.isCorrect ? `＋${result.score}点` : '0点'}</strong>
    </div>
    <div class="answer-reveal">
      <small>正解</small>
      <h2>${escapeHtml(result.answer)}</h2>
      <a href="${escapeAttribute(result.sourceUrl)}" target="_blank" rel="noopener noreferrer">Wikipediaの記事を読む ↗</a>
    </div>
    <button id="next-question" class="button button-primary button-large" type="button">次へ</button>
  `;
  document.querySelector('#next-question').onclick = next;
}

async function moveNext(data, currentIndex) {
  const nextIndex = currentIndex + 1;
  if (nextIndex < data.questions.length) {
    const refreshed = await api(`/api/plays/${data.play.id}`);
    renderQuestion(refreshed, nextIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  await renderFinishedPlay(data.play.id);
}

async function renderFinishedPlay(playId, existingData = null) {
  showLoading('結果を集計中…');
  try {
    let result;
    try {
      result = await api(`/api/plays/${playId}/finish`, { method: 'POST' });
    } catch (error) {
      if (!existingData?.play?.completedAt) throw error;
      const leaderboard = await api(`/api/challenges/${existingData.play.challengeId}/leaderboard`);
      const row = leaderboard.leaderboard.find((item) => item.playId === playId);
      result = {
        ...row,
        challengeId: existingData.play.challengeId,
        nickname: existingData.play.nickname,
        questionCount: existingData.questions.length,
        leaderboard: leaderboard.leaderboard
      };
    }

    const shareUrl = `${location.origin}/challenge/${result.challengeId}`;
    headerShareButton.classList.remove('is-hidden');
    headerShareButton.onclick = () => shareResult(shareUrl, result);

    app.innerHTML = `
      <section class="hero result-hero">
        <p class="eyebrow">YOUR RESULT</p>
        <div class="score-display">
          <strong>${Number(result.score).toLocaleString()}</strong>
          <span>POINTS</span>
        </div>
        <h1>${escapeHtml(result.nickname)}</h1>
        <p class="lead">${result.correctCount} / ${result.questionCount}問正解・ランキング${result.rank || '-'}位</p>
      </section>

      <section class="panel result-actions">
        <button id="share-result" class="button button-primary button-large" type="button">結果と挑戦URLを共有</button>
        <a class="button button-secondary" href="/challenge/${result.challengeId}" data-link>もう一度挑戦する</a>
        <a class="button button-ghost" href="/" data-link>別の問題を作る</a>
      </section>

      ${renderLeaderboard(result.leaderboard, 'このチャレンジのランキング', playId)}
    `;

    document.querySelector('#share-result').onclick = () => shareResult(shareUrl, result);
  } catch (error) {
    renderFatal(error.message);
  }
}

function renderLeaderboard(items = [], title = 'ランキング', currentPlayId = null) {
  return `
    <section class="panel leaderboard-panel">
      <div class="section-heading compact">
        <span class="step-number">RANK</span>
        <div><h2>${title}</h2></div>
      </div>
      ${items.length ? `
        <ol class="leaderboard-list">
          ${items.map((item) => `
            <li class="${item.playId === currentPlayId ? 'is-current' : ''}">
              <span class="rank-number">${item.rank}</span>
              <strong>${escapeHtml(item.nickname)}</strong>
              <span>${item.correctCount}問正解</span>
              <b>${Number(item.score).toLocaleString()}点</b>
            </li>
          `).join('')}
        </ol>
      ` : '<p class="empty-state">まだ挑戦者はいません。一番乗りやで。</p>'}
    </section>
  `;
}

async function shareChallenge(url, challenge) {
  const text = `Wikipedia目次クイズ・全${challenge.questionCount}問。目次だけで何の記事かわかる？`;
  await share({ title: "What's This Wiki?", text, url });
}

async function shareResult(url, result) {
  const text = `Wikipedia目次クイズで${Number(result.score).toLocaleString()}点！ ${result.correctCount}/${result.questionCount}問正解。記録を超えられる？`;
  await share({ title: "What's This Wiki?", text, url });
}

async function share(payload) {
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
  showToast('共有文とURLをコピーしました');
}

function showLoading(text = 'Wikipediaを探索中…') {
  const node = loadingTemplate.content.cloneNode(true);
  node.querySelector('p').textContent = text;
  app.replaceChildren(node);
}

function renderFatal(message) {
  app.innerHTML = `
    <section class="panel fatal-panel">
      <p class="eyebrow">ERROR</p>
      <h1>うまく読み込めませんでした</h1>
      <p>${escapeHtml(message)}</p>
      <a class="button button-primary" href="/" data-link>トップへ戻る</a>
    </section>
  `;
}

async function api(path, options = {}) {
  const init = { method: options.method ?? 'GET', headers: {} };
  if (options.body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, init);
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) throw new Error(data.error || `通信エラー（${response.status}）`);
  return data;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 250);
  }, 2400);
}

function formatClock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
