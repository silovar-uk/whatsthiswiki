import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer } from '../worker/utils.js';

test('normalizes width, case and spaces', () => {
  assert.equal(normalizeAnswer(' Ｗｉｋｉ Ｐｅｄｉａ '), 'wikipedia');
});

test('normalizes katakana to hiragana', () => {
  assert.equal(normalizeAnswer('オニギリ'), normalizeAnswer('おにぎり'));
});

test('ignores common punctuation', () => {
  assert.equal(normalizeAnswer('トム・と・ジェリー'), normalizeAnswer('トムとジェリー'));
});
