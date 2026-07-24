# What's This Wiki?

Wikipediaの記事を、目次だけで当てるライトなクイズアプリです。

- ログインなし
- ニックネーム入力なし
- DBなし
- URLを開いてすぐ遊べる
- まず自由入力で回答
- 自分でギブアップした場合だけ4択を表示
- 問題・順番・選択肢が同じ共有URLを発行
- 結果は画面表示と端末内ベスト記録のみ

## 公開URL

GitHub Pagesを有効化すると、以下で公開されます。

```text
https://silovar-uk.github.io/whatsthiswiki/
```

## 構成

```text
public/
  index.html      画面の土台
  app.js          ゲーム進行・共有・UI
  questions.js    確認済み問題
  wiki.js         Wikipedia探索・品質判定
  utils.js        正規化・採点・共有URL圧縮
  styles.css      レスポンシブUI

test/
  static.test.mjs

.github/workflows/
  pages.yml       GitHub Pagesへの自動公開
  ci.yml          構文チェックとテスト
```

## ローカル起動

外部パッケージは不要です。

```bash
npm run dev
```

その後、以下を開きます。

```text
http://localhost:4173
```

## チェック

```bash
npm run check
npm test
```

## 遊び方

1. 確認済み問題、またはWikipedia探索を選ぶ
2. ジャンル・難易度・問題数を選ぶ
3. 目次だけを見て自由入力で回答する
4. 分からない場合は、自分でギブアップして4択を開く
5. 結果画面から同じ問題を友達に送る

## 共有の仕組み

サーバーやDBには保存しません。問題セットをJSONにし、対応ブラウザではgzip圧縮してURLのフラグメントへ格納します。

```text
https://silovar-uk.github.io/whatsthiswiki/#challenge=...
```

フラグメントはWebサーバーへ送信されません。同じURLを開くと、問題・順番・4択を復元します。

共有URLには正解データも含まれるため、本格的な不正対策には向きません。友達同士でライトに遊ぶ用途を前提にしています。

## Wikipedia探索

Wikipedia探索はMediaWiki Action APIへブラウザから直接アクセスします。

候補記事について、次を確認します。

- 本文名前空間の記事
- 曖昧さ回避を除外
- 目次4〜22項目
- 見出しに記事名が露出していない
- 汎用見出しだけではない
- 一覧・年号記事を除外
- 一部の要注意カテゴリを除外

探索結果は自動判定のため、確認済み問題より品質が不安定です。

## GitHub Pages

`main`へpushすると、`.github/workflows/pages.yml`が`public`フォルダを公開します。

初回のみ、リポジトリの **Settings → Pages → Source** が **GitHub Actions** になっていることを確認してください。

## 権利・表示

- 回答後にWikipediaの元記事へのリンクを表示
- Wikipedia由来の情報を利用
- Wikimedia FoundationおよびQuizKnockの公式サービスではありません
