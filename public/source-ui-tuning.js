const app = document.querySelector('#app');

const SOURCE_LABELS = {
  curated: 'お試し問題',
  experimental: 'Wikipedia探索',
  custom: 'オリジナル問題を作る'
};

function refineSourceOptions() {
  const inputs = app.querySelectorAll('input[name="source"]');
  inputs.forEach((input) => {
    const label = input.closest('label');
    const text = label?.querySelector('span');
    if (!label || !text) return;

    const nextLabel = SOURCE_LABELS[input.value];
    if (nextLabel && text.textContent.trim() !== nextLabel) {
      text.textContent = nextLabel;
    }

    label.classList.toggle('source-option--custom', input.value === 'custom');
    label.classList.toggle('is-source-selected', input.checked);
  });
}

function refineInitialHintStatus() {
  const status = app.querySelector('#hint-status');
  if (!status || status.classList.contains('is-hidden')) return;

  const match = status.textContent.trim().match(/^最初の1文字「(.+)」を入力しました。$/);
  if (!match) return;

  const initial = match[1];
  if (status.dataset.refinedInitial === initial) return;

  const label = document.createElement('span');
  label.className = 'hint-status__label';
  label.textContent = '1文字目は';

  const value = document.createElement('strong');
  value.className = 'hint-status__initial';
  value.textContent = `『${initial}』`;

  status.replaceChildren(label, value);
  status.dataset.refinedInitial = initial;
  status.classList.add('hint-status--initial');
}

function refineUi() {
  refineSourceOptions();
  refineInitialHintStatus();
}

app.addEventListener('change', (event) => {
  if (!event.target.matches?.('input[name="source"]')) return;
  requestAnimationFrame(refineSourceOptions);
});

const OBSERVE_OPTIONS = { childList: true, subtree: true, characterData: true };

// refineUi()はDOMを書き換えるため、必ず監視を止めてから実行する。
// 監視したまま書き換えると自分自身が再発火し、無限ループでメインスレッドが停止する。
const observer = new MutationObserver(() => {
  observer.disconnect();
  try {
    refineUi();
  } finally {
    observer.observe(app, OBSERVE_OPTIONS);
  }
});

observer.observe(app, OBSERVE_OPTIONS);
refineUi();