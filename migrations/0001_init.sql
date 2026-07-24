PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  question_source TEXT NOT NULL CHECK (question_source IN ('curated', 'experimental')),
  source_mode TEXT NOT NULL CHECK (source_mode IN ('random', 'category')),
  category TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hard', 'mixed')),
  question_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  aliases_json TEXT NOT NULL,
  sections_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  revision_id INTEGER,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hard')),
  quality_score REAL NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('approved', 'draft', 'rejected')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS challenge_questions (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  sections_json TEXT NOT NULL,
  choices_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  revision_id INTEGER,
  estimated_difficulty TEXT NOT NULL,
  quality_score REAL NOT NULL,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
  UNIQUE (challenge_id, position)
);

CREATE INDEX IF NOT EXISTS idx_challenge_questions_challenge
  ON challenge_questions(challenge_id, position);

CREATE TABLE IF NOT EXISTS plays (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS play_question_states (
  play_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  gave_up INTEGER NOT NULL DEFAULT 0,
  gave_up_at TEXT,
  answered_at TEXT,
  mode TEXT CHECK (mode IN ('text', 'choice')),
  submitted_answer TEXT,
  is_correct INTEGER,
  score INTEGER,
  elapsed_ms INTEGER,
  PRIMARY KEY (play_id, question_id),
  FOREIGN KEY (play_id) REFERENCES plays(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES challenge_questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_play_question_states_play
  ON play_question_states(play_id);

CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  play_id TEXT NOT NULL UNIQUE,
  challenge_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  total_time_ms INTEGER NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (play_id) REFERENCES plays(id) ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_results_leaderboard
  ON results(challenge_id, score DESC, total_time_ms ASC, created_at ASC);

INSERT OR IGNORE INTO question_bank VALUES
('bank_onigiri','おにぎり','["おにぎり","おむすび","握り飯","握飯","御結び"]','[{"level":1,"text":"特徴"},{"level":1,"text":"歴史"},{"level":1,"text":"地域による呼称"},{"level":1,"text":"構成・形状"},{"level":1,"text":"作り方"},{"level":1,"text":"バリエーションと派生形"},{"level":1,"text":"地域文化・振興活動"},{"level":1,"text":"各国における現状"},{"level":1,"text":"詩歌"}]','https://ja.wikipedia.org/wiki/%E3%81%8A%E3%81%AB%E3%81%8E%E3%82%8A',NULL,'food','easy',0.94,'approved','2026-07-24T00:00:00.000Z'),
('bank_moai','モアイ','["モアイ","モアイ像"]','[{"level":1,"text":"建設方法"},{"level":1,"text":"復元・修復"},{"level":1,"text":"文明崩壊の原因説"},{"level":1,"text":"焼失"},{"level":1,"text":"犯罪"},{"level":1,"text":"イースター島から持ち出された〇〇"},{"level":2,"text":"返還された〇〇"},{"level":1,"text":"レプリカ等"}]','https://ja.wikipedia.org/wiki/%E3%83%A2%E3%82%A2%E3%82%A4',NULL,'places','normal',0.9,'approved','2026-07-24T00:00:00.000Z'),
('bank_repechage','敗者復活戦','["敗者復活戦","敗者復活","レペチャージ"]','[{"level":1,"text":"概要"},{"level":1,"text":"柔道における〇〇"},{"level":1,"text":"野球における〇〇"},{"level":2,"text":"高校野球"},{"level":2,"text":"大学野球"},{"level":2,"text":"社会人野球"},{"level":2,"text":"プロ野球"},{"level":1,"text":"将棋における〇〇"},{"level":1,"text":"テレビ番組における〇〇"},{"level":1,"text":"比喩的な〇〇"}]','https://ja.wikipedia.org/wiki/%E6%95%97%E8%80%85%E5%BE%A9%E6%B4%BB%E6%88%A6',NULL,'sports','normal',0.88,'approved','2026-07-24T00:00:00.000Z'),
('bank_origami','折り紙','["折り紙","折紙","おりがみ","ORIGAMI"]','[{"level":1,"text":"概要"},{"level":1,"text":"〇〇の種類"},{"level":2,"text":"不切正方形一枚折り"},{"level":2,"text":"複合〇〇"},{"level":2,"text":"切り込み〇〇"},{"level":2,"text":"ユニット〇〇"},{"level":1,"text":"基本形"},{"level":1,"text":"用紙"},{"level":1,"text":"折り図"},{"level":1,"text":"主な折り方"},{"level":1,"text":"〇〇の数学と応用"}]','https://ja.wikipedia.org/wiki/%E6%8A%98%E3%82%8A%E7%B4%99',NULL,'science','easy',0.91,'approved','2026-07-24T00:00:00.000Z'),
('bank_curry','カレーライス','["カレーライス","ライスカレー"]','[{"level":1,"text":"日本における歴史"},{"level":2,"text":"調理・内食"},{"level":2,"text":"外食"},{"level":2,"text":"各分野における展開"},{"level":1,"text":"作り方と食べ方"},{"level":2,"text":"一晩寝かせたカレー"},{"level":2,"text":"〇〇とライスカレー"},{"level":1,"text":"日本各地の〇〇"},{"level":1,"text":"各国の〇〇"},{"level":1,"text":"作品"}]','https://ja.wikipedia.org/wiki/%E3%82%AB%E3%83%AC%E3%83%BC%E3%83%A9%E3%82%A4%E3%82%B9',NULL,'food','easy',0.9,'approved','2026-07-24T00:00:00.000Z'),
('bank_fuji','富士山','["富士山","富士"]','[{"level":1,"text":"名称"},{"level":2,"text":"語源"},{"level":1,"text":"〇〇の標高"},{"level":2,"text":"標高計測の歴史"},{"level":1,"text":"地質学上の〇〇"},{"level":2,"text":"火山活動"},{"level":2,"text":"気象"},{"level":1,"text":"人間との関わりの歴史"},{"level":1,"text":"〇〇の山頂"},{"level":1,"text":"〇〇と眺望"},{"level":1,"text":"〇〇の文化"},{"level":1,"text":"〇〇と地域振興"}]','https://ja.wikipedia.org/wiki/%E5%AF%8C%E5%A3%AB%E5%B1%B1',NULL,'places','easy',0.92,'approved','2026-07-24T00:00:00.000Z'),
('bank_shogi','将棋','["将棋","本将棋","日本将棋"]','[{"level":1,"text":"総説"},{"level":1,"text":"ルール"},{"level":2,"text":"盤と駒"},{"level":2,"text":"駒の種類"},{"level":2,"text":"対局の進行"},{"level":2,"text":"勝敗の決め方"},{"level":1,"text":"場面ごとの戦い方"},{"level":1,"text":"先読みと形勢判断"},{"level":1,"text":"歴史"},{"level":1,"text":"ゲームとしての特質"},{"level":1,"text":"用語に由来する慣用表現"},{"level":1,"text":"題材とした作品"}]','https://ja.wikipedia.org/wiki/%E5%B0%86%E6%A3%8B',NULL,'sports','normal',0.89,'approved','2026-07-24T00:00:00.000Z'),
('bank_ramen','ラーメン','["ラーメン","らーめん","拉麺","中華そば"]','[{"level":1,"text":"概要"},{"level":1,"text":"名称"},{"level":1,"text":"麺・スープ・具"},{"level":1,"text":"分類"},{"level":1,"text":"食器"},{"level":1,"text":"歴史"},{"level":1,"text":"店舗形態"},{"level":1,"text":"ご当地〇〇"},{"level":1,"text":"日本国外の〇〇事情"},{"level":1,"text":"近種の料理"},{"level":1,"text":"過剰摂取による健康リスク"}]','https://ja.wikipedia.org/wiki/%E3%83%A9%E3%83%BC%E3%83%A1%E3%83%B3',NULL,'food','easy',0.9,'approved','2026-07-24T00:00:00.000Z'),
('bank_tokyo_tower','東京タワー','["東京タワー","日本電波塔"]','[{"level":1,"text":"概要"},{"level":1,"text":"運営会社"},{"level":1,"text":"沿革"},{"level":1,"text":"構想"},{"level":1,"text":"建設場所"},{"level":1,"text":"設計"},{"level":1,"text":"建設"},{"level":1,"text":"名称"},{"level":1,"text":"電波塔集約"},{"level":1,"text":"塗装"},{"level":1,"text":"観光施設としての〇〇"},{"level":2,"text":"展望台"},{"level":2,"text":"ライトアップ"},{"level":1,"text":"放送施設としての〇〇"}]','https://ja.wikipedia.org/wiki/%E6%9D%B1%E4%BA%AC%E3%82%BF%E3%83%AF%E3%83%BC',NULL,'places','normal',0.87,'approved','2026-07-24T00:00:00.000Z'),
('bank_soccer_ball','サッカーボール','["サッカーボール","フットボール"]','[{"level":1,"text":"ルール"},{"level":2,"text":"品質と規格"},{"level":2,"text":"欠陥が生じたボールの交換"},{"level":2,"text":"追加のボール"},{"level":2,"text":"例外事項"},{"level":1,"text":"具体的仕様"},{"level":2,"text":"外部パネル"},{"level":2,"text":"皮革"},{"level":2,"text":"〇〇の区分"},{"level":2,"text":"ICチップ内蔵〇〇"},{"level":1,"text":"生産"},{"level":2,"text":"児童労働の排除"},{"level":1,"text":"公式試合球"}]','https://ja.wikipedia.org/wiki/%E3%82%B5%E3%83%83%E3%82%AB%E3%83%BC%E3%83%9C%E3%83%BC%E3%83%AB',NULL,'sports','normal',0.88,'approved','2026-07-24T00:00:00.000Z');
