import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compactChallenge,
  decodeChallenge,
  encodeChallenge,
  expandChallenge,
  isCorrectAnswer,
  normalizeAnswer,
  scoreAnswer
} from '../public/utils.js';
import { CURATED_QUESTIONS } from '../public/questions.js';

test('回答表記を正規化する', () => {
  assert.equal(normalizeAnswer(' ラー メン！'), 'らーめん');
  assert.equal(normalizeAnswer('ＴＯＫＹＯ・ＴＯＷＥＲ'), 'tokyotower');
});

test('別名を含めて正解判定する', () => {
  const question = CURATED_QUESTIONS.find((item) => item.id === 'onigiri');
  assert.equal(isCorrectAnswer('おむすび', question), true);
  assert.equal(isCorrectAnswer('おにぎりの作り方', question), false);
});

test('自由入力と4択で点数を分ける', () => {
  assert.equal(scoreAnswer({ correct: true, mode: 'text', elapsedMs: 0 }), 1500);
  assert.equal(scoreAnswer({ correct: true, mode: 'text', elapsedMs: 60_000 }), 1000);
  assert.equal(scoreAnswer({ correct: true, mode: 'choice', elapsedMs: 1 }), 350);
  assert.equal(scoreAnswer({ correct: false, mode: 'text', elapsedMs: 1 }), 0);
});

test('共有用データを短縮・復元する', () => {
  const source = {
    source: 'curated',
    category: 'all',
    difficulty: 'mixed',
    questions: [{
      ...CURATED_QUESTIONS[0],
      choices: ['おにぎり', 'モアイ', '将棋', '富士山']
    }]
  };
  const restored = expandChallenge(compactChallenge(source));
  assert.equal(restored.questions[0].title, 'おにぎり');
  assert.deepEqual(restored.questions[0].choices, source.questions[0].choices);
});

test('プレーン形式の共有URLデータを往復する', async () => {
  const source = {
    source: 'curated',
    category: 'food',
    difficulty: 'easy',
    questions: [{
      ...CURATED_QUESTIONS[0],
      choices: ['おにぎり', 'モアイ', '将棋', '富士山']
    }]
  };
  const encoded = await encodeChallenge(source, { forcePlain: true });
  const restored = await decodeChallenge(encoded);
  assert.equal(restored.category, 'food');
  assert.equal(restored.questions[0].title, 'おにぎり');
});
