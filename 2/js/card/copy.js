// 마음기상청 주간 예보 문장 만들기. 서버 없이 기록만 보고 규칙으로 쓴다.
// 같은 주에는 주 시작일로 문장을 고르므로 언제 만들어도 같은 결과가 나온다.

import { WEATHERS, WEATHER_IDS } from '../weather.js';

// ── 조사 ─────────────────────────────────────────────

const DIGIT_JONG = [true, true, false, true, false, false, true, true, true, false]; // 영일이삼사오육칠팔구

// 마지막 글자의 받침 번호(0이면 받침 없음, 8이면 ㄹ). 한글이 아니면 숫자만 읽어 준다.
function jongseong(word) {
  const text = String(word).replace(/[\s.,!?'"”’)\]]+$/u, '');
  const ch = text.slice(-1);
  if (!ch) return 0;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  if (ch >= '0' && ch <= '9') {
    const d = Number(ch);
    return DIGIT_JONG[d] ? (d === 1 || d === 7 || d === 8 ? 8 : 1) : 0;
  }
  return 0;
}

export const hasBatchim = (word) => jongseong(word) !== 0;

// [받침 있을 때, 없을 때]
const JOSA = {
  '이/가': ['이', '가'],
  '은/는': ['은', '는'],
  '을/를': ['을', '를'],
  '와/과': ['과', '와'],
  '으로/로': ['으로', '로'],
  '이에요/예요': ['이에요', '예요'],
};

export function josa(word, pair) {
  const forms = JOSA[pair];
  if (!forms) return `${word}${pair}`;
  const jong = jongseong(word);
  // (으)로는 ㄹ 받침일 때도 '로'
  const withBatchim = jong !== 0 && !(pair === '으로/로' && jong === 8);
  return `${word}${withBatchim ? forms[0] : forms[1]}`;
}

// "{D}에는 {W:이/가} 왔습니다" 형식의 틀을 채운다.
function fill(template, vars) {
  return template.replace(/\{(\w+)(?::([^}]+))?\}/g, (_, key, pair) => {
    const value = String(vars[key] ?? '');
    return pair ? josa(value, pair) : value;
  });
}

// ── 무작위 (주마다 고정) ──────────────────────────────

function hashString(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function makeRng(seedText) {
  let s = hashString(seedText);
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

// ── 말뭉치 ───────────────────────────────────────────

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const DAY_NAMES = DAY_LABELS.map((d) => `${d}요일`);

// 문장 속에서 쓰는 날씨 명사 (맑음은 '맑은 하늘'이 자연스럽다)
const NOUN = { sunny: '맑은 하늘', cloudy: '구름', rain: '비', thunder: '천둥', snow: '눈', rainbow: '무지개' };

// 하루짜리 사건 문장. 주 전체의 흐름과 대비될 때 쓴다.
const EVENT = {
  sunny: [
    '{D}에는 구름 사이로 볕이 들었습니다.',
    '{D}에는 해가 반짝 났습니다.',
    '{D} 한때 쾌청한 기분이 관측되었습니다.',
    '{D}에는 마음이 반짝 개었습니다.',
  ],
  cloudy: [
    '{D}에는 구름이 잠시 끼었습니다.',
    '{D}에는 하늘이 다소 흐렸습니다.',
    '{D} 한때 옅은 구름대가 지나갔습니다.',
  ],
  rain: [
    '{D}에는 약한 비가 내렸습니다.',
    '{D}에는 마음에 비가 흩뿌렸습니다.',
    '{D} 한때 가랑비가 지나갔습니다.',
    '{D}에는 마음이 촉촉하게 젖었습니다.',
  ],
  thunder: [
    '{D}에는 천둥을 동반한 강한 짜증이 지나갔습니다.',
    '{D}에는 곳에 따라 천둥·번개가 쳤습니다.',
    '{D} 한때 번개를 동반한 거센 감정이 몰아쳤습니다.',
    '{D}에는 한바탕 천둥이 울렸습니다.',
  ],
  snow: [
    '{D}에는 눈이 소리 없이 내렸습니다.',
    '{D}에는 마음에 고요한 눈이 쌓였습니다.',
    '{D} 한때 포근한 눈발이 날렸습니다.',
  ],
  rainbow: [
    '{D}에는 무지개가 떴습니다.',
    '{D}에는 마음 한쪽에 무지개가 걸렸습니다.',
    '{D} 한때 반가운 무지개가 관측되었습니다.',
  ],
};

// 한 주 전체를 말하는 첫 문장. 비중이 클 때(strong)와 가장 많을 뿐일 때(mid)로 나눈다.
const OPENING = {
  sunny: {
    all: [
      '한 주 내내 마음 곳곳에 볕이 넉넉하게 들었습니다.',
      '이번 주는 구름 걱정 없이 맑은 날이 이어졌습니다.',
      '높은 기압의 영향으로 마음이 쾌청했던 한 주였습니다.',
    ],
    strong: [
      '이번 주 마음은 대체로 맑았습니다.',
      '이번 주는 마음에 볕이 넉넉하게 들었습니다.',
      '맑은 하늘이 한 주를 든든하게 지켰습니다.',
    ],
    mid: [
      '이번 주는 맑은 날이 가장 많이 관측되었습니다.',
      '맑은 하늘이 우세한 가운데 다른 날씨가 오갔습니다.',
      '이번 주 마음은 맑은 날이 가장 많았습니다.',
      '구름이 오갔지만 이번 주의 주인공은 맑은 하늘이었습니다.',
      '이번 주 마음은 맑은 날을 중심으로 날씨가 오갔습니다.',
    ],
  },
  cloudy: {
    all: [
      '한 주 내내 마음 위로 구름이 한가롭게 떠다녔습니다.',
      '크게 맑지도 흐리지도 않은, 잔잔한 구름의 한 주였습니다.',
    ],
    strong: [
      '이번 주 마음은 대체로 구름이 많았습니다.',
      '이번 주는 구름대의 영향으로 마음이 고르게 흐렸습니다.',
      '이번 주 마음 위로 구름이 한가롭게 떠다녔습니다.',
    ],
    mid: [
      '이번 주는 구름이 가장 자주 관측되었습니다.',
      '이번 주 마음은 구름이 낀 날이 가장 많았습니다.',
      '이번 주 하늘에는 구름이 가장 오래 머물렀습니다.',
      '구름이 중심이 된 한 주였으며 다른 날씨가 간간이 섞였습니다.',
    ],
  },
  rain: {
    all: [
      '한 주 내내 마음 곳곳에 비가 내렸습니다.',
      '이번 주는 비구름의 영향으로 마음이 촉촉하게 젖은 한 주였습니다.',
    ],
    strong: [
      '이번 주 마음에는 비가 자주 내렸습니다.',
      '이번 주는 비구름의 영향으로 마음이 촉촉하게 젖었습니다.',
      '이번 주 마음 곳곳에 비가 내렸습니다.',
    ],
    mid: [
      '이번 주는 비 오는 날이 가장 많았습니다.',
      '이번 주 마음에는 비가 가장 자주 내렸습니다.',
      '비구름이 가장 오래 머문 한 주였습니다.',
    ],
  },
  thunder: {
    all: [
      '대기가 내내 불안정해 마음 곳곳에 천둥·번개가 쳤습니다.',
      '이번 주는 천둥을 동반한 거센 감정이 매일 관측되었습니다.',
    ],
    strong: [
      '이번 주 마음에는 천둥이 잦았습니다.',
      '대기가 불안정해 마음 곳곳에 천둥·번개가 쳤습니다.',
      '이번 주는 천둥을 동반한 거센 감정이 자주 관측되었습니다.',
    ],
    mid: [
      '이번 주는 천둥이 가장 자주 울린 한 주였습니다.',
      '이번 주 마음에는 천둥이 가장 많이 쳤습니다.',
      '곳에 따라 천둥이 잦았던 한 주였습니다.',
    ],
  },
  snow: {
    all: [
      '한 주 내내 마음이 고요한 눈에 덮여 있었습니다.',
      '세상이 조용히 하얘진, 차분한 한 주였습니다.',
    ],
    strong: [
      '이번 주 마음에는 눈이 포근하게 내렸습니다.',
      '이번 주 마음은 고요한 눈에 덮여 차분했습니다.',
      '이번 주는 세상이 조용히 하얘진 날이 많았습니다.',
    ],
    mid: [
      '이번 주는 눈 내리는 날이 가장 많았습니다.',
      '이번 주 마음에는 고요한 눈이 가장 자주 내렸습니다.',
      '눈 내리는 고요한 날이 가장 많았던 한 주였습니다.',
    ],
  },
  rainbow: {
    all: [
      '무지개가 아낌없이 뜬 한 주였습니다.',
      '이번 주는 하늘 곳곳에서 매일 무지개가 관측되었습니다.',
    ],
    strong: [
      '이번 주 마음에는 무지개가 자주 떴습니다.',
      '이번 주는 하늘 곳곳에서 무지개가 관측되었습니다.',
      '이번 주 마음에는 무지개가 넉넉하게 걸렸습니다.',
    ],
    mid: [
      '이번 주는 무지개가 뜬 날이 가장 많았습니다.',
      '이번 주 마음에는 무지개가 가장 자주 걸렸습니다.',
      '무지개가 가장 자주 얼굴을 내민 한 주였습니다.',
    ],
  },
};

const OPENING_WEAK = [
  '{N:이/가} 가장 자주 관측되었으나 날씨는 고르게 오갔습니다.',
  '특정한 날씨 없이 다양한 하늘이 지나간 한 주였습니다.',
  '{N:이/가} 조금 더 많았을 뿐, 하늘은 여러 얼굴을 보여 주었습니다.',
];

// 가장 많은 날씨가 둘 이상 같은 수일 때
const OPENING_TIE = [
  '특정한 날씨 없이 다양한 하늘이 지나간 한 주였습니다.',
  '여러 날씨가 비슷한 비중으로 오간 한 주였습니다.',
  '하늘이 한 가지 얼굴만 보이지 않은 한 주였습니다.',
];

const OPENING_FICKLE = [
  '이번 주 마음의 날씨는 하루가 멀다 하고 바뀌었습니다.',
  '맑았다 흐렸다 하는 변덕스러운 날씨가 이어졌습니다.',
  '이번 주는 하늘이 종잡을 수 없이 오락가락했습니다.',
  '이번 주 마음은 일기도를 그리기 어려울 만큼 자주 바뀌었습니다.',
  '맑았다가 흐렸다가, 하루하루 다른 하늘이 이어졌습니다.',
  '이번 주 마음은 바람 부는 대로 날씨가 바뀌었습니다.',
];

const KINDS = [
  '한 주 동안 무려 {k}가지 날씨가 관측되었습니다.',
  '일주일 사이에 {k}가지 날씨가 다녀갔습니다.',
];

const HEADLINE = {
  sunny: { strong: ['대체로 맑음', '맑고 포근함', '쾌청한 한 주', '맑음, 볕 좋음'], mid: ['맑은 날 많음', '맑음 우세', '구름 사이 맑음'] },
  cloudy: { strong: ['구름 많음', '대체로 흐림', '잔잔한 구름'], mid: ['구름 다소 많음', '흐린 날 우세'] },
  rain: { strong: ['곳곳에 비', '비 내리는 한 주', '촉촉한 한 주'], mid: ['가끔 비', '비 오락가락'] },
  thunder: { strong: ['천둥 주의', '곳에 따라 천둥', '번개 동반'], mid: ['천둥 주의', '때때로 천둥'] },
  snow: { strong: ['고요한 눈', '포근한 함박눈', '눈 내리는 한 주'], mid: ['가끔 눈', '눈 조금'] },
  rainbow: { strong: ['무지개 뜸', '무지개 활짝', '무지개 대풍년'], mid: ['무지개 관측', '무지개 우세'] },
};
const HEADLINE_WEAK = ['하늘이 고루 오감', '오락가락한 한 주', '여러 얼굴의 하늘'];
const HEADLINE_FICKLE = ['변덕스러운 한 주', '하루가 멀다 하고 변덕', '변덕 심한 날씨'];
const HEADLINE_UP = ['차차 맑아짐', '갈수록 맑음', '점점 갬'];
const HEADLINE_DOWN = ['차차 흐려짐', '갈수록 흐림', '점점 구름 많아짐'];
const HEADLINE_REBOUND = ['비 갠 뒤 무지개', '비 온 뒤 무지개'];

// 슬픈 주에 덧붙이는 위로. 놀리지 않는다.
const COMFORT = [
  '마음이 젖는 날이 많았지만, 비는 반드시 그치게 되어 있습니다.',
  '기상청은 이 모든 날씨가 지나가는 중이라고 판단합니다.',
  '흐리고 젖은 날도 소중한 관측 기록입니다. 한 주 수고 많으셨습니다.',
  '이런 날씨가 이어질 때는 무리하지 않으셔도 괜찮습니다.',
  '견뎌 낸 하루하루가 모두 기록으로 남았습니다. 고생 많으셨습니다.',
];

const REBOUND = [
  '{D1}의 {W1:이/가} 그치고 {D2}에는 무지개가 떴습니다.',
  '{D1}의 {W1:이/가} 지나간 {D2}에는 어김없이 무지개가 걸렸습니다.',
];

const STREAK = [
  '{D1}부터 {D2}까지 {N:이/가} {n}일간 이어졌습니다.',
  '{D1}부터 {D2}까지 {n}일 연속으로 {N:이/가} 관측되었습니다.',
  '{D1}부터 {D2}까지 {n}일 동안 {N:이/가} 자리를 지켰습니다.',
];

// 눈에 띄는 정도. 점수 차이가 같으면 더 드문 날씨를 먼저 말한다.
const RARITY = ['sunny', 'cloudy', 'rain', 'snow', 'rainbow', 'thunder'];

// 비·천둥이 많은 주에서 하루만 나아졌을 때 쓰는 문장. 접속어 '그래도'와 뜻이 맞아야 한다.
// 키: 그 주의 대표 날씨 → 나아진 날의 날씨
const EASED = {
  thunder: {
    sunny: ['{D}에는 천둥이 물러가고 잠시 해가 났습니다.', '{D}에는 천둥이 잦아들고 구름 사이로 볕이 들었습니다.'],
    cloudy: ['{D}에는 천둥이 잦아들고 구름만 머물렀습니다.', '{D}에는 천둥이 그치고 구름만 낮게 깔렸습니다.'],
    rain: ['{D}에는 천둥이 잦아들고 약한 비만 내렸습니다.', '{D}에는 천둥이 그치고 가랑비만 지나갔습니다.'],
    snow: ['{D}에는 천둥이 그치고 고요한 눈이 내렸습니다.'],
    rainbow: ['{D}에는 천둥이 그치고 무지개가 떴습니다.'],
  },
  rain: {
    sunny: ['{D}에는 비가 그치고 잠시 해가 났습니다.', '{D}에는 비가 그치고 구름 사이로 볕이 들었습니다.'],
    cloudy: ['{D}에는 비가 그치고 구름만 머물렀습니다.', '{D}에는 비가 잦아들고 구름만 남았습니다.'],
    snow: ['{D}에는 비가 그치고 고요한 눈이 내렸습니다.'],
    rainbow: ['{D}에는 비가 그치고 무지개가 떴습니다.', '{D}에는 비가 갠 뒤 무지개가 걸렸습니다.'],
  },
};

const JUMP = [
  '특히 {D1}의 {N1}에서 {D2}의 {N2:으로/로} 하루 만에 바뀌어 마음 일교차가 컸습니다.',
  '{D1}에서 {D2:으로/로} 넘어가는 사이 {N1:이/가} {N2:으로/로} 급변했습니다.',
];

const VS_UP = [
  '지난주보다 마음 기온이 {d}도 올라 한결 포근했습니다.',
  '마음 기온은 지난주보다 {d}도 높았습니다.',
];
const VS_DOWN = [
  '지난주보다 마음 기온이 {d}도 낮아 마음의 겉옷이 필요했습니다.',
  '마음 기온은 지난주보다 {d}도 낮았습니다. 따뜻한 차가 어울리는 날씨였습니다.',
];
const VS_DOWN_WARM = [
  '마음 기온은 지난주보다 {d}도 낮았으나 여전히 포근한 편이었습니다.',
  '지난주보다 마음 기온이 {d}도 내려갔지만 볕은 충분했습니다.',
];
const VS_SAME = [
  '마음 기온은 지난주와 비슷한 수준을 보였습니다.',
  '마음 기온은 지난주와 큰 차이가 없었습니다.',
];

const UNIFORM = [
  '관측된 {n}일이 모두 같은 하늘이어서, 이번 주 예보 오차는 거의 없었습니다.',
  '관측된 {n}일 내내 같은 하늘이어서 일교차 없는 한 주였습니다.',
];
const UNIFORM_SAD = ['관측된 {n}일 내내 같은 하늘이었습니다. 쉽지 않은 한 주였습니다.'];

const TIPS = {
  sunny: [
    '이런 날씨에는 이유 없는 산책을 권해 드립니다.',
    '미뤄 둔 일을 하나만 꺼내 보기에 좋은 날씨입니다. 부담 없이 시도해 보시기 바랍니다.',
    '외출 시 가벼운 발걸음과 좋아하는 노래를 챙기시기 바랍니다.',
    '볕이 좋을 때 마음도 널어 두시기 바랍니다.',
  ],
  cloudy: [
    '흐린 날에는 따뜻한 음료 한 잔이 도움이 되겠습니다.',
    '구름이 많을 때는 좋아하는 노래의 효과가 큽니다. 이어폰을 챙기시기 바랍니다.',
    '하늘이 흐려도 할 일은 천천히 하셔도 좋겠습니다.',
    '구름 낀 날의 점심은 평소보다 조금 맛있는 것으로 정하시기 바랍니다.',
  ],
  rain: [
    '외출 시 작은 우산과 좋아하는 간식을 챙기시기 바랍니다.',
    '비 오는 날에는 따뜻한 국물과 일찍 눕기를 권해 드립니다.',
    '젖은 마음은 포근한 이불에 말리시기 바랍니다.',
    '빗소리를 틀어 놓고 아무것도 하지 않는 시간을 권해 드립니다.',
  ],
  thunder: [
    '천둥이 잦을 때는 숨을 크게 세 번 쉬고, 좋아하는 간식을 드시기 바랍니다.',
    '번개가 칠 때는 잠시 창밖을 보며 깊게 숨 쉬시길 권해 드립니다.',
    '충분한 수면과 달콤한 간식이 가장 확실한 피뢰침입니다.',
  ],
  snow: [
    '눈 오는 날에는 두꺼운 양말과 느린 걸음을 권해 드립니다.',
    '조용한 밤에는 따뜻한 차 한 잔과 책 한 권이 어울리겠습니다.',
    '고요함이 필요한 때입니다. 알림을 잠시 꺼 두셔도 좋겠습니다.',
  ],
  rainbow: [
    '이런 기분은 사진 대신 마음에 오래 저장해 두시기 바랍니다.',
    '좋은 일이 있었다면 가까운 사람에게 한마디 전하시길 권해 드립니다.',
    '무지개 관측 기념으로 좋아하는 간식을 드셔도 좋겠습니다.',
  ],
  sad: [
    '외출 시 작은 우산과 좋아하는 간식을 챙기시기 바랍니다.',
    '따뜻한 차 한 잔과 일찍 눕기를 권해 드립니다. 그것으로 충분한 한 주입니다.',
    '젖은 마음은 포근한 이불에 말리시기 바랍니다.',
    '힘든 날에는 연락하고 싶은 사람에게 안부를 한 줄 보내 보시기 바랍니다.',
  ],
  fickle: [
    '변덕스러운 날씨에는 겉옷처럼 걸칠 수 있는 여유 하나를 챙기시기 바랍니다.',
    '날씨가 자주 바뀔수록 하루의 속도를 반 박자 늦추시길 권해 드립니다.',
    '오락가락하는 날씨에는 일정을 조금 느슨하게 잡으시기 바랍니다.',
  ],
  few: [
    '하루 한 번, 하늘을 올려다보시길 권해 드립니다.',
    '관측소는 언제든 문을 열어 두겠습니다. 편하실 때 들러 주시기 바랍니다.',
  ],
};

// 아직 끝나지 않은 주(관측 중)에 기록이 적을 때
const OBSERVING = {
  headline: ['관측 중입니다', '관측 시작'],
  none: [
    '이번 주 관측이 막 시작되어 아직 발표할 예보가 없습니다.',
    '첫 하늘이 기록되는 대로 예보를 이어 가겠습니다.',
  ],
  lead: [
    '이번 주는 관측이 막 시작되어 {n}일치 자료만 모였습니다.',
    '현재까지 관측된 날은 {n}일이며, 예보는 잠정 수준입니다.',
  ],
  tail: [
    '남은 날의 하늘은 관측되는 대로 반영하겠습니다.',
    '나머지 하늘은 앞으로 천천히 채워질 예정입니다.',
  ],
  outlook: [
    '이번 주 자료가 모이면 다음 주 전망을 말씀드리겠습니다.',
    '다음 주 전망은 관측이 더 쌓인 뒤 발표하겠습니다.',
  ],
};

const FEW = {
  none: {
    headline: ['관측 자료 없음', '관측소 휴업 중'],
    body: [
      ['이번 주는 관측 자료가 없어 예보를 발표하지 못했습니다.', '관측소가 휴업 중이었던 한 주입니다. 쉬어 가는 것도 하나의 날씨입니다.'],
      ['기록된 하늘이 없어 이번 주 예보는 비워 둡니다.', '아무 일도 없었다는 것 역시 소중한 관측 결과입니다.'],
    ],
    outlook: ['다음 주에는 관측소가 문을 활짝 열고 기다리겠습니다.', '다음 주 날씨는 첫 관측이 있어야 예측할 수 있겠습니다.'],
  },
  some: {
    headline: ['관측 자료 부족', '예보 신뢰도 낮음', '자료 부족으로 보류'],
    lead: [
      '관측 자료가 {n}일치뿐이라 정확한 예보를 발표하기 어렵습니다.',
      '기상청은 {n}일치 기록만으로 한 주의 날씨를 단정할 수 없다는 입장입니다.',
      '이번 주는 관측된 날이 {n}일뿐이어서 예보 신뢰도가 낮은 편입니다.',
    ],
    comfortTail: [
      '비 온 뒤에는 공기가 맑아지는 법이니, 조금 더 지켜보겠습니다.',
      '나머지 날은 쉬어 갔으나, 젖은 하늘도 곧 갤 것으로 보입니다.',
    ],
    tail: [
      '나머지 날은 관측소가 잠시 쉬어 갔습니다.',
      '그 밖의 날은 관측되지 않았으나 하늘은 그 자리에 있었을 것으로 보입니다.',
    ],
    outlook: [
      '다음 주에는 더 많은 관측을 기대하며 잠정 전망만 말씀드립니다.',
      '다음 주 전망은 관측 자료가 모이는 대로 정밀하게 발표하겠습니다.',
    ],
  },
};

// ── 계산 ─────────────────────────────────────────────

const tempOf = (score) => Math.round(12 + (score - 1) * 4);
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

function isoWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const thursday = new Date(Date.UTC(y, m - 1, d + 3));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
}

function periodOf(start, end, store) {
  const a = store.parseDate(start);
  const b = store.parseDate(end);
  const left = `${a.getMonth() + 1}월 ${a.getDate()}일`;
  const right = a.getMonth() === b.getMonth() ? `${b.getDate()}일` : `${b.getMonth() + 1}월 ${b.getDate()}일`;
  return `${left} – ${right}`;
}

function analyze(days) {
  const filled = days.filter((d) => d.weather);
  const counts = Object.fromEntries(WEATHER_IDS.map((id) => [id, 0]));
  const lastSeen = {};
  days.forEach((d, i) => {
    if (!d.weather) return;
    counts[d.weather] += 1;
    lastSeen[d.weather] = i;
  });
  const n = filled.length;
  let dominant = null;
  for (const id of WEATHER_IDS) {
    if (!counts[id]) continue;
    if (!dominant || counts[id] > counts[dominant] || (counts[id] === counts[dominant] && lastSeen[id] > lastSeen[dominant])) dominant = id;
  }
  const share = n ? counts[dominant] / n : 0;
  const scores = filled.map((d) => d.score);
  const meanScore = avg(scores);

  // 하루 사이 점수가 크게 뛴 곳 (붙어 있는 두 날만 본다)
  const jumps = [];
  for (let i = 0; i < 6; i += 1) {
    const a = days[i];
    const b = days[i + 1];
    if (a.weather && b.weather) jumps.push({ i, size: Math.abs(a.score - b.score) });
  }
  const bigJumps = jumps.filter((j) => j.size >= 2);
  const biggest = jumps.reduce((best, j) => (!best || j.size > best.size ? j : best), null);

  // 초반(월~수)과 후반(목~일)의 평균 비교
  const early = days.slice(0, 3).filter((d) => d.weather).map((d) => d.score);
  const late = days.slice(3).filter((d) => d.weather).map((d) => d.score);
  const trend = early.length && late.length ? avg(late) - avg(early) : 0;

  const distinct = WEATHER_IDS.filter((id) => counts[id]).length;
  // 비·천둥이 70% 이상이면 평균과 상관없이 위로가 필요한 주로 본다.
  const rainShare = n ? (counts.rain + counts.thunder) / n : 0;
  const sad = n >= 3 && ((meanScore <= 2.4 && rainShare >= 0.4) || rainShare >= 0.7);
  const tied = dominant !== null && WEATHER_IDS.filter((id) => counts[id] === counts[dominant]).length > 1;
  const hugeJumps = jumps.filter((j) => j.size >= 3);
  const fickle = n >= 4 && share < 0.5
    && (bigJumps.length >= 3 || (hugeJumps.length >= 2 && bigJumps.length >= 2) || (distinct >= 5 && Math.abs(trend) < 1));

  return {
    counts, n, dominant, share, meanScore, sad, tied, jumps, bigJumps, biggest, trend, distinct, fickle,
    earlyAvg: avg(early), lateAvg: avg(late), earlyN: early.length, lateN: late.length,
  };
}

// 'all'은 7일 중 6일 이상 같은 날씨일 때만 쓴다("한 주 내내", "매일"이 거짓이 되지 않게).
const strength = (a) => (a.share >= 0.8 && a.counts[a.dominant] >= 6 ? 'all'
  : a.share >= 0.55 ? 'strong' : a.share >= 0.35 ? 'mid' : 'weak');

function longestStreak(days) {
  let best = null;
  let i = 0;
  while (i < 7) {
    if (!days[i].weather) { i += 1; continue; }
    let j = i;
    while (j + 1 < 7 && days[j + 1].weather === days[i].weather) j += 1;
    const len = j - i + 1;
    if (len >= 3 && (!best || len > best.len)) best = { from: i, to: j, len, weather: days[i].weather };
    i = j + 1;
  }
  return best;
}

function findRebound(days) {
  for (let i = 0; i < 6; i += 1) {
    const w = days[i].weather;
    if ((w === 'rain' || w === 'thunder') && days[i + 1].weather === 'rainbow') return { i, weather: w };
  }
  return null;
}

// ── 문장 만들기 ──────────────────────────────────────

// avoid: 바로 앞 주의 제목. 같은 말이 연달아 나오지 않게 다른 후보를 고른다.
function headlineFor(a, rebound, rng, observing, avoid) {
  const choose = (bank) => {
    const rest = bank.filter((h) => h !== avoid);
    return pick(rest.length ? rest : bank, rng);
  };
  if (a.n < 3 && observing) return choose(OBSERVING.headline);
  if (a.n === 0) return choose(FEW.none.headline);
  if (a.n < 3) return choose(FEW.some.headline);
  if (a.counts.thunder >= 2 && a.counts.thunder / a.n >= 0.4) return choose(HEADLINE.thunder.strong);
  if (a.fickle) return choose(HEADLINE_FICKLE);
  if (rebound && a.dominant !== 'rainbow' && a.share < 0.55) return choose(HEADLINE_REBOUND);
  if (a.share < 0.55 && Math.abs(a.trend) >= 1) {
    return a.trend > 0 ? choose(HEADLINE_UP) : choose(HEADLINE_DOWN);
  }
  const level = strength(a);
  if (level === 'weak' || a.tied) return choose(HEADLINE_WEAK);
  return choose(level === 'mid' ? HEADLINE[a.dominant].mid : HEADLINE[a.dominant].strong);
}

function trendSentence(a) {
  const early = a.earlyAvg;
  const late = a.lateAvg;
  const up = a.trend > 0;
  let first;
  let second;
  if (up) {
    first = early < 2.2 ? '주 초반에는 비가 잦았으나' : early < 3.2 ? '주 초반에는 구름이 많았으나' : '주 초반에는 다소 잔잔했으나';
    second = late >= 4 ? '후반으로 갈수록 차차 맑아졌습니다.' : late >= 3 ? '후반으로 갈수록 구름이 걷혀 갔습니다.' : '후반에는 비가 차차 잦아들었습니다.';
  } else {
    first = early >= 4 ? '주 초반에는 맑았으나' : '주 초반에는 대체로 평온했으나';
    second = late < 2 ? '후반으로 갈수록 비구름이 짙어졌습니다.' : late < 3 ? '후반으로 갈수록 구름이 짙어졌습니다.' : '후반에는 구름이 조금 늘었습니다.';
  }
  return `${first} ${second}`;
}

function outlierSentence(days, a, rng, skip) {
  if (!a.dominant) return null;
  const domScore = WEATHERS[a.dominant].score;
  let best = null;
  days.forEach((d, i) => {
    if (skip.includes(i) || !d.weather || d.weather === a.dominant || a.counts[d.weather] !== 1) return;
    const gap = Math.abs(d.score - domScore);
    const rank = RARITY.indexOf(d.weather);
    if (!best || gap > best.gap || (gap === best.gap && (rank > best.rank || (rank === best.rank && i > best.i)))) {
      best = { i, gap, rank, weather: d.weather, score: d.score };
    }
  });
  if (!best) return null;
  const eased = best.score > domScore && domScore <= 2 ? EASED[a.dominant]?.[best.weather] : null;
  if (eased) return `그래도 ${fill(pick(eased, rng), { D: DAY_NAMES[best.i] })}`;
  const connector = best.score < domScore ? '다만 ' : best.score > domScore ? '한편 ' : '이와 달리 ';
  return connector + fill(pick(EVENT[best.weather], rng), { D: DAY_NAMES[best.i] });
}

function bodyFor(days, a, rebound, streak, vsLast, rng) {
  const sentences = [];
  const sad = a.sad;

  if (a.fickle) {
    sentences.push(pick(OPENING_FICKLE, rng));
  } else {
    const level = strength(a);
    if (a.tied && level !== 'strong' && level !== 'all') {
      sentences.push(pick(OPENING_TIE, rng));
    } else if (level === 'weak') {
      sentences.push(fill(pick(OPENING_WEAK, rng), { N: NOUN[a.dominant] }));
    } else {
      sentences.push(pick(OPENING[a.dominant][level], rng));
    }
  }

  const candidates = [];
  if (rebound) {
    candidates.push(fill(pick(REBOUND, rng), {
      D1: DAY_NAMES[rebound.i], D2: DAY_NAMES[rebound.i + 1], W1: NOUN[rebound.weather],
    }));
  }
  if (streak && !(streak.len >= 5 && a.share >= 0.7)) {
    // 첫 문장과 끝맺음이 겹치지 않는 틀만 쓴다.
    const taken = sentences[0].includes('이어졌') ? STREAK.filter((t) => !t.includes('이어졌')) : STREAK;
    candidates.push(fill(pick(taken, rng), {
      D1: DAY_NAMES[streak.from], D2: DAY_NAMES[streak.to], N: NOUN[streak.weather], n: streak.len,
    }));
  }
  if (a.fickle && a.biggest && !(rebound && rebound.i === a.biggest.i)) {
    const { i } = a.biggest;
    candidates.push(fill(pick(JUMP, rng), {
      D1: DAY_NAMES[i], D2: DAY_NAMES[i + 1], N1: NOUN[days[i].weather], N2: NOUN[days[i + 1].weather],
    }));
  }
  if (a.fickle && a.distinct >= 4) candidates.push(fill(pick(KINDS, rng), { k: a.distinct }));
  const trending = !a.fickle && a.share < 0.55 && Math.abs(a.trend) >= 1;
  if (trending) candidates.push(trendSentence(a));
  const outlier = outlierSentence(days, a, rng, rebound ? [rebound.i, rebound.i + 1] : []);
  if (outlier && !a.fickle && !trending) candidates.push(outlier);
  if (a.distinct === 1 && a.n >= 4) candidates.push(fill(pick(sad ? UNIFORM_SAD : UNIFORM, rng), { n: a.n }));

  if (vsLast !== null) {
    const d = Math.abs(vsLast);
    if (d >= 2) candidates.push(fill(pick(vsLast > 0 ? VS_UP : a.meanScore >= 3.5 ? VS_DOWN_WARM : VS_DOWN, rng), { d }));
    else candidates.push(pick(VS_SAME, rng));
  }

  // 앞의 둘을 쓰되, 셋 이상이면 하나는 주마다 다르게 빠진다.
  let chosen = candidates.slice(0, 3);
  if (chosen.length === 3) chosen.splice(1 + Math.floor(rng() * 2), 1);
  if (sad) chosen = chosen.slice(0, 1);
  sentences.push(...chosen);

  if (sad) sentences.push(pick(COMFORT, rng));
  return sentences;
}

// ── 다음 주 전망 ─────────────────────────────────────

const TIER_STEADY = ['비구름이 짙게 머물', '구름이 짙고 비가 내릴 때도 있을', '구름이 많을', '대체로 맑을', '내내 맑고 포근할'];
const TIER_EARLY = ['비구름이 짙겠으나', '구름이 많고 비가 내리겠으나', '구름이 많겠으나', '대체로 맑겠으나', '맑고 포근하겠으나'];
const TIER_UP = ['비가 잦아들', '구름이 옅어질', '구름이 걷힐', '맑아질', '맑고 포근해질'];
const TIER_DOWN = ['비구름이 다가올', '구름이 짙어질', '구름이 많아질', '구름이 조금 많아질', '구름이 끼기도 할'];

const tierOf = (s) => (s >= 4.2 ? 4 : s >= 3.4 ? 3 : s >= 2.6 ? 2 : s >= 1.8 ? 1 : 0);

function outlookFor(weekStart, store, rng) {
  const nextStart = store.addDays(weekStart, 7);
  const history = store.getRange(store.addDays(weekStart, -77), store.addDays(weekStart, 6));
  const scoreOf = (r) => WEATHERS[r.weather].score;
  const overall = avg(history.slice(-28).map(scoreOf));
  const recent = avg(history.slice(-4).map(scoreOf));
  const weekdayScores = Array.from({ length: 7 }, (_, d) => {
    const date = store.addDays(nextStart, d);
    const wd = store.parseDate(date).getDay();
    const same = history.filter((r) => store.parseDate(r.date).getDay() === wd);
    return same.length >= 2 ? avg(same.map(scoreOf)) : null;
  });
  if (!history.length) return null;

  // 요일 경향 0.45, 최근 흐름 0.35, 평균 0.2를 섞고 살짝 낙관 쪽으로 기운다.
  const predicted = weekdayScores.map((w) => {
    const parts = [[recent, 0.35], [overall, 0.2]];
    if (w !== null) parts.push([w, 0.45]);
    const weight = parts.reduce((s, [, k]) => s + k, 0);
    return parts.reduce((s, [v, k]) => s + v * k, 0) / weight + 0.2;
  });

  const splits = [
    { at: 1, a: '월요일', b: '이후' },
    { at: 3, a: '초반', b: '후반' },
    { at: 5, a: '주중', b: '주말' },
  ];
  let best = null;
  for (const sp of splits) {
    const diff = tierOf(avg(predicted.slice(sp.at))) - tierOf(avg(predicted.slice(0, sp.at)));
    if (!best || Math.abs(diff) > Math.abs(best.diff) || (Math.abs(diff) === Math.abs(best.diff) && sp.at === 3)) best = { ...sp, diff };
  }
  const firstTier = tierOf(avg(predicted.slice(0, best.at)));
  const secondTier = tierOf(avg(predicted.slice(best.at)));
  const wholeTier = tierOf(avg(predicted));

  if (Math.abs(best.diff) < 1) {
    return `다음 주에는 ${TIER_STEADY[wholeTier]} 전망입니다.`;
  }
  if (best.diff > 0) {
    if (best.at === 1) return `다음 주 월요일에는 ${TIER_EARLY[firstTier]} 이후 ${TIER_STEADY[secondTier]} 전망입니다.`;
    const label = best.at === 3 ? '다음 주 초반에는' : '다음 주 주중에는';
    const lateLabel = best.at === 3 ? '후반으로 갈수록 차차' : '주말부터 차차';
    return `${label} ${TIER_EARLY[firstTier]} ${lateLabel} ${TIER_UP[secondTier]} 전망입니다.`;
  }
  const head = best.at === 1 ? '다음 주 월요일에는' : best.at === 3 ? '다음 주 초반에는' : '다음 주 주중에는';
  const label = `${head} ${TIER_EARLY[firstTier]} ${best.at === 1 ? '이후' : best.at === 3 ? '후반으로 갈수록' : '주말부터'}`;
  const umbrella = secondTier <= 1 ? ' 우산은 가볍게 챙겨 두시기 바랍니다.' : '';
  return `${label} ${TIER_DOWN[secondTier]} 전망입니다.${umbrella}`;
}

// ── 공개 함수 ────────────────────────────────────────

function daysOf(weekStart, store) {
  return DAY_LABELS.map((label, i) => {
    const date = store.addDays(weekStart, i);
    const weather = store.getRecord(date)?.weather ?? null;
    const score = weather ? WEATHERS[weather].score : null;
    return { date, label, weather, score, temp: weather ? tempOf(score) : null };
  });
}

// 제목만 따로 구한다(앞 주와 겹침을 피하는 데 쓴다).
function headlineOf(weekStart, store, avoid) {
  const days = daysOf(weekStart, store);
  const observing = weekStart >= store.weekStart(store.todayStr());
  return headlineFor(analyze(days), findRebound(days), makeRng(`${weekStart}:headline`), observing, avoid);
}

export function buildForecast(weekStart, store) {
  const days = daysOf(weekStart, store);
  const weekEnd = store.addDays(weekStart, 6);
  const a = analyze(days);
  const rng = makeRng(`${weekStart}:body`);
  const headRng = makeRng(`${weekStart}:headline`);
  const tipRng = makeRng(`${weekStart}:tip`);
  const outRng = makeRng(`${weekStart}:outlook`);

  const rebound = findRebound(days);
  const streak = longestStreak(days);
  const observing = weekStart >= store.weekStart(store.todayStr());

  let body;
  let outlook;
  let tip;
  const headline = headlineFor(a, rebound, headRng, observing,
    headlineOf(store.addDays(weekStart, -7), store));

  if (a.n < 3) {
    if (a.n === 0) {
      body = observing ? [...OBSERVING.none] : [...pick(FEW.none.body, rng)];
      outlook = pick(observing ? OBSERVING.outlook : FEW.none.outlook, outRng);
    } else {
      body = [fill(pick(observing ? OBSERVING.lead : FEW.some.lead, rng), { n: a.n })];
      days.filter((d) => d.weather).forEach((d, k) => {
        const dayName = DAY_NAMES[DAY_LABELS.indexOf(d.label)];
        body.push((k === 0 ? '관측된 날 가운데 ' : '') + fill(pick(EVENT[d.weather], rng), { D: dayName }));
      });
      const gloomy = days.some((d) => d.weather === 'rain' || d.weather === 'thunder');
      body.push(gloomy ? pick(FEW.some.comfortTail, rng) : pick(observing ? OBSERVING.tail : FEW.some.tail, rng));
      outlook = pick(observing ? OBSERVING.outlook : FEW.some.outlook, outRng);
    }
    tip = pick(TIPS.few, tipRng);
  } else {
    const prevRecords = store.getRange(store.addDays(weekStart, -7), store.addDays(weekStart, -1));
    const vsLast = prevRecords.length >= 3
      ? a.n && tempOf(a.meanScore) - tempOf(avg(prevRecords.map((r) => WEATHERS[r.weather].score)))
      : null;
    body = bodyFor(days, a, rebound, streak, vsLast, rng);
    outlook = outlookFor(weekStart, store, outRng) ?? pick(FEW.some.outlook, outRng);
    tip = pick(a.sad ? TIPS.sad : a.fickle ? TIPS.fickle : TIPS[a.dominant], tipRng);
  }

  const rainy = a.counts.rain + a.counts.thunder;
  const stats = {
    temp: a.n ? tempOf(a.meanScore) : null,
    rainChance: a.n ? Math.round((rainy / a.n) * 10) * 10 : null,
    clearDays: a.counts.sunny + a.counts.rainbow,
  };

  return {
    weekStart,
    weekEnd,
    period: periodOf(weekStart, weekEnd, store),
    issue: isoWeek(weekStart),
    observing,
    days,
    recorded: a.n,
    sad: a.sad,
    dominant: a.dominant,
    headline,
    body,
    outlook,
    tip,
    stats,
  };
}
