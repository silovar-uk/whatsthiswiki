const app = document.querySelector('#app');

const HOME_SLOGANS = [
  'Wikipediaは広すぎる。だから目次だけ見る。',
  '本文を読まない勇気。目次だけで当てる無謀。',
  '知識はいらん。ひらめきと勘でいけ。',
  '目次は記事の顔。たまに顔だけでは何も分からない。',
  '正解するか、知らない目次に殴られるか。'
];

const MASCOT_LINES = [
  '目次しか見せんぞ',
  '本文？ 甘えるな',
  '勘で押せ！',
  'その見出し、罠かも',
  '知らん記事も来るよ'
];

let lastSignature = '';
let mascotLineIndex = 0;

function signature() {
  return [
    Boolean(app.querySelector('.hero')),
    Boolean(app.querySelector('.toc-panel')),
    Boolean(app.querySelector('.answer-result')),
    Boolean(app.querySelector('.result-hero')),
    Boolean(app.querySelector('.invite-panel')),
    Boolean(app.querySelector('.loading-panel'))
  ].join(':');
}

function ensureMascot() {
  let mascot = document.querySelector('#wiki-mascot');
  if (mascot) return mascot;
  mascot = document.createElement('aside');
  mascot.id = 'wiki-mascot';
  mascot.className = 'wiki-mascot';
  mascot.setAttribute('aria-hidden', 'true');
  mascot.innerHTML = `
    <span class="wiki-mascot__bubble"></span>
    <img src="./assets/favicon.svg" alt="">
  `;
  document.body.append(mascot);
  mascot.addEventListener('click', () => {
    mascotLineIndex = (mascotLineIndex + 1) % MASCOT_LINES.length;
    mascot.querySelector('.wiki-mascot__bubble').textContent = MASCOT_LINES[mascotLineIndex];
    mascot.classList.remove('is-bouncing');
    requestAnimationFrame(() => mascot.classList.add('is-bouncing'));
  });
  return mascot;
}

function addSticker(target, text, className = '') {
  if (!target || target.querySelector(':scope > .gag-sticker')) return;
  const sticker = document.createElement('span');
  sticker.className = `gag-sticker ${className}`.trim();
  sticker.textContent = text;
  sticker.setAttribute('aria-hidden', 'true');
  target.append(sticker);
}

function decorateHome() {
  const hero = app.querySelector('.hero');
  if (!hero) return;
  const slogan = HOME_SLOGANS[Math.floor(Math.random() * HOME_SLOGANS.length)];
  hero.dataset.gag = slogan;
  addSticker(hero, `目次だけだが\n何か？`, 'gag-sticker--hero');

  const setup = app.querySelector('.setup-panel');
  addSticker(setup, `安心の良問\n（たぶん）`, 'gag-sticker--setup');

  const primary = setup?.querySelector('.button-primary');
  if (primary) primary.innerHTML = 'いざ、目次のカオスへ <span aria-hidden="true">→</span>';

  const howTo = app.querySelector('.how-to');
  if (howTo) howTo.dataset.gag = '4手で終わる。人生より簡単。';
}

function decorateQuestion() {
  const toc = app.querySelector('.toc-panel');
  if (!toc) return;
  toc.dataset.gag = '目次、急に饒舌。';
  addSticker(toc, `ヒントは\nこれだけ`, 'gag-sticker--toc');

  const answer = app.querySelector('.answer-panel');
  if (answer) answer.dataset.gag = '当てずっぽうも回答です';

  const giveUp = app.querySelector('#give-up');
  if (giveUp) giveUp.textContent = 'もう無理です。4択をください';

  const confirm = app.querySelector('#confirm-give-up');
  if (confirm) confirm.textContent = '人類の知恵、4択を見る';

  const formButton = app.querySelector('#answer-form .button-primary');
  if (formButton) formButton.textContent = 'これで押し通す';
}

function decorateAnswer() {
  const result = app.querySelector('.answer-result');
  if (!result) return;
  result.dataset.gag = result.classList.contains('is-correct')
    ? 'なんで分かった？ こわ。'
    : 'Wikipediaは広い。今日はそれでいい。';
  addSticker(
    result,
    result.classList.contains('is-correct') ? `天才の\n可能性` : `ドンマイ\n目次`,
    'gag-sticker--answer'
  );
}

function decorateResults() {
  const result = app.querySelector('.result-hero');
  if (!result) return;
  result.dataset.gag = '知識と勘と、若干の運の総決算。';
  addSticker(result, `結果は\n結果です`, 'gag-sticker--result');

  const share = app.querySelector('#share-result');
  if (share) share.textContent = '友達にも同じ目次を浴びせる';

  const retry = app.querySelector('#retry');
  if (retry) retry.textContent = '記憶があるうちに再戦する';
}

function decorateInvite() {
  const invite = app.querySelector('.invite-panel');
  if (!invite) return;
  invite.dataset.gag = '友達から目次が届いています。怖いですね。';
  addSticker(invite, `逃げても\nいいよ`, 'gag-sticker--invite');
}

function decorateLoading() {
  const loading = app.querySelector('.loading-panel');
  if (!loading) return;
  loading.dataset.gag = 'Wikipedia側は通常営業です。';
}

function decorate() {
  const nextSignature = signature();
  if (nextSignature === lastSignature) return;
  lastSignature = nextSignature;

  const mascot = ensureMascot();
  mascot.querySelector('.wiki-mascot__bubble').textContent = MASCOT_LINES[mascotLineIndex];
  mascot.classList.toggle('is-playing', Boolean(app.querySelector('.toc-panel')));

  decorateHome();
  decorateQuestion();
  decorateAnswer();
  decorateResults();
  decorateInvite();
  decorateLoading();
}

new MutationObserver(decorate).observe(app, { childList: true, subtree: true });
decorate();
