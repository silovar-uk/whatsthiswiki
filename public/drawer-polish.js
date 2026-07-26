const drawerApp = document.querySelector('#app');
const drawerMobileQuery = window.matchMedia('(max-width: 800px)');

let drawerPolishQueued = false;

function updateDrawerPolish() {
  const panel = drawerApp?.querySelector('.answer-panel');
  if (!panel) return;

  const result = panel.querySelector('.answer-result');
  const isResult = Boolean(result);
  const badge = panel.querySelector('.answer-drawer-title small');
  const title = panel.querySelector('.answer-drawer-title strong');
  const state = panel.querySelector('[data-answer-drawer-state]');
  const toggle = panel.querySelector('[data-answer-drawer-toggle]');

  panel.classList.toggle('is-result-state', isResult);

  if (isResult) {
    const isCorrect = result.classList.contains('is-correct');
    if (badge) badge.textContent = 'RESULT';
    if (title) title.textContent = isCorrect ? '正解！' : '結果を見る';

    if (drawerMobileQuery.matches && panel.classList.contains('is-collapsed')) {
      panel.classList.remove('is-collapsed');
      toggle?.setAttribute('aria-expanded', 'true');
      if (state) state.textContent = '閉じる';
      document.body.classList.add('has-answer-drawer');
    }
    return;
  }

  if (badge) badge.textContent = 'ANSWER';
  if (title) title.textContent = '回答する';
}

function queueDrawerPolish() {
  if (drawerPolishQueued) return;
  drawerPolishQueued = true;
  queueMicrotask(() => {
    drawerPolishQueued = false;
    updateDrawerPolish();
  });
}

new MutationObserver(queueDrawerPolish).observe(drawerApp, {
  childList: true,
  subtree: true
});

drawerMobileQuery.addEventListener?.('change', updateDrawerPolish);
updateDrawerPolish();
