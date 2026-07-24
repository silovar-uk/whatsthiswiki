import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compactChallenge,
  decodeChallenge,
  encodeChallenge,
  expandChallenge,
  getInitialCharacter,
  isCorrectAnswer,
  normalizeAnswer,
  scoreAnswer
} from '../public/utils.js';
import { extractWikipediaTitle } from '../public/wiki.js';

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
