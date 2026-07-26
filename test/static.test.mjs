import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  compactChallenge,
  decodeChallenge,
  encodeChallenge,
  expandChallenge,
  getInitialCharacter,
  isCorrectAnswer,
  normalizeAnswer,
  scoreAnswer,
  trailingCorrectCount
} from '../public/utils.js';
import { extractWikipediaTitle } from '../public/wiki.js';

// mobile-answer-tuning.jsのMutationObserverは#app配下を監視している。
// このファイルからDOMを書き換えると、observerが自分自身を再発火させて
// 無限ループになり、問題画面でメインスレッドが停止する。
test('mobile-answer-tuning.jsはDOMを書き換えない', async () => {
  const source = await readFile(new URL('../public/mobile-answer-tuning.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.(textContent|innerHTML|innerText)\s*=/);
  assert.doesNotMatch(source, /\.(replaceChildren|insertAdjacentHTML)\s*\(/);
});

test('ヒントボタンの文言とclassはapp.jsが持つ', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /hint-button hint-button--primary/);
  assert.match(source, /hint-button hint-button--secondary/);
  assert.match(source, /最初の1文字を見る/);
  assert.match(source, /4択から選ぶ/);
});

// questions-extra.js は CURATED_QUESTIONS を直接 push で書き換える。
// app-entry.js の読み込みが外れると、追加問題が黙って出題されなくなる。
test('app-entry.jsが追加問題をapp.jsより先に読み込む', async () => {
  const source = await readFile(new URL('../public/app-entry.js', import.meta.url), 'utf8');
  const extraIndex = source.indexOf('questions-extra.js');
  const appIndex = source.indexOf("'./app.js");
  assert.notEqual(extraIndex, -1, 'questions-extra.jsが読み込まれていない');
  assert.ok(extraIndex < appIndex, 'questions-extra.jsはapp.jsより先に読み込む必要がある');
});

test('追加問題がCURATED_QUESTIONSへ重複なく統合される', async () => {
  const { CURATED_QUESTIONS } = await import('../public/questions.js');
  const baseCount = CURATED_QUESTIONS.length;
  await import('../public/questions-extra.js');

  assert.ok(CURATED_QUESTIONS.length > baseCount, '追加問題が統合されていない');
  const ids = CURATED_QUESTIONS.map((question) => question.id);
  assert.equal(new Set(ids).size, ids.length, 'id が重複している');
  assert.ok(CURATED_QUESTIONS.every((question) => question.sections.length > 0));
});

test('回答表記を正規化する', () => {
  assert.equal(normalizeAnswer(' ラー メン！'), 'らーめん');
  assert.equal(normalizeAnswer('ＴＯＫＹＯ・ＴＯＷＥＲ'), 'tokyotower');
});

test('別名を含めて正解判定する', () => {
  const question = { title: 'おにぎり', aliases: ['おむすび'] };
  assert.equal(isCorrectAnswer('おむすび', question), true);
  assert.equal(isCorrectAnswer('おにぎりの作り方', question), false);
});

test('ヒント段階ごとに点数を分ける', () => {
  assert.equal(scoreAnswer({ correct: true, mode: 'text', elapsedMs: 0 }), 1500);
  assert.equal(scoreAnswer({ correct: true, mode: 'initial', elapsedMs: 0 }), 900);
  assert.equal(scoreAnswer({ correct: true, mode: 'choice', elapsedMs: 0 }), 350);
  assert.equal(scoreAnswer({ correct: false, mode: 'text', elapsedMs: 0 }), 0);
});

test('先頭の書記素を取得する', () => {
  assert.equal(getInitialCharacter('富士山'), '富');
  assert.equal(getInitialCharacter('🍙おにぎり'), '🍙');
});

test('末尾からの連続正解数を数える', () => {
  assert.equal(trailingCorrectCount([]), 0);
  assert.equal(trailingCorrectCount([{ correct: true }, { correct: true }]), 2);
  assert.equal(trailingCorrectCount([{ correct: true }, { correct: false }]), 0);
  assert.equal(trailingCorrectCount([{ correct: false }, { correct: true }]), 1);
});

test('日本語版WikipediaのURLから記事名を取得する', () => {
  assert.equal(extractWikipediaTitle('https://ja.wikipedia.org/wiki/%E5%AF%8C%E5%A3%AB%E5%B1%B1'), '富士山');
  assert.equal(extractWikipediaTitle('https://ja.m.wikipedia.org/wiki/%E6%9D%B1%E4%BA%AC%E3%82%BF%E3%83%AF%E3%83%BC'), '東京タワー');
  assert.throws(() => extractWikipediaTitle('https://example.com/wiki/test'), /日本語版Wikipedia/);
});

test('共有用データを短縮・復元する', async () => {
  const source = {
    source: 'custom',
    category: 'custom',
    difficulty: 'mixed',
    questions: [{
      id: 'q1',
      title: 'おにぎり',
      aliases: ['おむすび'],
      sections: [{ level: 1, text: '特徴' }],
      choices: ['おにぎり', 'モアイ', '将棋', '富士山'],
      sourceUrl: 'https://ja.wikipedia.org/wiki/おにぎり'
    }]
  };
  const restored = expandChallenge(compactChallenge(source));
  assert.equal(restored.questions.length, 1);
  assert.equal(restored.questions[0].title, 'おにぎり');

  const encoded = await encodeChallenge(source, { forcePlain: true });
  const decoded = await decodeChallenge(encoded);
  assert.equal(decoded.source, 'custom');
  assert.equal(decoded.questions[0].choices.length, 4);
});
