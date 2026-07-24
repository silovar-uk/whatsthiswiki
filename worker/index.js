import { createQuestionSet, findCandidates } from './wiki.js';
import {
  clampNumber,
  json,
  normalizeAnswer,
  parseJsonArray,
  randomId
} from './utils.js';

const VALID_QUESTION_SOURCES = new Set(['curated', 'experimental']);
const VALID_SOURCE_MODES = new Set(['random', 'category']);
const VALID_DIFFICULTIES = new Set(['easy', 'normal', 'hard', 'mixed']);
const VALID_CATEGORIES = new Set(['food', 'people', 'works', 'places', 'science']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith('/api/')) {
        return await handleApi(request, env, url);
      }

      if (request.method === 'GET' && url.pathname.startsWith('/challenge/')) {
        return renderChallengeShell(request, env, url);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: error instanceof Error ? error.message : '予期しないエラーが発生しました。' }, { status: 500 });
    }
  }
};

async function handleApi(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({ ok: true, service: 'whatsthiswiki' });
  }

  if (request.method === 'POST' && url.pathname === '/api/challenges') {
    return createChallenge(request, env);
  }

  const challengeMatch = url.pathname.match(/^\/api\/challenges\/([^/]+)$/);
  if (request.method === 'GET' && challengeMatch) {
    return getChallenge(env, challengeMatch[1]);
  }

  const startPlayMatch = url.pathname.match(/^\/api\/challenges\/([^/]+)\/plays$/);
  if (request.method === 'POST' && startPlayMatch) {
    return startPlay(request, env, startPlayMatch[1]);
  }

  const leaderboardMatch = url.pathname.match(/^\/api\/challenges\/([^/]+)\/leaderboard$/);
  if (request.method === 'GET' && leaderboardMatch) {
    return getLeaderboard(env, leaderboardMatch[1]);
  }

  const playMatch = url.pathname.match(/^\/api\/plays\/([^/]+)$/);
  if (request.method === 'GET' && playMatch) {
    return getPlay(env, playMatch[1]);
  }

  const giveUpMatch = url.pathname.match(/^\/api\/plays\/([^/]+)\/questions\/([^/]+)\/give-up$/);
  if (request.method === 'POST' && giveUpMatch) {
    return giveUp(env, giveUpMatch[1], giveUpMatch[2]);
  }

  const answerMatch = url.pathname.match(/^\/api\/plays\/([^/]+)\/questions\/([^/]+)\/answer$/);
  if (request.method === 'POST' && answerMatch) {
    return answerQuestion(request, env, answerMatch[1], answerMatch[2]);
  }

  const finishMatch = url.pathname.match(/^\/api\/plays\/([^/]+)\/finish$/);
  if (request.method === 'POST' && finishMatch) {
    return finishPlay(env, finishMatch[1]);
  }

  return json({ error: 'Not found' }, { status: 404 });
}

async function createChallenge(request, env) {
  const body = await readBody(request);
  const questionSource = VALID_QUESTION_SOURCES.has(body.questionSource) ? body.questionSource : 'curated';
  const sourceMode = VALID_SOURCE_MODES.has(body.sourceMode) ? body.sourceMode : 'random';
  const category = VALID_CATEGORIES.has(body.category) ? body.category : 'food';
  const difficulty = VALID_DIFFICULTIES.has(body.difficulty) ? body.difficulty : 'mixed';
  const questionCount = clampNumber(body.questionCount, 3, 10, 5);

  const needed = Math.max(questionCount + 4, 8);
  const candidates = questionSource === 'curated'
    ? await findCuratedCandidates(env, difficulty, needed)
    : await findCandidates({ sourceMode, category, difficulty, needed });
  const questions = createQuestionSet(candidates, questionCount);

  const id = randomId('c_');
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const statements = [
    env.DB.prepare(`
      INSERT INTO challenges (id, question_source, source_mode, category, difficulty, question_count, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, questionSource, sourceMode, questionSource === 'experimental' && sourceMode === 'category' ? category : null, difficulty, questionCount, createdAt, expiresAt)
  ];

  questions.forEach((question, position) => {
    statements.push(
      env.DB.prepare(`
        INSERT INTO challenge_questions (
          id, challenge_id, position, title, aliases_json, sections_json, choices_json,
          source_url, revision_id, estimated_difficulty, quality_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        randomId('q_'), id, position, question.title,
        JSON.stringify(question.aliases), JSON.stringify(question.sections), JSON.stringify(question.choices),
        question.sourceUrl, question.revisionId, question.estimatedDifficulty, question.qualityScore
      )
    );
  });

  await env.DB.batch(statements);

  return json({
    id,
    shareUrl: `${new URL(request.url).origin}/challenge/${id}`,
    questionCount,
    questionSource,
    sourceMode,
    category: questionSource === 'experimental' && sourceMode === 'category' ? category : null,
    difficulty,
    expiresAt
  }, { status: 201 });
}

async function getChallenge(env, challengeId) {
  const challenge = await env.DB.prepare(`
    SELECT id, question_source, source_mode, category, difficulty, question_count, created_at, expires_at
    FROM challenges WHERE id = ?
  `).bind(challengeId).first();

  if (!challenge) return json({ error: 'チャレンジが見つかりません。' }, { status: 404 });
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return json({ error: 'このチャレンジの公開期間は終了しました。' }, { status: 410 });
  }

  return json(mapChallenge(challenge));
}

async function startPlay(request, env, challengeId) {
  const challenge = await env.DB.prepare('SELECT * FROM challenges WHERE id = ?').bind(challengeId).first();
  if (!challenge) return json({ error: 'チャレンジが見つかりません。' }, { status: 404 });
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return json({ error: 'このチャレンジの公開期間は終了しました。' }, { status: 410 });
  }

  const body = await readBody(request);
  const nickname = String(body.nickname ?? '').trim().slice(0, 24);
  if (!nickname) return json({ error: 'ニックネームを入力してください。' }, { status: 400 });

  const questions = await env.DB.prepare(`
    SELECT id, position FROM challenge_questions WHERE challenge_id = ? ORDER BY position
  `).bind(challengeId).all();

  const playId = randomId('p_');
  const startedAt = new Date().toISOString();
  const statements = [
    env.DB.prepare(`INSERT INTO plays (id, challenge_id, nickname, started_at) VALUES (?, ?, ?, ?)`)
      .bind(playId, challengeId, nickname, startedAt)
  ];

  for (const question of questions.results) {
    statements.push(
      env.DB.prepare(`INSERT INTO play_question_states (play_id, question_id) VALUES (?, ?)`)
        .bind(playId, question.id)
    );
  }

  await env.DB.batch(statements);
  return json({ playId, path: `/play/${playId}` }, { status: 201 });
}

async function getPlay(env, playId) {
  const play = await env.DB.prepare(`
    SELECT p.*, c.question_source, c.source_mode, c.category, c.difficulty, c.question_count, c.expires_at
    FROM plays p JOIN challenges c ON c.id = p.challenge_id
    WHERE p.id = ?
  `).bind(playId).first();

  if (!play) return json({ error: 'プレイデータが見つかりません。' }, { status: 404 });

  const rows = await env.DB.prepare(`
    SELECT
      q.id, q.position, q.sections_json, q.title, q.source_url, q.estimated_difficulty,
      s.gave_up, s.answered_at, s.mode, s.submitted_answer, s.is_correct, s.score, s.elapsed_ms,
      CASE WHEN s.gave_up = 1 THEN q.choices_json ELSE NULL END AS visible_choices_json
    FROM challenge_questions q
    JOIN play_question_states s ON s.question_id = q.id AND s.play_id = ?
    WHERE q.challenge_id = ?
    ORDER BY q.position
  `).bind(playId, play.challenge_id).all();

  const questions = rows.results.map((row) => ({
    id: row.id,
    position: row.position,
    sections: parseJsonArray(row.sections_json),
    estimatedDifficulty: row.estimated_difficulty,
    gaveUp: Boolean(row.gave_up),
    answered: Boolean(row.answered_at),
    mode: row.mode,
    submittedAnswer: row.submitted_answer,
    isCorrect: row.is_correct === null ? null : Boolean(row.is_correct),
    score: row.score,
    elapsedMs: row.elapsed_ms,
    choices: row.visible_choices_json ? parseJsonArray(row.visible_choices_json) : null,
    answer: row.answered_at ? row.title : null,
    sourceUrl: row.answered_at ? row.source_url : null
  }));

  return json({
    play: {
      id: play.id,
      challengeId: play.challenge_id,
      nickname: play.nickname,
      startedAt: play.started_at,
      completedAt: play.completed_at
    },
    challenge: mapChallenge(play),
    questions
  });
}

async function giveUp(env, playId, questionId) {
  const state = await getState(env, playId, questionId);
  if (!state) return json({ error: '問題が見つかりません。' }, { status: 404 });
  if (state.answered_at) return json({ error: 'この問題は回答済みです。' }, { status: 409 });

  await env.DB.prepare(`
    UPDATE play_question_states
    SET gave_up = 1, gave_up_at = COALESCE(gave_up_at, ?)
    WHERE play_id = ? AND question_id = ? AND answered_at IS NULL
  `).bind(new Date().toISOString(), playId, questionId).run();

  return json({
    gaveUp: true,
    choices: parseJsonArray(state.choices_json)
  });
}

async function answerQuestion(request, env, playId, questionId) {
  const state = await getState(env, playId, questionId);
  if (!state) return json({ error: '問題が見つかりません。' }, { status: 404 });
  if (state.answered_at) return json({ error: 'この問題は回答済みです。' }, { status: 409 });

  const body = await readBody(request);
  const mode = body.mode === 'choice' ? 'choice' : 'text';
  const answer = String(body.answer ?? '').trim();
  const elapsedMs = clampNumber(body.elapsedMs, 0, 60 * 60 * 1000, 0);

  if (!answer) return json({ error: '回答を入力してください。' }, { status: 400 });
  if (mode === 'choice' && !state.gave_up) {
    return json({ error: '4択はギブアップ後にのみ回答できます。' }, { status: 409 });
  }
  if (mode === 'text' && state.gave_up) {
    return json({ error: 'ギブアップ後は4択から回答してください。' }, { status: 409 });
  }

  const aliases = parseJsonArray(state.aliases_json, [state.title]);
  const normalized = normalizeAnswer(answer);
  const isCorrect = aliases.some((alias) => normalizeAnswer(alias) === normalized);
  const score = calculateScore({ isCorrect, mode, elapsedMs });
  const answeredAt = new Date().toISOString();

  const result = await env.DB.prepare(`
    UPDATE play_question_states
    SET answered_at = ?, mode = ?, submitted_answer = ?, is_correct = ?, score = ?, elapsed_ms = ?
    WHERE play_id = ? AND question_id = ? AND answered_at IS NULL
  `).bind(answeredAt, mode, answer, isCorrect ? 1 : 0, score, elapsedMs, playId, questionId).run();

  if (!result.meta.changes) return json({ error: '回答の競合が発生しました。再読み込みしてください。' }, { status: 409 });

  return json({
    isCorrect,
    score,
    answer: state.title,
    sourceUrl: state.source_url,
    mode
  });
}

async function finishPlay(env, playId) {
  const play = await env.DB.prepare('SELECT * FROM plays WHERE id = ?').bind(playId).first();
  if (!play) return json({ error: 'プレイデータが見つかりません。' }, { status: 404 });

  const states = await env.DB.prepare(`
    SELECT s.*, q.position, q.title
    FROM play_question_states s
    JOIN challenge_questions q ON q.id = s.question_id
    WHERE s.play_id = ? ORDER BY q.position
  `).bind(playId).all();

  if (states.results.some((state) => !state.answered_at)) {
    return json({ error: '未回答の問題があります。' }, { status: 409 });
  }

  const score = states.results.reduce((sum, state) => sum + Number(state.score ?? 0), 0);
  const correctCount = states.results.filter((state) => state.is_correct).length;
  const totalTimeMs = states.results.reduce((sum, state) => sum + Number(state.elapsed_ms ?? 0), 0);
  const details = states.results.map((state) => ({
    position: state.position,
    title: state.title,
    mode: state.mode,
    isCorrect: Boolean(state.is_correct),
    score: state.score,
    elapsedMs: state.elapsed_ms
  }));

  const completedAt = play.completed_at ?? new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('UPDATE plays SET completed_at = COALESCE(completed_at, ?) WHERE id = ?')
      .bind(completedAt, playId),
    env.DB.prepare(`
      INSERT OR IGNORE INTO results (
        id, play_id, challenge_id, nickname, score, correct_count, total_time_ms, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      randomId('r_'), playId, play.challenge_id, play.nickname, score, correctCount,
      totalTimeMs, JSON.stringify(details), completedAt
    )
  ]);

  const leaderboardResponse = await getLeaderboardData(env, play.challenge_id);
  const rank = leaderboardResponse.findIndex((item) => item.playId === playId) + 1;

  return json({
    playId,
    challengeId: play.challenge_id,
    nickname: play.nickname,
    score,
    correctCount,
    questionCount: states.results.length,
    totalTimeMs,
    rank,
    details,
    leaderboard: leaderboardResponse
  });
}

async function getLeaderboard(env, challengeId) {
  return json({ leaderboard: await getLeaderboardData(env, challengeId) });
}

async function getLeaderboardData(env, challengeId) {
  const rows = await env.DB.prepare(`
    SELECT play_id, nickname, score, correct_count, total_time_ms, created_at
    FROM results
    WHERE challenge_id = ?
    ORDER BY score DESC, total_time_ms ASC, created_at ASC
    LIMIT 50
  `).bind(challengeId).all();

  return rows.results.map((row, index) => ({
    rank: index + 1,
    playId: row.play_id,
    nickname: row.nickname,
    score: row.score,
    correctCount: row.correct_count,
    totalTimeMs: row.total_time_ms
  }));
}


async function findCuratedCandidates(env, difficulty, needed) {
  const baseColumns = `
    SELECT title, aliases_json, sections_json, source_url, revision_id, difficulty, quality_score
    FROM question_bank
    WHERE review_status = 'approved'
  `;

  let rows;
  if (difficulty !== 'mixed') {
    rows = await env.DB.prepare(`${baseColumns} AND difficulty = ? ORDER BY RANDOM() LIMIT ?`)
      .bind(difficulty, needed).all();
  } else {
    rows = await env.DB.prepare(`${baseColumns} ORDER BY RANDOM() LIMIT ?`)
      .bind(needed).all();
  }

  if (rows.results.length < needed) {
    rows = await env.DB.prepare(`${baseColumns} ORDER BY RANDOM() LIMIT ?`)
      .bind(needed).all();
  }

  return rows.results.map((row) => ({
    title: row.title,
    aliases: parseJsonArray(row.aliases_json, [row.title]),
    sections: parseJsonArray(row.sections_json),
    sourceUrl: row.source_url,
    revisionId: row.revision_id,
    estimatedDifficulty: row.difficulty,
    qualityScore: row.quality_score
  }));
}

async function getState(env, playId, questionId) {
  return env.DB.prepare(`
    SELECT s.*, q.title, q.aliases_json, q.choices_json, q.source_url
    FROM play_question_states s
    JOIN challenge_questions q ON q.id = s.question_id
    WHERE s.play_id = ? AND s.question_id = ?
  `).bind(playId, questionId).first();
}

function calculateScore({ isCorrect, mode, elapsedMs }) {
  if (!isCorrect) return 0;
  if (mode === 'choice') return 350;
  const seconds = Math.floor(elapsedMs / 1000);
  const speedBonus = Math.max(0, 500 - seconds * 10);
  return 1000 + speedBonus;
}

function mapChallenge(row) {
  return {
    id: row.challenge_id ?? row.id,
    questionSource: row.question_source,
    sourceMode: row.source_mode,
    category: row.category,
    difficulty: row.difficulty,
    questionCount: row.question_count,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('JSON形式のリクエストが必要です。');
  }
}

async function renderChallengeShell(request, env, url) {
  const id = url.pathname.split('/').filter(Boolean)[1];
  const challenge = await env.DB.prepare(`
    SELECT question_count, difficulty, question_source FROM challenges WHERE id = ?
  `).bind(id).first();

  const assetUrl = new URL('/index.html', url);
  const response = await env.ASSETS.fetch(new Request(assetUrl, request));
  if (!challenge || !response.headers.get('content-type')?.includes('text/html')) return response;

  const title = `Wikipedia目次クイズ・全${challenge.question_count}問`;
  const sourceLabel = challenge.question_source === 'curated' ? '確認済み問題' : 'Wikipedia探索・実験問題';
  const description = `目次だけで記事を当てるチャレンジ。${sourceLabel}／難易度：${challenge.difficulty}`;

  return new HTMLRewriter()
    .on('title', { element(element) { element.setInnerContent(title); } })
    .on('#og-title', { element(element) { element.setAttribute('content', title); } })
    .on('#og-description', { element(element) { element.setAttribute('content', description); } })
    .on('#og-url', { element(element) { element.setAttribute('content', url.href); } })
    .transform(response);
}
