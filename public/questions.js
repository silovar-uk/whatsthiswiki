export const CURATED_QUESTIONS = [
  {
    id: 'onigiri',
    title: 'おにぎり',
    aliases: ['おむすび', '握り飯', '握飯', '御結び'],
    category: 'food',
    difficulty: 'easy',
    sourceUrl: 'https://ja.wikipedia.org/wiki/%E3%81%8A%E3%81%AB%E3%81%8E%E3%82%8A',
    sections: [
      { level: 1, text: '特徴' },
      { level: 1, text: '歴史' },
      { level: 1, text: '地域による呼称' },
      { level: 1, text: '構成・形状' },
      { level: 1, text: '作り方' },
      { level: 1, text: 'バリエーションと派生形' },
      { level: 1, text: '地域文化・振興活動' },
      { level: 1, text: '各国における現状' },
      { level: 1, text: '詩歌' }
    ]
  },
  {
    id: 'moai',
    title: 'モアイ',
    aliases: ['モアイ像'],
    category: 'places',
    difficulty: 'normal',
    sourceUrl: 'https://ja.wikipedia.org/wiki/%E3%83%A2%E3%82%A2%E3%82%A4',
    sections: [
      { level: 1, text: '建設方法' },
      { level: 1, text: '復元・修復' },
      { level: 1, text: '文明崩壊の原因説' },
      { level: 1, text: '焼失' },
      { level: 1, text: '犯罪' },
      { level: 1, text: 'イースター島から持ち出された〇〇' },
      { level: 2, text: '返還された〇〇' },
      { level: 1, text: 'レプリカ等' }
    ]
  },
  {
    id: 'repechage',
    title: '敗者復活戦',
    aliases: ['敗者復活', 'レペチャージ'],
    category: 'sports',
    difficulty: 'normal',
    sourceUrl: 'https://ja.wikipedia.org/wiki/%E6%95%97%E8%80%85%E5%BE%A9%E6%B4%BB%E6%88%A6',
    sections: [
      { level: 1, text: '概要' },
      { level: 1, text: '柔道における〇〇' },
      { level: 1, text: '野球における〇〇' },
      { level: 2, text: '高校野球' },
      { level: 2, text: '大学野球' },
      { level: 2, text: '社会人野球' },
      { level: 2, text: 'プロ野球' },
      { level: 1, text: '将棋における〇〇' },
      { level: 1, text: 'テレビ番組における〇〇' },
      { level: 1, text: '比喩的な〇〇' }
    ]
  },
  {
    id: 'origami',
    title: '折り紙',
    aliases: ['折紙', 'おりがみ', 'ORIGAMI'],
    category: 'science',
    difficulty: 'easy',
    sourceUrl: 'https://ja.wikipedia.org/wiki/%E6%8A%98%E3%82%8A%E7%B4%99',
    sections: [
      { level: 1, text: '概要' },
      { level: 1, text: '〇〇の種類' },
      { level: 2, text: '不切正方形一枚折り' },
      { level: 2, text: '複合〇〇' },
      { level: 2, text: '切り込み〇〇' },
      { level: 2, text: 'ユニット〇〇' },
      { level: 1, text: '基本形' },
      { level: 1, text: '用紙' },
      { level: 1, text: '折り図' },
      { level: 1, text: '主な折り方' },
      { level: 1, text: '〇〇の数学と応用' }
    ]
  },
  {
    id: 'curry-rice',
    title: 'カレーライス',
    aliases: ['ライスカレー'],
    category: 'food',
    difficulty: 'easy',
    sourceUrl: 'https://ja.wikipedia.org/wiki/%E3%82%AB%E3%83%AC%E3%83%BC%E3%83%A9%E3%82%A4%E3%82%B9',
    sections: [
      { level: 1, text: '日本における歴史' },
      { level: 2, text: '調理・内食' },
      { level: 2, text: '外食' },
      { level: 2, text: '各分野における展開' },
      { level: 1, text: '作り方と食べ方' },
      { level: 2, text: '一晩寝かせたカレー' },
      { level: 2, text: '〇〇とライスカレー' },
      { level: 1, text: '日本各地の〇〇' },
      { level: 1, text: '各国の〇〇' },
      { level: 1, text: '作品' }
    ]
  },
  {
    id: 'mount-fuji',
    title: '富士山',
    aliases: ['富士'],
    category: 'places',
    difficulty: 'easy',
    sourceUrl: 'https://ja.wikipedia.org/wiki/%E5%AF%8C%E5%A3%AB%E5%B1%B1',
    sections: [
      { level: 1, text: '名称' },
      { level: 2, text: '語源' },
      { level: 1, text: '〇〇の標高' },
      { level: 2, text: '標高計測の歴史' },
      { level: 1, text: '地質学上の〇〇' },
      { level: 2, text: '火山活動' },
      { level: 2, text: '気象' },
      { level: 1, text: '人間との関わりの歴史' },
      { level: 1, text: '〇〇の山頂' },
      { level: 1, text: '〇〇と眺望' },
      { level: 1, text: '〇〇の文化' },
      { level: 1, text: '〇〇と地域振興' }
    ]
  },
  {
    id: 'shogi',
    title: '将棋',
    aliases: ['本将棋', '日本将棋'],
    category: 'sports',
    difficulty: 'normal',
    sourceUrl: 'https://ja.wikipedia.org/wiki/%E5%B0%86%E6%A3%8B',
    sections: [
      { level: 1, text: '総説' },
      { level: 1, text: 'ルール' },
      { level: 2, text: '盤と駒' },
      { level: 2, text: '駒の種類' },
      { level: 2, text: '対局の進行' },
      { level: 2, text: '勝敗の決め方' },
      { level: 1, text: '場面ごとの戦い方' },
      { level: 1, text: '先読みと形勢判断' },
      { level: 1, text: '歴史' },
      { level: 1, text: 'ゲームとしての特質' },
      { level: 1, text: '用語に由来する慣用表現' },
      { level: 1, text: '題材とした作品' }
    ]
  },
  {
    id: 'ramen',
    title: 'ラーメン',
    aliases: ['らーめん', '拉麺', '中華そば'],
    category: 'food',
    difficulty: 'easy',
    sourceUrl: 'https://ja.wikipedia.org/wiki/%E3%83%A9%E3%83%BC%E3%83%A1%E3%83%B3',
    sections: [
      { level: 1, text: '概要' },
      { level: 1, text: '名称' },
      { level: 1, text: '麺・スープ・具' },
      { level: 1, text: '分類' },
      { level: 1, text: '食器' },
      { level: 1, text: '歴史' },
      { level: 1, text: '店舗形態' },
      { level: 1, text: 'ご当地〇〇' },
      { level: 1, text: '日本国外の〇〇事情' },
      { level: 1, text: '近種の料理' },
      { level: 1, text: '過剰摂取による健康リスク' }
    ]
  },
  {
    id: 'tokyo-tower',
    title: '東京タワー',
    aliases: ['日本電波塔'],
    category: 'places',
    difficulty: 'normal',
    sourceUrl: 'https://ja.wikipedia.org/wiki/%E6%9D%B1%E4%BA%AC%E3%82%BF%E3%83%AF%E3%83%BC',
    sections: [
      { level: 1, text: '概要' },
      { level: 1, text: '運営会社' },
      { level: 1, text: '沿革' },
      { level: 1, text: '構想' },
      { level: 1, text: '建設場所' },
      { level: 1, text: '設計' },
      { level: 1, text: '建設' },
      { level: 1, text: '名称' },
      { level: 1, text: '電波塔集約' },
      { level: 1, text: '塗装' },
      { level: 1, text: '観光施設としての〇〇' },
      { level: 2, text: '展望台' },
      { level: 2, text: 'ライトアップ' },
      { level: 1, text: '放送施設としての〇〇' }
    ]
  },
  {
    id: 'soccer-ball',
    title: 'サッカーボール',
    aliases: ['フットボール'],
    category: 'sports',
    difficulty: 'normal',
    sourceUrl: 'https://ja.wikipedia.org/wiki/%E3%82%B5%E3%83%83%E3%82%AB%E3%83%BC%E3%83%9C%E3%83%BC%E3%83%AB',
    sections: [
      { level: 1, text: 'ルール' },
      { level: 2, text: '品質と規格' },
      { level: 2, text: '欠陥が生じたボールの交換' },
      { level: 2, text: '追加のボール' },
      { level: 2, text: '例外事項' },
      { level: 1, text: '具体的仕様' },
      { level: 2, text: '外部パネル' },
      { level: 2, text: '皮革' },
      { level: 2, text: '〇〇の区分' },
      { level: 2, text: 'ICチップ内蔵〇〇' },
      { level: 1, text: '生産' },
      { level: 2, text: '児童労働の排除' },
      { level: 1, text: '公式試合球' }
    ]
  }
];
