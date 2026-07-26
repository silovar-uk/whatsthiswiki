# MOBILE-UX-PLAN — スマホ前提のUI/UX改善計画

作成日: 2026-07-26 / 対象リポジトリ: `silovar-uk/whatsthiswiki`
前提となる先行作業: [MOTION-PLAN.md](./MOTION-PLAN.md)(実装済み、`ff53e2b` でmainにマージ)

この文書は実装担当(Sonnet)がそのまま着手できる粒度で書いています。
調査で得た実測値と決定事項をすべて含むため、着手前に本文を通読してください。

---

## 0. 作業環境

| 項目 | 内容 |
|---|---|
| 作業ディレクトリ | `C:\Users\vediv\repos\whatsthiswiki`(OneDrive配下では作業しない) |
| 現在のブランチ | `main`(`ff53e2b`)。作業は `feature/mobile-ux` を切る |
| 構成 | ビルドなしの素のES modules + CSS。**依存追加は禁止** |
| CSS | `styles.css`(基礎・レイアウト)と `gags.css`(視覚表現・モーション)の2枚 |
| 構文チェック | `npm run check` |
| テスト | `npm test` |
| ローカル起動 | `python -m http.server 4173 --directory public`(`npm run dev` は `python3` を呼ぶためWindowsでは動かない場合がある) |

参照資料は `C:\Users\vediv\repos\cssanimationlists`(CSS MOTION図鑑)です。
**前回参照時の20本から104本に増えています。** 動きの指定は `CSS-0NN` の参照IDで行います。

| カテゴリ | 本数 | 主な参照範囲 |
|---|---|---|
| ボタン・リンク | 12 | CSS-048〜057 |
| ナビゲーション・開閉 | 12 | CSS-070〜080 |
| フォーム入力 | 12 | CSS-058〜069 |
| 登場・退場 | 12 | CSS-021〜025 ほか |
| ローディング・進捗 | 12 | CSS-003, 011, 012, 016 |
| フィードバック | 10 | CSS-040〜047 |
| 文字・テキスト | 10 | CSS-005, 006 |
| 背景・装飾 | 8 | CSS-001, 004, 013, 017, 018 |
| 注目・バッジ | 8 | CSS-002, 015, 020, 089〜091 |
| スクロール連動 | 8 | CSS-097〜104 |

---

## 1. 決定事項(ユーザー確認済み)

| 論点 | 決定 |
|---|---|
| 問題画面の回答導線 | **下部固定バー**。目次をスクロールしながらいつでも回答できる |
| トップ画面の導線 | **設定を畳んでCTAを上へ**。既定値のまま即開始でき、こだわる人だけ開く |
| ボタン誘導の強度 | **次の一手を示す**。押下は沈み込み、迷っているときだけ主ボタンが呼吸し矢印が動く |

方針は「**大前提の使いやすさ → 導線 → アニメーション**」の順に積みます。
アニメーションは導線が正しくなった後の仕上げであり、順序を入れ替えないこと。

---

## 2. 調査で判明した事実

### 2.1 モバイル実測(375×812、実効 380×823)

| 画面 | 実測値 | 問題 |
|---|---|---|
| トップ | ページ全長 **1604px**、主CTA「すぐ遊ぶ」が **y=994** | ファーストビューに開始手段がない |
| 問題 | 目次パネル **466〜754px**(実データ10問、中央値610px) | 入力欄が **y≈817px** ≒ 画面外 |

問題画面の積み上げ計算(目次11項目の中央値ケース):

```
 36px  .app 上パディング(≤800px)
 74px  .game-topbar + margin-bottom
610px  .toc-panel(11項目 × 48px + 見出し62px + 内側padding)
 24px  .question-layout の gap
 73px  .answer-panel 上パディング + .answer-kicker
─────
817px  ← 入力欄の位置(ビューポート 812〜823px)
```

目次項目数の実データは **最小8 / 中央値11 / 最大14**。
最大ケースでは入力欄が **y≈961px** まで下がります。
つまり「目次を読む → 回答する」に、ほぼ毎回1画面分のスクロールが必要です。

### 2.2 先行実装の副作用(要修正)

MOTION-PLAN フェーズ1で追加した**スコアのカウントアップは、モバイルでは画面外で起きています**。
`#score-total` は `.game-topbar`(画面最上部)にありますが、回答した瞬間にユーザーが
見ているのは画面下端の結果パネルです。紙吹雪は結果パネル内なので見えますが、
加算演出は見えていません。本計画の 4.3 で解消します。

### 2.3 技術的な負債

| 箇所 | 現状 | 問題 |
|---|---|---|
| [styles.css:37](public/styles.css) | `.page-shell { min-height: 100vh }` | モバイルのツールバー伸縮で高さが跳ねる |
| [styles.css:74](public/styles.css) | `.button { min-height: 42px }` | iOS HIG 44px / Material 48px の下限割れ |
| ブレークポイント | `800px`(styles)/ `600px`(gags)/ `520px`(styles) | **3種類が混在**し基準が不明瞭 |
| safe-area | `.toast` のみ `env(safe-area-inset-bottom)` を使用 | 下部固定UIを足すなら必須 |
| [styles.css:196,205](public/styles.css) | `.segmented { grid-template-columns: 1fr }` が2回 | 800pxで既に1列。520pxの指定は冗長 |

**既に正しい点**(壊さないこと):
`viewport-fit=cover` 設定済み / 入力欄が `font-size: 16px`(iOSの自動ズーム防止)/
`prefers-reduced-motion` の全体無効化が [styles.css:220](public/styles.css) にある。

### 2.4 描画方式の制約(前回計画から継続)

`app.js` は画面ごとに `app.innerHTML` で**DOMを丸ごと作り直します**。
入場演出は `@keyframes` で組み、`transition` は生成後に値を変える場合にのみ使えます。

---

## 3. 設計方針

1. **依存を増やさない。** 素のCSSとバニラJSで完結させる。
2. **モバイルを既定とし、デスクトップを上書きにしない。** 既存が
   デスクトップ優先の書き方なので、モバイル分岐の中で完結させる(全面書き換えはしない)。
3. **アニメーションは導線の補助。** 動きで迷いを消せない場合は、まずレイアウトを直す。
4. **操作を妨げない。** 固定UIは入力とタップを絶対に隠さない。

---

## 4. フェーズ1 — 基盤整備(使いやすさの大前提)

アニメーションを足す前に、土台の不備を潰します。**見た目はほぼ変わりません。**

### 4.1 ビューポート単位を `dvh` へ

```css
/* styles.css:37 */
.page-shell { min-height: 100vh; }        /* 変更前 */
.page-shell { min-height: 100dvh; }       /* 変更後 */
```

`dvh` は全モダンブラウザで対応済みです。フォールバックとして
`min-height: 100vh; min-height: 100dvh;` の二段書きを推奨します(古い順に書く)。

### 4.2 タップ領域を 44px 以上へ

```css
/* styles.css:74 */
.button { min-height: 44px; }
```

`.button-text`(下線リンク調)は視覚的な高さを変えずに当たり判定だけ広げるため、
`padding-block` で確保してください。既存の `.hint-button`(52px)と
`.toc-list li`(48px)は基準を満たしているので触らないこと。

### 4.3 ブレークポイントを統一

現在の3種類を **2種類**に統合します。

| 新基準 | 用途 |
|---|---|
| `≤ 820px` | タブレット縦・スマホ横。1カラム化、下部シート有効化 |
| `≤ 520px` | スマホ縦。パディング圧縮、2列→1列 |

作業内容:

- `gags.css` の `@media (max-width: 600px)` ブロック(`.brand strong` /
  `.hero::before` / `.site-footer`)を `520px` へ寄せる
- `styles.css` の `800px` を `820px` へ変更する
- [styles.css:205](public/styles.css) の重複した `.segmented` 指定を削除する

**注意:** 820pxへの変更で、`.question-layout` が1カラムになる閾値が
20px広がります。800〜820pxのタブレットで見え方が変わるため、
変更後にその幅で一度確認してください。

### 4.4 safe-area 用の変数を用意

下部固定UIで繰り返し使うため、先に定義します。

```css
:root {
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

---

## 5. フェーズ2 — 問題画面の下部シート(最重要)

本計画の中核です。**回答パネルを画面下端に固定し、目次をスクロールしながら
いつでも回答できるようにします。**

### 5.1 完成形の構造(モバイル ≤820px)

```
┌────────────────────┐
│ Q3/5   ▓▓▓░░  350pt│ ← .game-topbar を上部に sticky
├────────────────────┤
│ 1 概要              │
│ 2 名称              │
│ 3 麻・スープ・具      │ ← 目次はこの間をスクロール
│ 4 分類              │
│ 5 食器              │
├────────────────────┤
│ この記事は何？        │ ← .answer-panel を下部に fixed
│ [記事名を入力      ] │
│ [ 回答する ][ヒント] │
└────────────────────┘
```

**この構造は 2.2 のスコア問題も同時に解決します。**
トップバーが常に見えるため、加算アニメーションが画面内で起きます。

### 5.2 シートは3つの状態で高さが変わる

同じ `.answer-panel` が3つのモードを持ちます。**固定高さにしないこと。**

| モード | 中身 | 概算高さ |
|---|---|---|
| 入力 | 見出し + 入力欄 + 回答ボタン + ヒント2つ | 約 230px |
| 4択 | 見出し + 選択肢4つ | 約 300px |
| 結果 | ○× + 記事名 + 点数 + リンク + 次へボタン | 約 380px |

```css
@media (max-width: 820px) {
  .answer-panel {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 40;
    max-height: 70dvh;
    overflow-y: auto;
    padding-bottom: calc(23px + var(--safe-bottom));
    border-radius: 0;
    box-shadow: 0 -6px 0 var(--gag-pink);   /* 影を上向きへ */
  }
}
```

`max-height: 70dvh` + `overflow-y: auto` により、結果モードで内容が多い場合も
シート内でスクロールでき、目次側を押し出しません。

### 5.3 目次がシートに隠れないようにする

シート高さは3モードで変わるため、**固定値のパディングでは必ずどこかで破綻します。**
`ResizeObserver` で実測し、CSS変数へ流します(約8行)。

```js
// app.js: renderQuestion() のイベント登録部に追加
function trackSheetHeight(panel) {
  if (!window.ResizeObserver) return;
  const observer = new ResizeObserver(([entry]) => {
    document.documentElement.style.setProperty(
      '--sheet-h', `${Math.round(entry.contentRect.height)}px`
    );
  });
  observer.observe(panel);
  return observer;
}
```

```css
@media (max-width: 820px) {
  .question-layout { padding-bottom: calc(var(--sheet-h, 240px) + 24px); }
}
```

**後始末:** `app.innerHTML` で画面が作り直されるため、監視対象は自然に消えます。
ただし `ResizeObserver` 自体は残るので、`renderQuestion()` の先頭で
前回のインスタンスを `disconnect()` してください。モジュールスコープに
`let sheetObserver = null;` を置き、`sheetObserver?.disconnect()` してから
再生成する形が最小です。

### 5.4 トップバーを上部に sticky

```css
@media (max-width: 820px) {
  .game-topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    margin-inline: -11px;      /* .page-shell の左右余白を打ち消して全幅に */
    padding-inline: 11px;
    padding-block: 8px;
  }
}
```

`.game-topbar` は `gags.css` で `background: var(--gag-black)` を持つため、
下の目次が透けません。`transform: rotate(-.2deg)` が当たっている点に注意
(`position: sticky` と `transform` は共存できますが、`transform` を持つ祖先が
できると子の `position: fixed` の基準が変わります。**`.game-topbar` は
`.answer-panel` の祖先ではないので影響しません。**)

**必ず確認すること:** `.question-layout` や `.app` に `transform` /
`filter` / `contain` を新たに追加しないこと。追加すると
`.answer-panel { position: fixed }` の基準がビューポートから外れ、シートが壊れます。

### 5.5 仮想キーボード対策(最重要の落とし穴)

`position: fixed; bottom: 0` の要素は、iOS Safari で仮想キーボードが出ると
キーボードの裏に隠れます。**`index.html` の viewport メタタグに1語足すのが正攻法です。**

```html
<!-- 変更前 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<!-- 変更後 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content">
```

`interactive-widget=resizes-content` により、キーボード表示時にビューポート自体が
縮み、`bottom: 0` がキーボードの上に来ます。未対応ブラウザは従来動作にフォールバックします。

**これは実機でしか検証できません。** 実装後、必ずスマホ実機で
「入力欄をタップ → キーボードが出た状態で回答ボタンが押せるか」を確認してください。
デスクトップブラウザの開発者ツールのモバイルエミュレーションでは再現しません。

### 5.6 デスクトップは現状維持

`.answer-panel { position: sticky; top: 18px }`(≥821px)は今のままです。
2カラムで右側に追従する現在の挙動は既に適切なので、変更しないこと。

### 5.7 4択モードの扱い

`showChoices()` は `#answer-area` の中身だけを差し替えるため、
シートの外枠はそのまま使えます。**JSの変更は不要です。**
高さが伸びるぶんは 5.2 の `max-height` と 5.3 の `--sheet-h` が吸収します。

---

## 6. フェーズ3 — トップ画面のアコーディオン化

主CTAをファーストビューに入れ、設定は開きたい人だけが開く形にします。

### 6.1 目標の構造

```
目次だけで、何の記事？

Wikipediaの記事を、目次だけで当てるクイズです。

┌────────────────────┐
│    すぐ遊ぶ →        │  ← ファーストビュー内
└────────────────────┘

▷ 問題の作り方を選ぶ        ← 閉じている
▷ ジャンル・難易度・問題数    ← 閉じている

01 目次を見る / 02 記事名を入力する / …
```

### 6.2 `<details>` を使う(自前実装しない)

キーボード操作・スクリーンリーダー対応・開閉状態の管理が
**ネイティブ要素で全部ついてきます。** チェックボックスハックは使わないこと。

```html
<form id="setup-form">
  <button id="setup-submit" class="button button-primary button-large" type="submit">
    すぐ遊ぶ <span aria-hidden="true">→</span>
  </button>

  <details class="setup-details">
    <summary>問題の作り方を選ぶ</summary>
    <div class="setup-details__body">
      ... 既存の fieldset / #standard-settings / #custom-settings をそのまま移設 ...
    </div>
  </details>
</form>
```

**CTAをフォーム内の先頭に置くこと。** 既定値(`curated` / `all` / `mixed` / 5問)は
`renderHome()` のマークアップで既に設定済みなので、設定を開かずに押しても
そのまま5問のクイズが始まります。

### 6.3 開閉アニメーション(既存パターンの再利用)

**新しい仕組みを作らないこと。** MOTION-PLAN フェーズ2で `.choice-confirm` に
入れた `grid-template-rows: 0fr → 1fr` が [styles.css](public/styles.css) にあります。
同じ手法を使います(参照: `CSS-072 アコーディオン` も同一手法)。

```css
.setup-details__body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-base) ease; }
.setup-details__body > div { overflow: hidden; }
.setup-details[open] .setup-details__body { grid-template-rows: 1fr; }
```

**`<details>` 特有の注意:** ブラウザは閉じるときに中身を即座に
`display: none` にするため、閉じるアニメーションは効きません。
開くときだけ動けば十分と割り切ってください。凝るなら `open` 属性の
除去をJSで遅延させる必要がありますが、**費用対効果が悪いのでやらないこと。**

`<summary>` の三角マークは `CSS-067 セレクト矢印の回転` の要領で回転させます。

### 6.4 「URLから作る」の分岐は維持

`renderHome()` の `form.addEventListener('change', ...)` にある
ソース切り替えロジック([app.js:240](public/app.js) 付近)は**そのまま残します。**
`<details>` の中に移動しても `change` イベントはフォームまで伝播します。

ただし `custom` 選択時に `submitButton.innerHTML` を「問題を作る」へ
差し替える処理があるため、**CTAが `<details>` の外に出ても
`#setup-submit` の参照は変わりません。** 動作に影響はありません。

---

## 7. フェーズ4 — ボタン誘導のアニメーション

決定は「次の一手を示す」。**迷っている人にだけ届き、慣れた人の邪魔をしない**のが基準です。

### 7.1 押下の沈み込み(参照: `CSS-052 押下時の沈み込み`)

MOTION-PLAN フェーズ2で `.button-primary:active` に
`translate(2px, 2px)` を入れ済みです。図鑑の手法(影を消しながら沈む)に寄せて
質感を上げます。既存の `box-shadow: 6px 6px 0` と整合させること。

```css
.button-primary:active {
  transform: translate(3px, 3px);
  box-shadow: 3px 3px 0 var(--gag-black);
}
```

**モバイルでは `:hover` が効かない**(タップで固着する)ため、
`.button-primary:hover` の演出に依存しないこと。`:active` が主役です。

### 7.2 迷っているときだけ呼吸する(参照: `CSS-090 呼吸するボタン`)

**常時呼吸させないこと。鬱陶しくなります。**
「入力欄が空のまま3秒経ったら回答ボタンが呼吸する」を **CSSだけ**で実現します。

```css
/* 入力欄が空(placeholder表示中)のときだけ、3秒後から呼吸を開始 */
#answer-form:has(#answer-input:placeholder-shown) .button-primary {
  animation: cta-breathe 2.4s ease-in-out 3s infinite;
}
@keyframes cta-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.03); }
}
```

`animation-delay: 3s` が「3秒待つ」を、`:has()` + `:placeholder-shown` が
「まだ入力していない」をそれぞれ担うため、**JSのタイマーは不要です。**
1文字でも入力すると `:placeholder-shown` が外れ、呼吸は即座に止まります。

`:has()` は全モダンブラウザで対応済みです。未対応ブラウザではセレクタごと
無視され、呼吸しないだけで機能欠損はありません。

**競合に注意:** `.button-primary:hover` と `:active` は `transform` を使います。
`animation` の `transform` が優先されるため、呼吸中はホバー/押下の移動が
打ち消されます。`:active` に `animation: none` を併記して解決してください。

### 7.3 次の問題への矢印(参照: `CSS-091 矢印の誘導`)

結果表示後の `#next-question` にある `→` を横方向に小さく動かします。
図鑑のサンプルは縦方向(`translateY`)なので、**横に読み替えること。**

```css
#next-question span { display: inline-block; animation: arrow-nudge 1.4s ease-in-out infinite; }
@keyframes arrow-nudge {
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(5px); }
}
```

### 7.4 入力欄のフォーカス(参照: `CSS-059 フォーカス時の枠線拡大`)

回答欄にフォーカスが入ったことを明示します。
**既存のフォーカスリング([styles.css:76](public/styles.css) の
`outline: 3px solid`)を消さないこと。** アクセシビリティの必須要素です。
枠線演出は `box-shadow` で足し、`outline` には触れません。

### 7.5 reduced-motion

[styles.css:220](public/styles.css) の全体無効化により、**上記のCSSアニメーションは
すべて自動的に止まります。** 追加対応は不要です。
7.2 の呼吸も `animation-duration: 0.01ms` になり実質無効化されます。

---

## 8. 検証手順

### 8.1 各フェーズ共通

```bash
npm run check
npm test
```

```bash
python -m http.server 4173 --directory public
```

### 8.2 モバイル観点のチェックリスト

以下を **幅375px** で確認します。

| # | 確認項目 | 合格条件 |
|---|---|---|
| 1 | トップを開く | 「すぐ遊ぶ」がスクロールなしで見える |
| 2 | 設定を開かず「すぐ遊ぶ」 | 5問のクイズが始まる |
| 3 | 「問題の作り方を選ぶ」を開く | 高さアニメーションで開き、中の設定が使える |
| 4 | 問題画面で目次を最下部までスクロール | 回答シートが常に画面下に見えている |
| 5 | 目次の最終項目 | シートに隠れず読める |
| 6 | 入力欄をタップ | **実機で**キーボードの上に回答ボタンが残る |
| 7 | 3秒待つ(未入力) | 回答ボタンがゆっくり呼吸する |
| 8 | 1文字入力する | 呼吸が止まる |
| 9 | 「4択を見る」→表示 | シートが伸び、4つとも押せる |
| 10 | 回答する | 結果がシート内に出る。**トップバーのスコアが画面内で加算される** |
| 11 | 連続正解する | 紙吹雪とコンボバッジが見える |
| 12 | 結果画面まで進む | 崩れなし |
| 13 | OS設定で視差効果を減らす | 呼吸・矢印・紙吹雪が止まる |

### 8.3 デスクトップの非退行確認

**幅1280pxで、フェーズ2の変更前後を必ず見比べること。**
2カラム表示・右側パネルの追従・目次の見え方が変わっていないこと。

### 8.4 検証ツールの既知の問題

調査時、プレビューブラウザ(`mcp__Claude_Browser__*`)が
**モバイルサイズへのリサイズ後に応答しなくなる事象**が発生しました。
タブが非表示状態(`document.hidden: true`)になると `requestAnimationFrame` が
停止し、`javascript_tool` や `get_page_text` がタイムアウトします。

対処:

- 固まったら `preview_start` で開き直す
- HTMLの更新が反映されない場合は `?v=2` のようなクエリを付けて再読み込みする
  (`force: true` でもHTMLドキュメントのキャッシュが残ることがある)
- **チェックリストの 6・7・8 は実機でしか正しく確認できません。**
  ユーザーに実機確認を依頼してください。

---

## 9. コミット粒度

1行目は日本語で要約します。フェーズをまたぐ変更を混ぜないこと。
作業ブランチは `feature/mobile-ux`。`main` への直接コミットと `push` は、
ユーザーの指示があるまで行いません。

```
ビューポート単位とタップ領域を修正         (フェーズ1)
ブレークポイントを2種類へ統一             (フェーズ1)
回答パネルをモバイルで下部固定シートにする   (フェーズ2)
トップバーをモバイルで上部に固定する        (フェーズ2)
トップ画面の設定をアコーディオンへ格納       (フェーズ3)
ボタンの押下と誘導のアニメーションを追加     (フェーズ4)
```

**フェーズ2は2コミットに分けること。** シート化とトップバー固定は
どちらもレイアウトの根幹を触るため、問題が出たときの切り分けを容易にします。

---

## 10. やらないこと

| 項目 | 理由 |
|---|---|
| ボトムシートのドラッグ操作 | 実装量に対して得るものが小さい。固定シートで足りる |
| `<details>` の閉じるアニメーション | ブラウザ仕様との戦いになる。開く側だけで十分 |
| 呼吸アニメーションのJSタイマー | `:has()` + `animation-delay` でCSSのみで足りる |
| 常時アニメーションする主CTA | 鬱陶しい。未入力3秒後に限定する |
| ハンバーガーメニュー・ドロワー | 画面数が少なく不要 |
| フレームワーク・ライブラリの導入 | 依存ゼロを維持する |
| デスクトップレイアウトの変更 | 現状の2カラムは適切。触らない |
| 新しい配色 | 既存の `--gag-*` と `--dur-*` / `--ease-*` で構成する |

---

## 11. 実装順の要約

```
フェーズ1  styles.css(dvh、44px、ブレークポイント統一、--safe-bottom)
          gags.css(600px → 520px へ寄せる)
             ↓ ユーザー確認(見た目が変わらないことの確認)
フェーズ2  index.html(interactive-widget=resizes-content)
          styles.css(.answer-panel を fixed、.game-topbar を sticky)
          app.js(ResizeObserver で --sheet-h、前回インスタンスの disconnect)
             ↓ ユーザー確認(実機必須)
フェーズ3  app.js(renderHome のマークアップを <details> 構造へ)
          styles.css(.setup-details の開閉)
             ↓ ユーザー確認
フェーズ4  gags.css(沈み込み、呼吸、矢印、フォーカス演出)
             ↓ ユーザー確認
```

各フェーズの終わりで必ずユーザーに確認を取ります。まとめて進めないこと。
特に**フェーズ2は実機確認を挟むまで次へ進まないこと。**
