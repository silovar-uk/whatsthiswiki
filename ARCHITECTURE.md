# What's This Wiki? コードレベル設計

## 1. プロダクト方針

初期版はリアルタイム対戦ではなく、同じ問題セットをURLで共有する非同期チャレンジ型とする。

```text
作成者が条件を選ぶ
  ↓
サーバーが問題セットを固定
  ↓
challengeIdを含むURLを発行
  ↓
各参加者が別々の時刻にプレイ
  ↓
結果を同じランキングへ保存
```

問題の出どころは二系統。

```text
curated
  人が確認・承認したquestion_bankから生成

experimental
  MediaWiki APIから記事を探索し、自動品質判定を通過した記事から生成
```

## 2. ディレクトリ

```text
public/
  index.html       SPAシェル、OGPメタ
  app.js           画面描画、ルーティング、API呼び出し
  styles.css       レスポンシブUI

worker/
  index.js         APIルーティング、D1操作、採点、OGP差し替え
  wiki.js          Wikipedia取得、候補評価、問題セット生成
  utils.js         回答正規化、ID生成、JSON補助

migrations/
  0001_init.sql    テーブル・初期確認済み問題10問

test/
  normalize.test.mjs
```

## 3. データモデル

### question_bank

人が確認した問題。

```text
id
answer title
aliases_json
sections_json
source_url
revision_id
category
difficulty
quality_score
review_status
reviewed_at
```

### challenges

共有単位。生成後は問題順と選択肢を固定する。

```text
id
question_source: curated | experimental
source_mode: random | category
category
difficulty
question_count
created_at
expires_at
```

### challenge_questions

チャレンジにコピーされた問題のスナップショット。
Wikipedia側が更新されても、進行中チャレンジの内容は変わらない。

### plays

参加者1人の挑戦。

### play_question_states

問題ごとの状態。

```text
gave_up
answered_at
mode: text | choice
submitted_answer
is_correct
score
elapsed_ms
```

`gave_up`をDBに持つことで、フロントの表示だけでなくAPI側でも以下を強制する。

```text
text回答: gave_up = 0 の時だけ受付
choice回答: gave_up = 1 の時だけ受付
回答済み: 以後の回答を拒否
```

### results

完了したプレイの集計。ランキングは以下で並べる。

```sql
ORDER BY score DESC, total_time_ms ASC, created_at ASC
```

## 4. 問題生成

### curated

1. `review_status = approved`を取得
2. 指定難易度で不足する場合は全難易度へフォールバック
3. ランダムに必要数を抽出
4. 同じ候補群から誤答3件を選ぶ
5. チャレンジへスナップショット保存

### experimental

1. Wikipediaから候補タイトルを取得
2. `pageprops`を一括取得し曖昧さ回避を除外
3. `action=parse&prop=tocdata|revid|categories`で目次取得
4. 最大5並列で解析
5. 品質フィルター
6. 候補決定後、リダイレクト名を一括取得
7. 問題セット生成

外部サブリクエスト数を抑えるため、1生成あたり最大40記事を解析する。

## 5. 自動品質判定

```text
除外
- 目次4未満、22超
- 一覧・曖昧さ回避・年号記事
- 見出しに記事タイトルが露出
- 固有見出しが2件未満
- 汎用見出し率が高すぎる
- 要注意カテゴリキーワードに一致

加点
- 固有見出し比率
- 6〜12前後の適度な目次数
- 適度なタイトル長
```

難易度推定は暫定ルール。運用後は下記実績へ置き換える。

```text
正答率
自由入力正答率
ギブアップ率
平均回答時間
スキップ・離脱率
```

## 6. 回答正規化

`normalizeAnswer()`で以下を統一する。

```text
Unicode NFKC
英字の小文字化
全角・半角
空白
一般的な句読点・括弧・中黒
カタカナ→ひらがな
```

正解判定は正答タイトルとリダイレクト由来の別名を完全一致比較する。
あいまいな部分一致は誤判定を増やすため採用しない。

## 7. 採点

```js
if (!isCorrect) return 0;
if (mode === 'choice') return 350;

const seconds = Math.floor(elapsedMs / 1000);
const speedBonus = Math.max(0, 500 - seconds * 10);
return 1000 + speedBonus;
```

時間切れは設けない。経過時間は速度ボーナスと順位の補助にのみ使う。

## 8. 共有

共有URLには`challengeId`だけを含める。

```text
/challenge/c_xxxxxxxxxxxx
```

正解・問題JSON・選択肢をURLへ埋め込まない。

チャレンジURLへアクセスした場合、WorkerがHTMLRewriterで以下を変更する。

```text
title
og:title
og:description
og:url
```

問題や正解はOGPへ出さない。

## 9. セキュリティ・不正対策

現状のMVPで実施済み。

```text
回答の二重送信防止
ギブアップ状態のサーバー検証
回答モードのサーバー検証
ニックネーム長制限
チャレンジ有効期限
SQLバインド
HTMLエスケープ
```

次の段階で必要。

```text
IP・playId単位のレート制限
同一端末のランキング連投抑止
管理API認証
CSRFを考慮した管理画面
NGワード
通報・非表示
```

## 10. 開発順

### Phase 1：今回

- 確認済み問題
- Wikipedia探索実験
- 自由入力
- 本人ギブアップ後の4択
- 非同期共有
- ランキング

### Phase 2：問題管理

- Wikipedia URL取り込み
- 目次編集
- 見出し内の答えマスク
- 別名編集
- 難易度設定
- 承認フロー
- revision差分警告

### Phase 3：運用改善

- 問題別統計
- 品質スコア再学習
- カテゴリ精度改善
- 問題通報
- ランキング不正対策
- 動的OGP画像

### Phase 4：リアルタイム

非同期版の利用が定着した場合のみ検討。

- Durable Objects
- WebSocket
- 早押し順のサーバー確定
- 再接続
- ホスト移譲
