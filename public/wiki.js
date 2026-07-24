import { normalizeAnswer, shuffle } from './utils.js';

const API_URL = 'https://ja.wikipedia.org/w/api.php';
const GENERIC_HEADINGS = new Set([
  '概要', '歴史', '沿革', '特徴', '名称', '関連項目', '脚注', '注釈', '出典', '参考文献',
  '外部リンク', 'ギャラリー', '一覧', 'その他', '評価', '批判', '背景', '経緯', '概要と歴史'
]);
const BANNED_TITLE_PATTERNS = [
  /一覧$/, /の一覧$/, /曖昧さ回避/, /^\d{1,4}年$/, /^\d+$/, /選挙区$/, /学校一覧$/
];
const BANNED_CATEGORY_WORDS = [
  'ポルノ', '性行為', '児童虐待', '自殺', '殺人事件', '大量殺人', 'テロ事件', '拷問', '死刑',
  '未解決事件', 'レイプ', '強姦', '猟奇', '事故死', '災害犠牲者'
];
const CATEGORY_ROOTS = {
  food: ['食品', '料理'],
  people: ['人物'],
  works: ['作品'],
  places: ['地理', '観光地'],
  science: ['科学'],
  sports: ['スポーツ']
};

function apiUrl(params) {
  const url = new URL(API_URL);
  Object.entries({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params })
    .forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url;
}

async function fetchJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Wikipedia API: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.info || 'Wikipedia APIエラー');
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtml(value = '') {
  const element = document.createElement('textarea');
  element.innerHTML = String(value).replace(/<[^>]*>/g, '');
  return element.value.trim();
}

function flattenTocData(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.sections)) return raw.sections;
  if (Array.isArray(raw.entries)) return raw.entries;
  return [];
}

function parseSections(parse) {
  const tocItems = flattenTocData(parse.tocdata);
  const source = tocItems.length ? tocItems : (parse.sections || []);
  return source
    .map((item) => ({
      level: Number(item.toclevel ?? item.level ?? item.hLevel ?? 1),
      text: stripHtml(item.line ?? item.text ?? item.number ?? '')
    }))
    .filter((item) => item.text && Number.isFinite(item.level))
    .map((item) => ({ ...item, level: Math.min(4, Math.max(1, item.level)) }));
}

function estimateDifficulty(title, sections, uniqueRatio) {
  const signal = title.length + sections.length * 0.8 - uniqueRatio * 8;
  if (signal <= 7) return 'easy';
  if (signal >= 15) return 'hard';
  return 'normal';
}

function evaluateCandidate(page, parse, requestedCategory) {
  const title = parse.title || page.title || '';
  if (!title || BANNED_TITLE_PATTERNS.some((pattern) => pattern.test(title))) return null;

  const categories = (parse.categories || []).map((item) => item['*'] || item.category || item.title || '');
  if (categories.some((category) => BANNED_CATEGORY_WORDS.some((word) => category.includes(word)))) return null;

  const sections = parseSections(parse);
  if (sections.length < 4 || sections.length > 22) return null;

  const normalizedTitle = normalizeAnswer(title);
  if (!normalizedTitle) return null;
  if (sections.some((section) => normalizeAnswer(section.text).includes(normalizedTitle))) return null;

  const specificCount = sections.filter((section) => !GENERIC_HEADINGS.has(section.text)).length;
  const uniqueRatio = specificCount / sections.length;
  if (specificCount < 2 || uniqueRatio < 0.26) return null;

  let quality = uniqueRatio * 0.65;
  quality += Math.max(0, 1 - Math.abs(9 - sections.length) / 14) * 0.25;
  quality += Math.max(0, 1 - Math.abs(6 - title.length) / 14) * 0.1;

  return {
    id: `wiki-${parse.pageid || page.pageid}`,
    title,
    aliases: [],
    category: requestedCategory === 'all' ? 'all' : requestedCategory,
    difficulty: estimateDifficulty(title, sections, uniqueRatio),
    quality,
    revisionId: parse.revid || null,
    sourceUrl: `https://ja.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    sections
  };
}

async function fetchPagePool(category, limit = 35) {
  const common = {
    prop: 'info|pageprops',
    inprop: 'url'
  };
  if (category && category !== 'all') {
    const roots = CATEGORY_ROOTS[category] || CATEGORY_ROOTS.science;
    const root = shuffle(roots)[0];
    const data = await fetchJson(apiUrl({
      ...common,
      generator: 'categorymembers',
      gcmtitle: `Category:${root}`,
      gcmnamespace: 0,
      gcmtype: 'page',
      gcmlimit: Math.min(50, limit)
    }));
    return shuffle(Object.values(data.query?.pages || {}));
  }

  const data = await fetchJson(apiUrl({
    ...common,
    generator: 'random',
    grnnamespace: 0,
    grnlimit: Math.min(50, limit)
  }));
  return Object.values(data.query?.pages || {});
}

async function parsePage(page) {
  if (page.pageprops?.disambiguation !== undefined) return null;
  const url = new URL(API_URL);
  Object.entries({
    action: 'parse',
    pageid: page.pageid,
    prop: 'tocdata|sections|revid|categories',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    origin: '*'
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  try {
    const data = await fetchJson(url);
    return data.parse || null;
  } catch {
    return null;
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function addAliases(questions) {
  if (!questions.length) return questions;
  const data = await fetchJson(apiUrl({
    prop: 'redirects',
    titles: questions.map((question) => question.title).join('|'),
    rdlimit: 'max'
  }));
  const byTitle = new Map(Object.values(data.query?.pages || {}).map((page) => [page.title, page]));
  return questions.map((question) => ({
    ...question,
    aliases: (byTitle.get(question.title)?.redirects || []).map((item) => item.title).slice(0, 12)
  }));
}

function buildChoices(selected, distractorPool) {
  const allTitles = [...new Set([...selected, ...distractorPool].map((question) => question.title))];
  return selected.map((question) => {
    const distractors = shuffle(allTitles.filter((title) => title !== question.title)).slice(0, 3);
    return { ...question, choices: shuffle([question.title, ...distractors]) };
  });
}

export async function discoverQuestions({
  category = 'all',
  difficulty = 'mixed',
  count = 5,
  onProgress = () => {}
} = {}) {
  const target = Math.min(5, Math.max(3, Number(count) || 5));
  const accepted = new Map();
  let attempted = 0;

  for (let round = 0; round < 3 && accepted.size < target + 4; round += 1) {
    onProgress(`Wikipediaを探索中… ${accepted.size}/${target}問`);
    const pool = await fetchPagePool(category, 35);
    const pages = pool.filter((page) => page.pageid && !accepted.has(page.title)).slice(0, 22);
    const parsed = await mapWithConcurrency(pages, 4, async (page) => {
      attempted += 1;
      const parse = await parsePage(page);
      return parse ? evaluateCandidate(page, parse, category) : null;
    });
    parsed.filter(Boolean).forEach((question) => accepted.set(question.title, question));
  }

  let candidates = [...accepted.values()].sort((a, b) => b.quality - a.quality);
  if (difficulty !== 'mixed') {
    const exact = candidates.filter((question) => question.difficulty === difficulty);
    candidates = [...exact, ...candidates.filter((question) => question.difficulty !== difficulty)];
  }
  const minimumPool = Math.max(target, 4);
  if (candidates.length < minimumPool) {
    throw new Error(`良問を${target}問そろえられませんでした（${attempted}記事を確認）。条件を変えて再試行してください。`);
  }

  const selected = shuffle(candidates.slice(0, Math.max(target + 3, target))).slice(0, target);
  const withAliases = await addAliases(selected);
  return buildChoices(withAliases, candidates.filter((item) => !selected.some((selectedItem) => selectedItem.title === item.title)));
}
