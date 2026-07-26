const SHARE_VERSION = 1;

export function normalizeAnswer(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[\s\u3000・･,，.。!！?？:：;；'"“”‘’`´^~〜～_＿\-‐‑‒–—―()（）\[\]［］{}｛｝<>＜＞「」『』【】〔〕〈〉《》]/g, '');
}

export function isCorrectAnswer(input, question) {
  const normalized = normalizeAnswer(input);
  if (!normalized) return false;
  return [question.title, ...(question.aliases || [])]
    .some((candidate) => normalizeAnswer(candidate) === normalized);
}

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

export function scoreAnswer({ correct, mode, elapsedMs }) {
  if (!correct) return 0;
  if (mode === 'choice') return 350;

  const seconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  if (mode === 'initial') {
    return 650 + Math.max(0, 250 - seconds * 5);
  }
  return 1000 + Math.max(0, 500 - seconds * 10);
}

export function getInitialCharacter(value = '') {
  const source = String(value).trim();
  if (!source) return '';
  if (typeof Intl?.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
    return segmenter.segment(source)[Symbol.iterator]().next().value?.segment || '';
  }
  return Array.from(source)[0] || '';
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}分${String(seconds).padStart(2, '0')}秒` : `${seconds}秒`;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[char]);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function compactChallenge(challenge) {
  return {
    v: SHARE_VERSION,
    s: challenge.source,
    c: challenge.category,
    d: challenge.difficulty,
    q: challenge.questions.map((question) => ({
      t: question.title,
      a: question.aliases || [],
      h: question.sections,
      o: question.choices,
      u: question.sourceUrl,
      r: question.revisionId || null,
      d: question.difficulty || 'normal'
    }))
  };
}

export function expandChallenge(payload) {
  if (!payload || payload.v !== SHARE_VERSION || !Array.isArray(payload.q)) {
    throw new Error('共有データの形式が正しくありません。');
  }
  const questions = payload.q.map((question, index) => {
    if (!question?.t || !Array.isArray(question?.h) || !Array.isArray(question?.o)) {
      throw new Error(`共有データの${index + 1}問目が壊れています。`);
    }
    return {
      id: `shared-${index + 1}`,
      title: question.t,
      aliases: Array.isArray(question.a) ? question.a : [],
      sections: question.h,
      choices: question.o,
      sourceUrl: question.u,
      revisionId: question.r,
      difficulty: question.d || 'normal'
    };
  });
  if (questions.length < 1 || questions.length > 10) {
    throw new Error('共有できる問題数は1〜10問です。');
  }
  return {
    version: payload.v,
    source: payload.s || 'shared',
    category: payload.c || 'all',
    difficulty: payload.d || 'mixed',
    questions
  };
}

export async function encodeChallenge(challenge) {
  const text = JSON.stringify(compactChallenge(challenge));
  const bytes = new TextEncoder().encode(text);
  return `j.${bytesToBase64Url(bytes)}`;
}

export async function decodeChallenge(encoded) {
  const [format, body] = String(encoded || '').split('.', 2);
  if (!body || !['g', 'j'].includes(format)) {
    throw new Error('共有URLの形式が正しくありません。');
  }
  let bytes = base64UrlToBytes(body);
  if (format === 'g') {
    if (!('DecompressionStream' in globalThis)) {
      throw new Error('このブラウザでは圧縮された共有URLを開けません。');
    }
    bytes = await gunzip(bytes);
  }
  if (bytes.byteLength > 250_000) {
    throw new Error('共有データが大きすぎます。');
  }
  return expandChallenge(JSON.parse(new TextDecoder().decode(bytes)));
}

export function getChallengeFromHash(hash = globalThis.location?.hash || '') {
  const params = new URLSearchParams(String(hash).replace(/^#/, ''));
  return params.get('challenge');
}

export function buildChallengeUrl(encoded, locationLike = globalThis.location) {
  const url = new URL(locationLike.href);
  url.search = '';
  url.hash = new URLSearchParams({ challenge: encoded }).toString();
  return url.toString();
}

export function saveBestScore(key, result) {
  try {
    const storageKey = `whatsthiswiki:best:${key}`;
    const previous = JSON.parse(localStorage.getItem(storageKey) || 'null');
    const isBetter = !previous
      || result.score > previous.score
      || (result.score === previous.score && result.elapsedMs < previous.elapsedMs);
    if (isBetter) localStorage.setItem(storageKey, JSON.stringify(result));
    return isBetter ? result : previous;
  } catch {
    return null;
  }
}

export function trailingCorrectCount(answers) {
  let count = 0;
  for (let i = answers.length - 1; i >= 0; i -= 1) {
    if (!answers[i].correct) break;
    count += 1;
  }
  return count;
}

export function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
