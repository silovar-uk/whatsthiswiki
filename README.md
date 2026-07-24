# What's This Wiki?

Wikipediaの記事を、目次だけで当てる非同期チャレンジ型クイズです。

- まず自由入力で回答
- 自分でギブアップした場合だけ4択を表示
- 同じ問題セットをURLで共有
- 得点・正答数・回答時間でランキング
- 通常は人が確認した問題を使用
- 「Wikipedia探索（実験）」では、その場でランダム記事を取得・選別

## 現在の実装範囲

### 遊ぶ

- 確認済み問題から5問／10問を生成
- Wikipedia全体からランダム探索
- ジャンル指定探索（食べ物・人物・作品・場所・科学）
- 難易度選択
- 自由入力の表記揺れ判定
- ギブアップ後のみ4択を解放
- 結果・ランキング保存
- Web Share API／クリップボード共有
- チャレンジURL向けOGP文言の差し替え

### 問題品質

実験モードでは、取得した記事を次の条件で自動選別します。

- 本文名前空間のみ
- リダイレクト除外
- 一定以上の記事サイズ
- 目次4〜22項目
- 曖昧さ回避・一覧系・年号記事を除外
- 見出し内に答えが露出する記事を除外
- 汎用見出しだけの記事を除外
- 一部の要注意カテゴリを除外
- 目次数・固有見出し率・タイトル長から品質と難易度を推定

## 技術構成

- フロントエンド：HTML / CSS / Vanilla JavaScript
- API：Cloudflare Workers
- DB：Cloudflare D1
- 静的配信：Cloudflare Workers Static Assets
- 記事取得：MediaWiki Action API

Reactなどのランタイム依存を持たせず、初期検証と保守を軽くしています。

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. D1を作成

```bash
npx wrangler d1 create whatsthiswiki
```

表示された`database_id`を`wrangler.toml`へ設定します。

```toml
[[d1_databases]]
binding = "DB"
database_name = "whatsthiswiki"
database_id = "ここを実際のIDに置換"
migrations_dir = "migrations"
```

### 3. ローカルDBを初期化

```bash
npm run db:migrate:local
```

### 4. 開発サーバー

```bash
npm run dev
```

### 5. 本番DBとデプロイ

```bash
npm run db:migrate:remote
npm run deploy
```

## テスト

```bash
npm test
```

現状は回答文字列の正規化をテストしています。

- 全角・半角
- 大文字・小文字
- 空白・記号
- カタカナ・ひらがな

## 主なAPI

```text
POST /api/challenges
GET  /api/challenges/:challengeId
POST /api/challenges/:challengeId/plays
GET  /api/challenges/:challengeId/leaderboard
GET  /api/plays/:playId
POST /api/plays/:playId/questions/:questionId/give-up
POST /api/plays/:playId/questions/:questionId/answer
POST /api/plays/:playId/finish
```

## 回答ルール

- 自由入力は1問につき1回
- 自由入力前に限り、本人がギブアップできる
- ギブアップAPIを実行したプレイだけ4択回答を受け付ける
- 時間経過による自動4択表示はしない
- 自由入力正解：1,000点＋最大500点の速度ボーナス
- 4択正解：350点
- 不正解：0点

## 注意点

- 自動生成問題は、確認済み問題より品質が不安定です。
- 初期の要注意カテゴリ除外はキーワードベースで、完全ではありません。
- チャレンジの有効期限は14日です。
- Wikipediaの記事は更新されるため、確認済み問題も定期的な再確認が必要です。
- Wikipedia由来の内容は、回答後に元記事へのリンクを表示します。
- 本アプリはWikimedia FoundationおよびQuizKnockの公式サービスではありません。

## 次に進める項目

1. 管理画面からWikipedia URLを取り込み
2. 目次の編集・答えマスク・別名登録
3. 下書き／承認／却下ワークフロー
4. 問題ごとの正答率・ギブアップ率集計
5. プレイデータから難易度を自動補正
6. 不適切記事フィルターの強化
7. OGP画像の動的生成
8. 連投・ランキング荒らし対策

詳しい設計は[`ARCHITECTURE.md`](./ARCHITECTURE.md)を参照してください。
