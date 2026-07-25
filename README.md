# What's This Wiki?

Wikipediaの記事を、目次だけで当てるクイズアプリです。

- ログイン・ニックネーム入力なし
- 自由入力で回答
- ヒントは「最初の1文字」「4択」の2段階
- Wikipediaをランダム探索して出題
- Wikipediaの記事URLを1〜10件入力してオリジナル問題を作成
- 1件だけなら1問のクイズとして利用可能
- 問題・順番・選択肢が同じ共有URLを発行
- 結果は画面表示と端末内ベスト記録のみ

## 公開URL

```text
https://silovar-uk.github.io/whatsthiswiki/
```

## 遊び方

1. 確認済み問題、Wikipedia探索、URLから作成のいずれかを選ぶ
2. 目次を見て記事名を入力する
3. 必要に応じて「最初の1文字」または「4択」を使う
4. 結果画面から同じ問題を共有する

## ヒントと採点

```text
ヒントなし：1,000点＋速度ボーナス最大500点
最初の1文字：650点＋速度ボーナス最大250点
4択：350点
不正解：0点
```

「最初の1文字」を使うと、記事名の先頭1文字が回答欄へ入力されます。そのまま自由入力で回答できます。

「4択」を表示すると、自由入力には戻れません。

## オリジナル問題

トップ画面で「URLから作る」を選択し、日本語版Wikipediaの記事URLを入力します。

```text
https://ja.wikipedia.org/wiki/富士山
https://ja.wikipedia.org/wiki/東京タワー
```

- 1行に1件
- 1〜10件まで
- 入力順で問題セットを作成
- 記事名が目次に含まれる場合は `〇〇` に置換
- 1問だけの場合、4択の誤答候補は既存問題から補完
- 作成した問題も共有URLに含められる

## 共有の仕組み

サーバーやDBには保存しません。問題セットをJSONにし、対応ブラウザではgzip圧縮してURLのフラグメントへ格納します。

```text
https://silovar-uk.github.io/whatsthiswiki/#challenge=...
```

同じURLを開くと、問題・順番・選択肢を復元します。

共有URLには正解データも含まれるため、本格的な競技用途ではなく、友人同士で遊ぶ用途を前提にしています。

## ローカル起動

```bash
npm run dev
```

```text
http://localhost:4173
```

## チェック

```bash
npm run check
npm test
```

## 構成

```text
public/
  index.html
  app.js
  questions.js
  wiki.js
  utils.js
  styles.css        基礎レイアウト
  gags.css          視覚表現・モーション
  assets/

test/
  static.test.mjs
```
