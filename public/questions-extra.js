import { CURATED_QUESTIONS } from './questions.js';

const q = (id, title, aliases, category, difficulty, sections) => ({
  id,
  title,
  aliases,
  category,
  difficulty,
  sourceUrl: `https://ja.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  sections: sections.split('|').map((item) => {
    const match = item.match(/^(\d):(.*)$/);
    return { level: match ? Number(match[1]) : 1, text: match ? match[2] : item };
  })
});

const EXTRA_CURATED_QUESTIONS = [
  q('hamburg-steak', 'ハンバーグ', ['ハンバーグステーキ'], 'food', 'easy', '概要|名称|歴史|材料|調理法|2:成形|2:加熱|ソース|付け合わせ|各国の類似料理'),
  q('okonomiyaki', 'お好み焼き', ['御好み焼き'], 'food', 'easy', '概要|歴史|材料|調理|2:生地|2:具材|地域別の種類|2:関西風|2:広島風|食べ方|店舗'),
  q('udon', 'うどん', ['饂飩'], 'food', 'normal', '概要|歴史|製法|2:原料|2:製麺|麺の太さ|食べ方|2:温かい料理|2:冷たい料理|地域ごとの種類|日本国外での展開'),
  q('gyoza', '餃子', ['ギョーザ', 'ギョウザ'], 'food', 'normal', '概要|歴史|調理法|2:焼く|2:ゆでる|2:蒸す|具材|皮|日本での普及|各国の類似料理'),
  q('parfait', 'パフェ', ['parfait'], 'food', 'normal', '概要|語源|歴史|構成|2:アイスクリーム|2:果物|2:ソース|盛り付け|日本での発展|類似するデザート'),
  q('soy-sauce', '醤油', ['しょうゆ', 'しょう油'], 'food', 'hard', '概要|歴史|原料|製造工程|2:麹|2:もろみ|2:圧搾|分類|地域差|成分|容器と保存'),
  q('dashi', '出汁', ['だし', 'ダシ'], 'food', 'hard', '概要|歴史|材料|2:魚介類|2:海藻|2:きのこ|取り方|合わせ方|料理での利用|各国のスープストック'),
  q('fermented-food', '発酵食品', ['発酵食'], 'food', 'hard', '概要|歴史|微生物|2:細菌|2:酵母|2:カビ|分類|製造|保存性|風味|地域文化|安全管理'),
  q('wagashi', '和菓子', ['日本菓子'], 'food', 'hard', '概要|歴史|分類|2:生菓子|2:半生菓子|2:干菓子|材料|製法|季節との関係|茶道との関係|地域の銘菓'),
  q('oda-nobunaga', '織田信長', ['信長'], 'people', 'easy', '生涯|2:家督相続|2:尾張統一|2:上洛|2:天下布武|2:主要な合戦|2:本能寺の変|政策|人物|後世の評価'),
  q('marie-curie', 'マリー・キュリー', ['キュリー夫人', 'Marie Curie'], 'people', 'easy', '生涯|2:幼少期|2:パリ留学|2:結婚|2:研究活動|2:晩年|科学上の業績|受賞|社会活動|後世への影響'),
  q('natsume-soseki', '夏目漱石', ['漱石', '夏目金之助'], 'people', 'normal', '生涯|2:幼少期|2:学生時代|2:英国留学|2:教師生活|2:新聞社入社|作品|2:小説|2:評論|人物|後世の評価'),
  q('walt-disney', 'ウォルト・ディズニー', ['ウォルト', 'Walt Disney'], 'people', 'normal', '生涯|2:幼少期|2:初期の仕事|2:会社設立|2:キャラクターの誕生|2:長編映画|2:テーマパーク|制作手法|人物像|評価'),
  q('florence-nightingale', 'フローレンス・ナイチンゲール', ['ナイチンゲール', 'Florence Nightingale'], 'people', 'normal', '生涯|2:幼少期|2:看護への志望|2:戦地での活動|2:帰国後|看護改革|統計学|著作|人物像|後世への影響'),
  q('kukai', '空海', ['弘法大師'], 'people', 'hard', '生涯|2:出生|2:入唐|2:帰国|2:寺院の整備|2:晩年|思想|著作|書|教育と社会事業|信仰と伝説'),
  q('nikola-tesla', 'ニコラ・テスラ', ['テスラ', 'Nikola Tesla'], 'people', 'hard', '生涯|2:幼少期|2:欧州での勤務|2:渡米|2:交流方式|2:研究所|2:晩年|発明|無線技術|人物像|評価'),
  q('alan-turing', 'アラン・チューリング', ['チューリング', 'Alan Turing'], 'people', 'hard', '生涯|2:幼少期|2:大学時代|2:暗号解読|2:計算機開発|2:晩年|計算理論|人工知能|数学上の業績|名誉回復'),
  q('higuchi-ichiyo', '樋口一葉', ['一葉', '樋口奈津'], 'people', 'hard', '生涯|2:幼少期|2:歌塾入門|2:生活苦|2:執筆活動|2:晩年|作品|日記|人物像|文学史上の評価'),
  q('spirited-away', '千と千尋の神隠し', ['千と千尋', 'Spirited Away'], 'works', 'easy', 'あらすじ|登場人物|舞台設定|制作|2:企画|2:作画|音楽|公開|興行成績|評価|受賞'),
  q('detective-conan', '名探偵コナン', ['コナン', 'Detective Conan'], 'works', 'easy', '概要|あらすじ|登場人物|設定|漫画|テレビアニメ|劇場版|関連作品|商品展開|海外展開'),
  q('super-mario-bros', 'スーパーマリオブラザーズ', ['スーパーマリオ', 'Super Mario Bros.'], 'works', 'easy', '概要|ゲーム内容|2:操作|2:ステージ|登場キャラクター|開発|音楽|発売|評価|移植|シリーズへの影響'),
  q('night-on-the-galactic-railroad', '銀河鉄道の夜', ['銀河鉄道'], 'works', 'normal', '作品概要|成立|あらすじ|登場人物|舞台と世界観|主題|草稿|発表|解釈|映像化と舞台化'),
  q('mobile-suit-gundam', '機動戦士ガンダム', ['ガンダム', 'Mobile Suit Gundam'], 'works', 'normal', '概要|あらすじ|登場人物|設定|2:宇宙世紀|2:兵器|制作|テレビ放送|再編集映画|反響|シリーズ展開'),
  q('your-name', '君の名は。', ['君の名は', 'Your Name.'], 'works', 'normal', 'あらすじ|登場人物|舞台|制作|2:企画|2:作画|2:ロケーション|音楽|公開|興行成績|評価|海外展開'),
  q('crime-and-punishment', '罪と罰', ['Crime and Punishment'], 'works', 'hard', '作品概要|成立|あらすじ|登場人物|構成|思想と主題|舞台|発表|批評|翻訳|映像化と舞台化'),
  q('2001-space-odyssey', '2001年宇宙の旅', ['2001: A Space Odyssey', '2001年'], 'works', 'hard', '概要|あらすじ|登場人物|製作|2:企画|2:脚本|2:撮影|特殊効果|音楽|公開|解釈|評価と影響'),
  q('one-hundred-years-solitude', '百年の孤独', ['Cien años de soledad', 'One Hundred Years of Solitude'], 'works', 'hard', '作品概要|成立|あらすじ|登場人物|一族の系譜|舞台|時間構造|主題|発表と翻訳|評価|文化的影響'),
  q('nara-city', '奈良市', ['奈良'], 'places', 'easy', '概要|地理|2:地形|2:気候|歴史|行政|地域|観光|文化財|交通|教育'),
  q('grand-canyon', 'グランド・キャニオン', ['グランドキャニオン', 'Grand Canyon'], 'places', 'easy', '概要|地理|地形|形成|地質|気候|生態系|先住民|探検史|観光|保全'),
  q('niagara-falls', 'ナイアガラの滝', ['ナイアガラ滝', 'Niagara Falls'], 'places', 'easy', '概要|位置|構成|形成|水量|歴史|観光|発電|事故と挑戦|環境保全'),
  q('angkor-wat', 'アンコール・ワット', ['Angkor Wat'], 'places', 'normal', '概要|歴史|建設|宗教|建築|2:伽藍配置|2:回廊|2:浮彫|再発見と調査|修復|世界遺産|観光'),
  q('venice', 'ヴェネツィア', ['ベネチア', 'ヴェニス', 'Venice'], 'places', 'normal', '概要|地理|歴史|行政|都市構造|2:運河|2:島々|建築|文化|観光|交通|環境問題'),
  q('tikal', 'ティカル', ['Tikal'], 'places', 'hard', '概要|地理|歴史|2:形成期|2:古典期|2:衰退|都市構造|2:神殿|2:宮殿|碑文|発掘調査|世界遺産'),
  q('cappadocia', 'カッパドキア', ['Cappadocia'], 'places', 'hard', '概要|地理|地質|奇岩地形|歴史|地下都市|岩窟教会|宗教文化|観光|世界遺産|保全'),
  q('iguazu-falls', 'イグアスの滝', ['イグアス滝', 'Iguazu Falls'], 'places', 'hard', '概要|位置|地形と形成|水系|気候|生態系|先住民と歴史|国立公園|観光|世界遺産|環境保全'),
  q('huangshan', '黄山', ['こうざん', 'Huangshan'], 'places', 'hard', '概要|地理|地質|峰々|気候|植生|歴史|宗教と文化|芸術への影響|観光|世界遺産'),
  q('moon', '月', ['地球の衛星', 'Moon'], 'science', 'easy', '概要|名称|軌道|2:公転|2:自転|形状と大きさ|表面|2:海|2:クレーター|満ち欠け|形成|探査|文化'),
  q('typhoon', '台風', ['熱帯低気圧'], 'science', 'easy', '定義|発生|構造|進路|強さの分類|命名|観測|予報|被害|防災|気候との関係'),
  q('photosynthesis', '光合成', ['photosynthesis'], 'science', 'normal', '概要|研究史|反応|2:光反応|2:炭素固定|葉緑体|色素|環境要因|植物以外の生物|地球環境への影響'),
  q('artificial-intelligence', '人工知能', ['AI', 'Artificial Intelligence'], 'science', 'normal', '概要|歴史|手法|2:探索|2:機械学習|2:深層学習|応用|評価|倫理|社会への影響|研究分野'),
  q('thermodynamics', '熱力学', ['サーモダイナミクス', 'thermodynamics'], 'science', 'hard', '概要|歴史|基本概念|2:系と状態|2:温度|2:内部エネルギー|法則|2:第一法則|2:第二法則|2:第三法則|熱機関|統計力学との関係'),
  q('particle-physics', '素粒子物理学', ['高エネルギー物理学', 'particle physics'], 'science', 'hard', '概要|歴史|基本粒子|2:クォーク|2:レプトン|相互作用|標準模型|加速器|検出器|未解決問題|宇宙論との関係'),
  q('electromagnetism', '電磁気学', ['電磁気', 'electromagnetism'], 'science', 'hard', '概要|歴史|電荷|電場|磁場|電流|電磁誘導|方程式|電磁波|物質との相互作用|応用'),
  q('association-football', 'サッカー', ['フットボール', 'association football'], 'sports', 'easy', '概要|歴史|競技場|用具|ルール|2:試合時間|2:得点|2:反則|ポジション|戦術|大会|世界での普及'),
  q('basketball', 'バスケットボール', ['バスケ', 'basketball'], 'sports', 'easy', '概要|歴史|競技場|用具|ルール|2:得点|2:反則|ポジション|戦術|大会|各国での普及'),
  q('table-tennis', '卓球', ['ピンポン', 'table tennis'], 'sports', 'easy', '概要|歴史|用具|2:ラケット|2:ボール|2:台|ルール|2:サービス|2:得点|打法|戦型|大会'),
  q('marathon', 'マラソン', ['marathon'], 'sports', 'easy', '概要|起源|歴史|距離|コース|競技規則|給水|記録|主要大会|市民大会|健康と安全'),
  q('ice-hockey', 'アイスホッケー', ['氷上ホッケー', 'ice hockey'], 'sports', 'normal', '概要|歴史|リンク|用具|ルール|2:得点|2:反則|ポジション|戦術|リーグ|国際大会'),
  q('artistic-gymnastics', '体操競技', ['器械体操', 'artistic gymnastics'], 'sports', 'normal', '概要|歴史|種目|2:男子種目|2:女子種目|採点|技の難度|用具|大会|安全管理'),
  q('archery', 'アーチェリー', ['洋弓', 'archery'], 'sports', 'normal', '概要|歴史|用具|2:弓|2:矢|2:照準器|競技形式|射法|得点|種目|大会|安全管理')
];

const knownIds = new Set(CURATED_QUESTIONS.map((question) => question.id));
EXTRA_CURATED_QUESTIONS.forEach((question) => {
  if (!knownIds.has(question.id)) CURATED_QUESTIONS.push(question);
});
