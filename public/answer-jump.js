const app = document.querySelector('#app');
const jumpButton = document.querySelector('#answer-jump-button');
const mobileLayout = matchMedia('(max-width: 820px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let answerPanel = null;
let frameRequested = false;

function setButtonVisible(visible) {
  jumpButton.classList.toggle('is-hidden', !visible);
  jumpButton.setAttribute('aria-hidden', String(!visible));
  jumpButton.tabIndex = visible ? 0 : -1;
}

function updateButtonVisibility() {
  frameRequested = false;

  if (!mobileLayout.matches || !answerPanel?.isConnected) {
    setButtonVisible(false);
    return;
  }

  const questionScreen = app.querySelector('.question-layout');
  const hasAnswered = Boolean(answerPanel.querySelector('.answer-result'));
  if (!questionScreen || hasAnswered) {
    setButtonVisible(false);
    return;
  }

  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const panelTop = answerPanel.getBoundingClientRect().top;
  setButtonVisible(panelTop > viewportHeight - 8);
}

function requestVisibilityUpdate() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(updateButtonVisibility);
}

function refreshAnswerPanel() {
  answerPanel = app.querySelector('.answer-panel');
  requestVisibilityUpdate();
}

jumpButton.addEventListener('click', () => {
  if (!answerPanel?.isConnected) return;
  answerPanel.scrollIntoView({
    behavior: reducedMotion.matches ? 'auto' : 'smooth',
    block: 'start'
  });
});

const appObserver = new MutationObserver(refreshAnswerPanel);
appObserver.observe(app, { childList: true, subtree: true });

window.addEventListener('scroll', requestVisibilityUpdate, { passive: true });
window.addEventListener('resize', requestVisibilityUpdate, { passive: true });
window.visualViewport?.addEventListener('resize', requestVisibilityUpdate, { passive: true });
window.visualViewport?.addEventListener('scroll', requestVisibilityUpdate, { passive: true });
mobileLayout.addEventListener('change', requestVisibilityUpdate);

refreshAnswerPanel();
