# What's This Wiki? ライト版設計

## 1. 方針

最優先は、説明や登録を挟まずに遊べること。

```text
トップを開く
  ↓
条件を選ぶ
  ↓
すぐ出題
  ↓
結果を表示
  ↓
同じ問題のURLを共有
```

削除したもの。

```text
ログイン
アカウント
ニックネーム
共通ランキング
サーバーへのプレイ保存
Cloudflare Workers
D1
```

残すもの。

```text
確認済み問題
Wikipediaランダム探索
自由入力
本人のギブアップ後だけ4択
端末内ベスト記録
同一問題URL共有
```

## 2. 完全静的構成

```text
GitHub Pages
  ├─ HTML
  ├─ CSS
  └─ JavaScript
       ├─ 確認済み問題JSON
       ├─ MediaWiki APIへの直接通信
       ├─ ゲーム状態
       └─ localStorage
```

独自APIとDBを持たない。GitHub Pagesから配信できるため、運用対象は静的ファイルのみ。

## 3. 共有URL

問題セットを次の形で短縮する。

```js
{
  v: 1,
  s: "curated",
  c: "all",
  d: "mixed",
  q: [
    {
      t: "記事名",
      a: ["別名"],
      h: [{ level: 1, text: "見出し" }],
      o: ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      u: "元記事URL",
      r: 123456,
      d: "normal"
    }
  ]
}
```

処理順。

```text
JSON化
  ↓
CompressionStream対応ブラウザ：gzip
非対応ブラウザ：そのままUTF-8
  ↓
Base64URL
  ↓
#challenge=... に格納
```

URLフラグメントを使うため、共有データはGitHub Pagesのサーバーへ送信されない。

ただし、暗号化ではない。URLを解析すれば正解を確認できるため、競技性より手軽さを優先した設計。

## 4. ゲーム状態

ゲーム中だけメモリに保持する。

```js
{
  challenge,
  encoded,
  shareUrl,
  index,
  answers,
  startedAt,
  questionStartedAt,
  resolved,
  gaveUp
}
```

ページを再読み込みした場合は、共有URLの問題セットを最初から遊び直す。

## 5. 回答ルール

```text
自由入力：1回
正解：1,000点＋速度ボーナス最大500点
不正解：0点
```

ギブアップは明示的な2段階操作。

```text
「わからないのでギブアップ」
  ↓
注意文を表示
  ↓
「4択を見る」
```

4択を開いた後は自由入力に戻れない。

```text
4択正解：350点
4択不正解：0点
```

## 6. 表記揺れ

`normalizeAnswer()`で次を統一する。

```text
Unicode NFKC
英字の大文字・小文字
全角・半角
空白
一般的な記号
カタカナ・ひらがな
```

正解タイトルと登録済み別名に対して完全一致判定する。部分一致は誤判定を避けるため使用しない。

Wikipedia探索では、選ばれた記事へのリダイレクト名を別名として取得する。

## 7. Wikipedia探索

### 全体ランダム

```text
generator=random
namespace=0
```

### ジャンル指定

```text
generator=categorymembers
Category:食品 / 人物 / 作品 / 地理 / 科学 / スポーツ
namespace=0
```

候補記事を取得後、`action=parse`の`tocdata`を使用する。互換性のため、旧`sections`もフォールバックとして受け取る。

### 品質フィルター

除外。

```text
曖昧さ回避
一覧・年号記事
目次4未満または22超
見出しに記事タイトルが含まれる
固有見出しが2件未満
汎用見出し率が高い
要注意カテゴリキーワード
```

評価。

```text
固有見出し率
目次数
タイトル長
```

実験モードは最大3ラウンド、1ラウンド最大22記事、同時通信4件に抑える。

## 8. 保存

結果全体や履歴は保存しない。

同じ共有問題におけるベスト記録だけ`localStorage`へ保存する。

```text
whatsthiswiki:best:<共有データのハッシュ>
```

保存内容。

```text
score
correctCount
giveUps
elapsedMs
savedAt
```

## 9. エラー時

- Wikipedia API失敗：条件選択へ戻す
- 良問不足：条件変更を促す
- 共有URL破損：トップへ戻す
- gzip非対応：プレーン共有を生成
- クリップボード非対応：URLを選択できるダイアログを表示

## 10. 今後の改善

ライトさを崩さない範囲に限定する。

```text
確認済み問題の追加
問題URLを手動登録するローカル編集ツール
共有結果画像の生成
Wikipedia探索のカテゴリ改善
問題ごとの「微妙だった」端末内フィードバック
PWA対応
```
