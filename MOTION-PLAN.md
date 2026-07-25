# MOTION-PLAN — アニメーションと演出の強化計画

作成日: 2026-07-25 / 対象リポジトリ: `silovar-uk/whatsthiswiki`

この文書は実装担当(Sonnet)がそのまま着手できる粒度で書いています。
調査済みの事実と決定事項をすべて含むため、着手前に本文を通読してください。

---

## 0. 作業環境

| 項目 | 内容 |
|---|---|
| 作業ディレクトリ | `C:\Users\vediv\repos\whatsthiswiki`(OneDrive配下では作業しない) |
| 構成 | ビルドなしの素のES modules + CSS。`public/` をそのまま配信 |
| 依存 | **追加禁止**。`package.json` に依存は1件もない状態を維持する |
| 構文チェック | `npm run check` |
| テスト | `npm test`(`node --test`、`test/static.test.mjs`) |
| ローカル起動 | `npm run dev` は `python3` を呼ぶ。Windowsでは動かない場合があるため `python -m http.server 4173 --directory public` を直接使う |
| デプロイ | `.github/workflows/pages.yml` により GitHub Pages へ自動公開 |

参照資料として、同じ端末の `C:\Users\vediv\repos\cssanimationlists`(CSS MOTION — CSSアニメーション図鑑)を使います。
本計画では動きの指定に `CSS-0NN` の参照IDを用います。実装時は該当エントリの
`css` フィールドを土台にし、本プロジェクトのトークンへ置き換えてください。

---

## 1. 現状把握(調査済みの事実)

### 1.1 ファイル構成と役割

| ファイル | 行数目安 | 役割 |
|---|---|---|
| `public/index.html` | 53 | 骨組み。CSSを4枚読み込み、ローディング用 `<template>` を持つ |
| `public/app.js` | 587 | 画面描画とゲーム進行のすべて。フレームワークなし |
| `public/utils.js` | — | スコア計算、正解判定、共有URLの符号化。**テスト済み** |
| `public/wiki.js` | — | Wikipedia APIからの記事取得と探索 |
| `public/questions.js` | — | 確認済み問題の定義 |
| `public/styles.css` | 199 | 基礎レイアウトとデザイントークン |
| `public/gags.css` | 407 | 視覚的な遊びの層(太い枠線、ずれた影、原色) |
| `public/balance.css` | 137 | gags.cssの一部を打ち消す調整層 |
| `public/interaction.css` | 137 | 操作を妨げないためのz-index・配置調整 |

### 1.2 最重要の構造的制約

`app.js` は画面ごとに `app.innerHTML = ...` で**DOMを丸ごと作り直します**。

```
renderHome() / renderQuestion() / renderResults() / renderSharedIntro()
  → いずれも app.innerHTML への一括代入
resolveAnswer()
  → #answer-area の innerHTML だけを差し替え(トップバーは残る)
```

ここから導かれる実装上の帰結は3つあります。

1. **`transition` は入場演出に使えない。** 要素が毎回新規生成されるため、開始値が存在しない。
   入場は `@keyframes` + `animation` で組むこと。
2. **ずらし表示にJSは不要。** `nth-child` またはインラインの `--i` から
   `animation-delay` を計算すればCSSだけで完結する。
3. **`transition` が有効なのは、生成後に値を変える場合だけ。**
   プログレスバーは要素が残るため、生成直後に `requestAnimationFrame` で
   幅を変えれば `transition` が効く(3.3参照)。

### 1.3 既存のデザイントークン

```
styles.css :root  → --paper --panel --ink --muted --line --red --red-dark --yellow --green --shadow
gags.css   :root  → --gag-pink(#ff3f86) --gag-cyan(#20c7c9) --gag-yellow(#ffd91a)
                    --gag-black(#111) --gag-white(#fffef8)
```

**新しい配色は作りません。** 上記の範囲で構成します。
モーション用のトークン(`--ease-pop` 等)だけを新設します(5.1参照)。

### 1.4 `prefers-reduced-motion` は既に全体対応済み

[styles.css:196](public/styles.css) に以下があります。

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; ... }
}
```

つまり**CSSアニメーションは追加するだけで自動的に無効化されます**。
個別のメディアクエリを書き足す必要はありません。
一方で**JSで生成する演出(紙吹雪、数値カウントアップ)は自動では止まらない**ため、
JS側にガードを入れる必要があります(3.1参照)。

### 1.5 死んでいるCSS

以下のセレクタはCSSに定義がありますが、対応するDOMが**どこからも生成されていません**。

- `.wiki-mascot`, `.wiki-mascot__bubble`(gags.css:343-384、interaction.css:25-52)
- `.gag-sticker` および6つの位置バリアント(gags.css:189-215)
- `.header-excuse`(gags.css:66-77)
- `.give-up-confirm`(interaction.css:14)
- `[data-gag]::after` / `.hero::after`(gags.css:101-114)

さらに `balance.css` の先頭でこれらは `display: none !important` にもされています。
**二重に無効**な状態です。整理はフェーズ3で行います。

### 1.6 履歴から判明した設計判断(計画の修正点)

当初は「封印された遊びの層を解禁する」方針を検討しましたが、
Git履歴を確認した結果、**これは意図的な製品判断であり、覆すべきではない**と判断しました。

```
253f206  Remove playful copy script     ← public/gags.js を146行まるごと削除
179457f  Use neutral interface copy
aaacb52  Update checks for neutral UI
```

削除された `gags.js` が生成していたのは、次のような**文言**です。

- ヒーローの煽りスローガン(「知識はいらん。ひらめきと勘でいけ。」等5種からランダム)
- マスコットのセリフ(「本文？ 甘えるな」「勘で押せ！」等)
- 付箋の文言(「安心の良問(たぶん)」等)
- 送信ボタンの文言差し替え(「いざ、目次のカオスへ」)

そして `balance.css` の冒頭コメントが方針を明言しています。

> Visual playfulness remains, while all copy stays functional and neutral.

**したがって本計画の原則は以下とします。**

| 領域 | 方針 |
|---|---|
| 視覚(配色・枠線・影・動き) | 遊んでよい。むしろ強化する |
| 文言(コピー) | **中立・機能的を維持する。ジョークを入れない** |
| マスコット・付箋 | 復活させない。削除する |

「楽しさ」は文言ではなく**動きと視覚**で作ります。

---

## 2. 設計方針

1. **依存を増やさない。** 紙吹雪もカウントアップも数十行の素のコードで足りる。
2. **JSよりCSSを優先する。** 遅延・イージング・ずらしはCSSの担当。
3. **既存の描画フローを壊さない。** `app.innerHTML` 方式は維持する。書き換えない。
4. **操作を妨げない。** 演出は `pointer-events: none`。入力欄のフォーカスを奪わない。
   これは `interaction.css` が既に守っている原則であり、踏襲する。

---

## 3. フェーズ1 — 正解演出とコンボ

体感の変化が最も大きく、差分が最も小さい範囲です。ここから着手します。

対象は `resolveAnswer()`([app.js:443](public/app.js))と
`renderQuestion()` のトップバーです。

### 3.1 共通ユーティリティを `app.js` に追加

ファイル冒頭付近(`const state` の前)に以下を置きます。

```js
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
```

**紙吹雪**(参照: `CSS-014 コンフェッティ`)。
図鑑のサンプルは無限ループのため、`forwards` の単発に変更して使います。

```js
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
```

**数値カウントアップ。**

```js
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
```

### 3.2 コンボ判定は `utils.js` に置く

`state` へのフィールド追加は不要です。`state.answers` の末尾から数えるだけで求まります。
**テスト可能にするため `utils.js` に置き、`app.js` から import します。**

```js
// utils.js に追加してexport
export function trailingCorrectCount(answers) {
  let count = 0;
  for (let i = answers.length - 1; i >= 0; i -= 1) {
    if (!answers[i].correct) break;
    count += 1;
  }
  return count;
}
```

`test/static.test.mjs` に検証を1つ追加します(既存の import 文へ追記)。

```js
test('末尾からの連続正解数を数える', () => {
  assert.equal(trailingCorrectCount([]), 0);
  assert.equal(trailingCorrectCount([{ correct: true }, { correct: true }]), 2);
  assert.equal(trailingCorrectCount([{ correct: true }, { correct: false }]), 0);
  assert.equal(trailingCorrectCount([{ correct: false }, { correct: true }]), 1);
});
```

### 3.3 `renderQuestion()` の変更

トップバーのHTMLを2点変更します。

```
変更前: <div class="progress-track"><span style="width:${((state.index + 1) / total) * 100}%"></span></div>
変更後: <div class="progress-track"><span style="width:${(state.index / total) * 100}%"></span></div>

変更前: <strong>${合計スコア}</strong>
変更後: <strong id="score-total">${合計スコア}</strong>
```

イベント登録の直前に以下を追加します。生成後に幅を変えるため、
既存の `transition: width 0.3s ease`([styles.css:102](public/styles.css))が有効になります。

```js
const total = state.challenge.questions.length;
const bar = document.querySelector('.progress-track span');
requestAnimationFrame(() => { bar.style.width = `${((state.index + 1) / total) * 100}%`; });
```

### 3.4 `resolveAnswer()` の変更

`#answer-area` の差し替えは `.game-topbar` を残すため、
**トップバーのスコアをその場で加算アニメーションできます**(現状は次の問題まで反映されません)。

結果HTMLへの追加要素:

- 正解時のみ、`.result-points` の直前にコンボ表示を挿入する。
  2連続以上のときだけ出す。文言は数字中心の中立表記とする。

```js
const combo = trailingCorrectCount(state.answers);
const comboMarkup = correct && combo >= 2
  ? `<p class="combo-badge">${combo} 問連続正解</p>`
  : '';
```

差し替え後に実行する処理:

```js
const resultBox = document.querySelector('.answer-result');
if (correct) burstConfetti(resultBox);

const scoreEl = document.querySelector('#score-total');
if (scoreEl) {
  const totalScore = state.answers.reduce((sum, a) => sum + a.score, 0);
  countUp(scoreEl, totalScore - score, totalScore);
  scoreEl.textContent += ''; // 単位表記は既存markupのまま維持
}

document.querySelector('#next-question').focus({ preventScroll: true });
```

**注意:** 既存markupでは `<strong>` の中身が `〜 pt` を含みます。
`countUp` は数値だけを書き換えるため、`pt` は `<strong>` の外へ出すか、
`<span id="score-total">` を内側に作って数値のみを包んでください。
どちらでもよいが、`aria-live` の重複読み上げを避けるため要素構造は最小限の変更に留めます。

`#next-question` へのフォーカス移動はキーボード操作の改善です。
`#app` に `aria-live="polite"` があるため、結果は自動で読み上げられます。

### 3.5 CSSの追加(`gags.css` の末尾)

**新しいCSSファイルは作りません。** 遊びの層は `gags.css` の責務です。

```css
/* --- 結果演出 --- */
.confetti-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.confetti-layer i {
  position: absolute; top: -18px; left: var(--x);
  width: 8px; height: 14px; background: var(--gag-pink);
  animation: confetti-fall 1.8s var(--delay) cubic-bezier(.3,.6,.4,1) forwards;
}
.confetti-layer i:nth-child(3n)   { background: var(--gag-cyan); }
.confetti-layer i:nth-child(3n+1) { background: var(--gag-yellow); }
@keyframes confetti-fall {
  to { transform: translate(var(--drift), 360px) rotate(var(--spin)); opacity: 0; }
}
```

`.answer-result` には既に `position: relative`(gags.css:287)があるため、
包含ブロックの追加指定は不要です。

**○×スタンプ**(参照: `CSS-009 ジェリーボタン` のイージングを流用)。

```css
.answer-result .result-mark { display: inline-block; animation: stamp-in .42s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes stamp-in {
  0%   { transform: scale(2.4) rotate(-14deg); opacity: 0; }
  60%  { transform: scale(.92) rotate(2deg);   opacity: 1; }
  100% { transform: scale(1) rotate(0);        opacity: 1; }
}
```

**コンボバッジ**(参照: `CSS-002 パルスリング` の考え方を単発化)。

```css
.combo-badge {
  display: inline-block; margin: 0 0 6px; padding: 4px 10px;
  color: var(--gag-black); background: var(--gag-yellow);
  border: 2px solid var(--gag-black); font-size: 11px; font-weight: 900;
  transform: rotate(-2deg); box-shadow: 3px 3px 0 var(--gag-black);
  animation: combo-pop .5s cubic-bezier(.2,1.7,.35,1) both;
}
@keyframes combo-pop {
  0%   { transform: rotate(-2deg) scale(0); }
  70%  { transform: rotate(-2deg) scale(1.14); }
  100% { transform: rotate(-2deg) scale(1); }
}
```

**不正解の横振動と赤フラッシュ。**

```css
.answer-result.is-wrong { animation: shake-x .38s ease-in-out both; }
@keyframes shake-x {
  0%,100% { transform: translateX(0); }
  20% { transform: translateX(-7px); } 40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); } 80% { transform: translateX(2px); }
}
```

### 3.6 フェーズ1の完了条件

- `npm run check` と `npm test` が通る(コンボのテストが増えている)
- 正解時に紙吹雪が出て、トップバーのスコアが加算アニメーションする
- 2連続以上で「N 問連続正解」が表示される
- 不正解時に結果パネルが横に振れる
- OS設定で「視差効果を減らす」を有効にすると、紙吹雪が出ずスコアは即値になる
- `Tab` を押さずに `Enter` で次の問題へ進める(フォーカス移動が効いている)

---

## 4. フェーズ2 — 全画面のマイクロインタラクション

### 4.1 目次の1行ずつ流し込み(参照: `CSS-007 ラインリビール`)

`tocMarkup()`([app.js:315](public/app.js))は既に `style="--depth:..."` を出力しています。
ここへ `--i` を足すだけで済みます。

```js
<li style="--depth:${...}; --i:${index}">
```

```css
.toc-list li {
  animation: toc-in .34s cubic-bezier(.2,.8,.3,1) both;
  animation-delay: calc(var(--i, 0) * 34ms);
}
@keyframes toc-in { from { opacity: 0; transform: translateX(-10px); } }
```

**上限に注意。** 目次が50項目を超える記事では最後の行が1.7秒後になります。
`animation-delay` は `calc(min(var(--i, 0), 18) * 34ms)` で頭打ちにしてください。

### 4.2 パネルとカードのずらし出現

対象は `.setup-panel` / `.how-to article` / `.choice-list .choice-button` /
`.answer-review article` / `.result-stats div` です。
共通クラスは新設せず、既存セレクタへ直接 `animation` を当てます。

```css
.how-to article, .choice-button, .answer-review article, .result-stats div {
  animation: rise-in .4s cubic-bezier(.2,.8,.3,1) both;
}
.how-to article:nth-child(2), .choice-button:nth-child(2) { animation-delay: 60ms; }
/* 以下 nth-child(3)(4) を 120ms / 180ms で続ける */
@keyframes rise-in { from { opacity: 0; transform: translateY(14px); } }
```

**注意:** `.how-to article` には gags.css:185-186 で `transform: rotate(±.4deg)` が
既に当たっています。`animation` の `transform` が競合して回転が消えるため、
keyframes 側に回転を含めるか、`.how-to article` 用の keyframes を分けてください。
同じ問題が `.toc-list li`(gags.css:252-253)にもあります。**必ず実機で確認すること。**

### 4.3 画面遷移(View Transitions API)

`app.js` に3行のラッパーを追加し、`renderHome` / `renderQuestion` /
`renderResults` / `renderSharedIntro` の**呼び出し側**を包みます。
各 render 関数の中身は変更しません。

```js
function withTransition(fn) {
  if (!document.startViewTransition || REDUCED_MOTION.matches) return fn();
  return document.startViewTransition(fn);
}
```

未対応ブラウザでは現在の即時切り替えにフォールバックします。

```css
::view-transition-old(root) { animation: vt-out .22s ease both; }
::view-transition-new(root) { animation: vt-in  .28s ease both; }
@keyframes vt-out { to { opacity: 0; transform: translateX(-16px); } }
@keyframes vt-in  { from { opacity: 0; transform: translateX(20px); } }
```

**注意点2つ。**

- `renderQuestion()` 内の `setTimeout(() => input?.focus(), 50)` は
  遷移アニメーション中に発火します。フォーカスが飛ばない場合は
  `startViewTransition(...).finished.then(() => input.focus())` へ移すこと。
- `hashchange` → `boot()` の経路も同じラッパーを通すと、共有URLからの
  流入時も一貫します。

### 4.4 ヒントパネルの高さアニメーション

`#choice-confirm` は現在 `.is-hidden` の付け外しで開閉しています。
`grid-template-rows: 0fr → 1fr` に置き換えると高さ計算のJSが不要になります。

**HTML側の前提:** `#choice-confirm` の直下の子を1つの `<div>` にまとめる必要があります
(現在は `<p>` と `<div>` の2つ)。`renderQuestion()` のテンプレートを修正してください。

```css
.choice-confirm { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .26s ease; }
.choice-confirm > * { overflow: hidden; }
.choice-confirm.is-open { grid-template-rows: 1fr; }
```

JS側は `classList.toggle('is-hidden', ...)` を `is-open` に置き換えます
([app.js:392](public/app.js) 付近の3箇所)。
`.is-hidden` は他の要素でも使われているため、**定義自体は残すこと**。

### 4.5 ボタンの手触り(参照: `CSS-010 リップルボタン`)

`.button-primary` は既に hover で影が伸び傾きます(gags.css:168-172)。
`:active` の押し込みだけが欠けています。

```css
.button-primary:active { transform: translate(2px, 2px); box-shadow: 3px 3px 0 var(--gag-black); }
```

リップルはJSを要するため**採用しません**。`:active` だけで十分です。

### 4.6 ローディングの改善(参照: `CSS-006 シマーテキスト`)

`.spinner` は既にあります。読み込み文言 `[data-loading-message]` に
シマーを当て、探索の進行が止まっていないことを伝えます。
文言は `updateLoading()` が `textContent` で差し替えるため、
タイピング演出(`CSS-005`)は競合します。**使わないこと。**

### 4.7 フェーズ2の完了条件

- 目次・4択・答え合わせが順番に現れる
- 既存の微妙な回転(`.how-to article`、`.toc-list li`)が消えていない
- 画面遷移がスライドする。未対応ブラウザでも壊れない
- 問題画面に入ったとき入力欄にフォーカスが当たっている
- 「4択を見る」の確認パネルが高さアニメーションで開く
- reduced-motion 環境で遷移が即時になる

---

## 5. フェーズ3 — 視覚の統一と死にコードの整理

### 5.1 モーショントークンの新設

フェーズ1・2で散らばったイージングと時間を `styles.css` の `:root` に集約します。

```css
--dur-fast: .22s;  --dur-base: .34s;  --dur-slow: .5s;
--ease-out: cubic-bezier(.2,.8,.3,1);
--ease-pop: cubic-bezier(.2,1.7,.35,1);
```

既存の `animation` 宣言を置き換えます。**新規の動きは追加しません**。
これは整理作業です。

### 5.2 背景の微動(参照: `CSS-013 グラデーションウェーブ`)

`body` の2つの `radial-gradient`(gags.css:11-14)を
20秒周期でゆっくり動かします。`background-position` のアニメーションは
再描画が重いため、**`.paper-noise` 側の `opacity` を揺らす方式を採ります**。

```css
.paper-noise { animation: paper-breathe 14s ease-in-out infinite; }
@keyframes paper-breathe { 50% { opacity: .16; } }
```

### 5.3 ヒーローの `!?` を浮かせる(参照: `CSS-004 フローティングカード`)

```css
.hero::before { animation: hero-float 6s ease-in-out infinite; }
@keyframes hero-float {
  50% { transform: rotate(9deg) translateY(-10px); }
}
```

`transform: rotate(12deg)` が gags.css:98 にあります。
keyframes の `0%/100%` に元の値を明示してください。

### 5.4 死にコードの削除

1.5節で洗い出した未使用CSSを削除します。1.6節の判断により、
**マスコットと付箋は復活させず削除します**。

| ファイル | 削除対象 |
|---|---|
| `gags.css` | `.header-excuse`、`.gag-sticker` と6バリアント、`.wiki-mascot` 系、`@keyframes mascot-bounce`、`.hero::after` / `[data-gag]::after`、および対応するメディアクエリ内の記述 |
| `interaction.css` | `.gag-sticker`、`.wiki-mascot` 系、`.give-up-confirm` の記述(実質ファイル全体が空に近づく) |
| `balance.css` | 冒頭の `display: none !important` ブロック(消す対象が無くなるため不要になる) |

### 5.5 CSSファイルの統合(4枚 → 2枚)

削除後に残るのは以下です。

- `balance.css` の実体 = `.segmented` / `.custom-settings` / `.hint-*` /
  `.choice-confirm` のレイアウト → **`styles.css` へ移す**
- `interaction.css` の実体 = `.answer-panel` 配下の `z-index` と
  `touch-action` の数行 → **`styles.css` へ移す**

結果、`styles.css`(基礎+レイアウト)と `gags.css`(視覚の遊び+モーション)の
**2枚構成**になります。`index.html` の `<link>` を2行に減らします。

**移動時の注意:** `balance.css` と `interaction.css` は
「後から読み込んでgags.cssを上書きする」前提で書かれています。
`styles.css`(最初に読み込む)へ移すと**カスケードの順序が逆転し、
gags.css に負ける**箇所が出ます。以下の順で進めてください。

1. まず不要セレクタの削除だけを行い、`npm run check` と実機確認
2. 次に統合を行い、統合後に**全画面を目視で比較**
3. 上書きが必要だと判明した宣言は `gags.css` の末尾へ移すか、
   詳細度を1段上げて解決する(`!important` は使わない)

**この節は見た目の崩れが起きやすい作業です。** フェーズ1・2と必ず別コミットにしてください。

### 5.6 フェーズ3の完了条件

- CSSが2枚になり、`index.html` の `<link>` が2行
- 削除前後で全画面(トップ / 問題 / 結果 / 共有導入 / 読み込み中 / エラー)の
  見た目が変わっていない
- ジョーク文言が1つも復活していない
- `npm run check` と `npm test` が通る

---

## 6. 検証手順(各フェーズ共通)

```
npm run check
npm test
python -m http.server 4173 --directory public
```

`http://localhost:4173/` で以下の6画面すべてを通します。

| 画面 | 到達方法 |
|---|---|
| トップ | ルートを開く |
| 問題 | 「確認済み問題」→ すぐ遊ぶ |
| 結果 | 5問回答しきる |
| 共有導入 | 結果画面の共有URLを別タブで開く |
| 読み込み中 | 「Wikipedia探索」を選んで実行 |
| エラー | 「URLから作る」に `https://example.com/` を入れて実行 |

加えて、以下の2条件でも確認します。

- 幅375pxのモバイル表示(`.hint-actions` や `.segmented` が1列になる)
- OSの「視差効果を減らす」を有効化した状態

---

## 7. コミット粒度

1行目は日本語で要約します。フェーズをまたぐ変更を1コミットに混ぜないこと。

```
正解演出と連続正解の表示を追加        (フェーズ1)
連続正解数の算出をutilsへ追加        (フェーズ1、テスト込み)
画面と一覧の入場アニメーションを追加   (フェーズ2)
画面遷移にView Transitionsを導入      (フェーズ2)
モーション設定値を変数へ集約          (フェーズ3)
未使用のマスコット・付箋スタイルを削除 (フェーズ3)
CSSを2ファイルへ統合                 (フェーズ3)
```

作業ブランチは `feature/motion` を切ってください。
`main` への直接コミットと `push` は、ユーザーの指示があるまで行いません。

---

## 8. やらないこと

| 項目 | 理由 |
|---|---|
| 効果音 | 要望に含まれない。自動再生は体験を損ねる |
| アニメーションライブラリの導入 | 依存ゼロを維持する。数十行のCSSで足りる |
| フレームワークへの移行 | `app.innerHTML` 方式で要件を満たせる |
| 新しい配色パレット | 既存の `--gag-*` 4色で構成する |
| ジョーク文言・マスコットの復活 | 1.6節の製品判断を尊重する |
| リップル演出 | JSが必要。`:active` で代替する |
| ローディング文言のタイピング演出 | `textContent` の差し替えと競合する |

---

## 9. 実装順の要約

```
フェーズ1  app.js(演出3関数 + resolveAnswer + renderQuestion)
          utils.js(trailingCorrectCount)
          test/static.test.mjs(検証1件)
          gags.css(末尾に結果演出のCSS)
             ↓ ユーザー確認
フェーズ2  app.js(withTransition、tocMarkupに--i、choice-confirmの構造とクラス)
          gags.css(入場・遷移のCSS)
             ↓ ユーザー確認
フェーズ3  styles.css(モーション変数、balance/interactionの取り込み)
          gags.css(死にコード削除、背景と!?の微動)
          interaction.css / balance.css(削除)
          index.html(linkを2行に)
             ↓ ユーザー確認
```

各フェーズの終わりで必ずユーザーに確認を取ります。まとめて進めないこと。
