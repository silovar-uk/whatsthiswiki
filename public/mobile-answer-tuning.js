const app = document.querySelector('#app');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobileLayout = matchMedia('(max-width: 820px)');
const visualViewport = window.visualViewport;

let focusSessionActive = false;
let settleTimers = [];
let previousViewportHeight = visualViewport?.height || window.innerHeight;

function clearSettleTimers() {
  settleTimers.forEach((timer) => clearTimeout(timer));
  settleTimers = [];
}

function currentAnswerTarget() {
  return app.querySelector('.answer-result') || app.querySelector('.answer-panel');
}

function settleAnswerView({ force = false } = {}) {
  if ((!focusSessionActive && !force) || !mobileLayout.matches) return;

  clearSettleTimers();
  const delays = [40, 220, 520];

  delays.forEach((delay, index) => {
    const timer = setTimeout(() => {
      const active = document.activeElement;
      if (active?.matches?.('#answer-input')) return;

      const target = currentAnswerTarget();
      if (!target) return;

      target.scrollIntoView({
        behavior: index === 0 && !reducedMotion.matches ? 'smooth' : 'auto',
        block: 'start'
      });
    }, delay);
    settleTimers.push(timer);
  });

  const finishTimer = setTimeout(() => {
    focusSessionActive = false;
    document.body.classList.remove('answer-input-focused');
  }, 620);
  settleTimers.push(finishTimer);
}

function enhanceHintButtons() {
  const hintButtons = app.querySelectorAll('.hint-actions .hint-button');
  if (hintButtons.length < 2) return;

  const [initialButton, choiceButton] = hintButtons;
  initialButton.classList.add('hint-button--primary');
  choiceButton.classList.add('hint-button--secondary');

  const initialTitle = initialButton.querySelector('strong');
  const initialMeta = initialButton.querySelector('small');
  const choiceTitle = choiceButton.querySelector('strong');
  const choiceMeta = choiceButton.querySelector('small');

  if (initialTitle) initialTitle.textContent = '最初の1文字を見る';
  if (initialMeta) initialMeta.textContent = '最大900pt';
  if (choiceTitle) choiceTitle.textContent = '4択から選ぶ';
  if (choiceMeta) choiceMeta.textContent = '正解時350pt';
}

app.addEventListener('focusin', (event) => {
  if (!event.target.matches?.('#answer-input')) return;
  clearSettleTimers();
  focusSessionActive = true;
  previousViewportHeight = visualViewport?.height || window.innerHeight;
  document.body.classList.add('answer-input-focused');
});

app.addEventListener('focusout', (event) => {
  if (!event.target.matches?.('#answer-input')) return;
  settleAnswerView({ force: true });
});

app.addEventListener('submit', (event) => {
  if (!event.target.matches?.('#answer-form')) return;
  const input = event.target.querySelector('#answer-input');
  input?.blur();
  settleAnswerView({ force: true });
}, { capture: true });

visualViewport?.addEventListener('resize', () => {
  const nextHeight = visualViewport.height;
  const heightIncrease = nextHeight - previousViewportHeight;
  previousViewportHeight = nextHeight;

  if (!focusSessionActive) return;

  const activeInput = document.activeElement?.matches?.('#answer-input')
    ? document.activeElement
    : null;

  if (heightIncrease > 60 && activeInput) {
    activeInput.blur();
    settleAnswerView({ force: true });
    return;
  }

  if (!activeInput) settleAnswerView({ force: true });
}, { passive: true });

const observer = new MutationObserver(() => {
  enhanceHintButtons();
  if (focusSessionActive && app.querySelector('.answer-result')) {
    settleAnswerView({ force: true });
  }
});

observer.observe(app, { childList: true, subtree: true });
enhanceHintButtons();
