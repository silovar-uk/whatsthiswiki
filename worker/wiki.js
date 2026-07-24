import { normalizeAnswer, shuffle, stripHtml } from './utils.js';

const API_URL = 'https://ja.wikipedia.org/w/api.php';
const USER_AGENT = 'WhatsThisWiki/0.1 (https://github.com/silovar-uk/whatsthiswiki)';

const CATEGORY_MAP = {
  food: '日本の食品',
  people: '日本の人物',
  works: '作品',
  places: '日本の地理',
  science: '科学'
};

const GENERIC_HEADINGS = new Set([
  '概要', '歴史', '沿革', '脚注', '注釈', '出典', '参考文献', '関連項目',
  '外部リンク', '参考資料', 'ギャラリー', 'その他', '備考'
]);

const BLOCKED_TITLE_PATTERNS = [
  /一覧$/, /の一覧$/, /曖昧さ回避/, /^\d{1,4}年$/, /^\d+$/, /選挙区$/, /学校一覧$/
];

const BLOCKED_CATEGORY_WORDS = [
  'ポルノ', '性犯罪', '殺人事件', '自殺', '児童虐待', '露骨な表現'
];

function wikiUrl(params) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    ...params
  }).toString();
  return url;
}

async function fetchWiki(params) {
  const response = await fetch(wikiUrl(params), {
    headers: { 'user-agent': USER_AGENT }
  });
  if (!response.ok) throw new Error(`Wikipedia API error: ${response.status}`);
  const data = await response.json();
  if (data?.error) throw new Error(data.error.info || 'Wikipedia API returned an error');
  return data;
}

async function fetchRandomTitles(limit) {
  const data = await fetchWiki({
    list: 'random',
    rnnamespace: '0',
    rnfilterredir: 'nonredirects',
    rnminsize: '2500',
    rnlimit: String(limit)
  });
  return (data?.query?.random ?? []).map((page) => page.title);
}

async function fetchCategoryTitles(categoryKey, limit) {
  const category = CATEGORY_MAP[categoryKey] ?? CATEGORY_MAP.food;
  const data = await fetchWiki({
    list: 'categorymembers',
    cmtitle: `Category:${category}`,
    cmnamespace: '0',
    cmtype: 'page',
    cmlimit: String(Math.min(limit * 4, 200))
  });
  return shuffle((data?.query?.categorymembers ?? []).map((page) => page.title)).slice(0, limit);
}

async function parseArticle(title, pageMeta = {}) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({
    action: 'parse',
    format: 'json',
    formatversion: '2',
    origin: '*',
    page: title,
    prop: 'tocdata|revid|categories'
  }).toString();

  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data?.parse) return null;

  const toc = data.parse.tocdata?.sections ?? data.parse.sections ?? [];
  const sections = toc
    .map((section) => ({
      level: Number(section.toclevel ?? section.level ?? 1),
      text: stripHtml(section.line ?? section.text ?? section.anchor ?? '')
    }))
    .filter((section) => section.text);

  const categories = (data.parse.categories ?? []).map((item) => stripHtml(item['*'] ?? item.category ?? ''));

  if (pageMeta.isDisambiguation) return null;

  return {
    title,
    aliases: [title],
    sections,
    categories,
    revisionId: Number(data.parse.revid) || null,
    sourceUrl: `https://ja.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
  };
}

function evaluateCandidate(article) {
  if (!article) return null;
  if (BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(article.title))) return null;
  if (article.categories.some((category) => BLOCKED_CATEGORY_WORDS.some((word) => category.includes(word)))) return null;

  const count = article.sections.length;
  if (count < 4 || count > 22) return null;

  const normalizedTitle = normalizeAnswer(article.title);
  if (article.sections.some((section) => normalizeAnswer(section.text).includes(normalizedTitle))) return null;

  const distinctive = article.sections.filter((section) => !GENERIC_HEADINGS.has(section.text));
  const distinctiveRatio = distinctive.length / count;
  if (distinctive.length < 2 || distinctiveRatio < 0.35) return null;

  const idealCountScore = Math.max(0, 1 - Math.abs(count - 9) / 14);
  const titleLengthScore = article.title.length >= 2 && article.title.length <= 18 ? 1 : 0.5;
  const qualityScore = Number((distinctiveRatio * 0.55 + idealCountScore * 0.3 + titleLengthScore * 0.15).toFixed(3));

  let estimatedDifficulty = 'normal';
  if (qualityScore >= 0.78 && count >= 6) estimatedDifficulty = 'easy';
  if (qualityScore < 0.58 || article.title.length > 16) estimatedDifficulty = 'hard';

  return { ...article, qualityScore, estimatedDifficulty };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function fetchPageMetadata(titles) {
  if (!titles.length) return new Map();
  const data = await fetchWiki({
    prop: 'pageprops',
    titles: titles.join('|')
  }).catch(() => null);

  return new Map((data?.query?.pages ?? []).map((page) => [page.title, {
    isDisambiguation: page.pageprops?.disambiguation !== undefined
  }]));
}

async function attachAliases(candidates) {
  if (!candidates.length) return candidates;
  const data = await fetchWiki({
    prop: 'redirects',
    titles: candidates.map((item) => item.title).join('|'),
    rdlimit: '100'
  }).catch(() => null);

  const redirectsByTitle = new Map((data?.query?.pages ?? []).map((page) => [
    page.title,
    (page.redirects ?? []).map((item) => item.title).filter(Boolean).slice(0, 29)
  ]));

  return candidates.map((candidate) => ({
    ...candidate,
    aliases: [candidate.title, ...(redirectsByTitle.get(candidate.title) ?? [])]
  }));
}

export async function findCandidates({ sourceMode, category, difficulty, needed }) {
  // Workerの外部サブリクエスト数を抑えるため、1回の生成で最大40記事まで解析する。
  const fetchLimit = Math.min(Math.max(needed * 3, 24), 40);
  const titles = sourceMode === 'category'
    ? await fetchCategoryTitles(category, fetchLimit)
    : await fetchRandomTitles(fetchLimit);

  const metadata = await fetchPageMetadata(titles);
  const parsed = await mapWithConcurrency(titles, 5, (title) => parseArticle(title, metadata.get(title)));
  let candidates = parsed.map(evaluateCandidate).filter(Boolean);

  if (difficulty !== 'mixed') {
    const matching = candidates.filter((item) => item.estimatedDifficulty === difficulty);
    if (matching.length >= needed) candidates = matching;
  }

  const selected = shuffle(candidates).slice(0, needed);
  return attachAliases(selected);
}

export function createQuestionSet(candidates, questionCount) {
  if (candidates.length < questionCount) {
    throw new Error('条件に合う記事を十分に取得できませんでした。条件を変えて再試行してください。');
  }

  return candidates.slice(0, questionCount).map((candidate, index, all) => {
    const distractors = shuffle(all.filter((_, itemIndex) => itemIndex !== index))
      .slice(0, 3)
      .map((item) => item.title);
    const choices = shuffle([candidate.title, ...distractors]);

    return {
      ...candidate,
      choices
    };
  });
}
