// '나의 기분 일기예보': 한 주의 기록을 기상 캐스터 말투로 정리한다.
// 같은 기록이면 항상 같은 문장이 나오도록 주(week)를 씨앗으로 쓴다.

import { addDays, formatDate, hash, josa, mondayOf, parseKey, pick, rng, todayKey, pad } from './util.js';
import { W } from './weather.js';
import * as store from './store.js';

const DOW_LONG = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
const DOW_SHORT = ['월', '화', '수', '목', '금', '토', '일'];

const LEADS = {
  bright: ['이번 주 마음 하늘은 대체로 화창했습니다.', '볕 좋은 날이 많은 한 주였습니다.'],
  rainy: ['이번 주 마음 하늘에는 비구름이 자주 머물렀습니다.', '우산이 자주 필요한 한 주였습니다.'],
  stormy: ['이번 주 마음 하늘은 꽤 사나웠습니다.', '번개가 자주 치는 거친 한 주였습니다.'],
  foggy: ['한 치 앞이 잘 안 보이는 한 주였습니다.', '마음 전역에 안개가 짙게 낀 한 주였습니다.'],
  windy: ['마음이 쉴 틈 없이 분주한 한 주였습니다.', '곳곳에 바람이 세게 분 한 주였습니다.'],
  snowy: ['소리 없이 고요한 한 주였습니다.', '마음에 눈이 조용히 쌓인 한 주였습니다.'],
  cloudy: ['해와 구름이 드나드는 무난한 한 주였습니다.', '구름이 많았지만 큰 탈 없는 한 주였습니다.'],
  mixed: ['맑음과 흐림이 번갈아 찾아온 변덕스러운 한 주였습니다.', '하루가 멀다 하고 날씨가 바뀐 한 주였습니다.'],
};

const OUTLOOK = {
  bright: ['다음 주에도 포근한 볕이 이어질 전망입니다.', '이 맑음은 다음 주까지 번질 것으로 보입니다.'],
  rainy: ['비 온 뒤 땅이 굳듯, 다음 주엔 차차 갤 전망입니다.', '곧 구름 사이로 해가 보일 전망입니다.'],
  stormy: ['폭풍이 지나면 공기가 한결 맑아질 전망입니다.', '천둥은 곧 잦아들 것으로 보입니다.'],
  foggy: ['해가 오르면 안개는 서서히 걷힐 전망입니다.', '다음 주엔 시야가 조금씩 트일 전망입니다.'],
  windy: ['다음 주엔 바람이 잦아들고 한숨 돌릴 전망입니다.', '돌풍이 지나고 잔잔해질 전망입니다.'],
  snowy: ['쌓인 눈 아래에서 봄이 준비 중이라는 소식입니다.', '다음 주까지 포근한 고요가 이어질 전망입니다.'],
  cloudy: ['구름 사이로 뜻밖의 볕이 들 전망입니다.', '다음 주엔 맑은 틈이 늘어날 전망입니다.'],
  mixed: ['다음 주 날씨도 변덕스럽지만 결국 내 편일 전망입니다.', '어떤 날씨든 지나간다는 예보입니다.'],
};

const TIPS = {
  bright: ['좋아하는 사람에게 안부를 챙기세요', '이 기분을 나눌 약속을 잡아 보세요'],
  rainy: ['따뜻한 국물과 이른 취침을 권합니다', '마음용 우산을 챙기세요'],
  stormy: ['중요한 답장은 하룻밤 재운 뒤 보내세요', '달달한 간식을 비상용으로 챙기세요'],
  foggy: ['할 일은 딱 하나만 정하세요', '천천히 서행하세요'],
  windy: ['일정 하나를 과감히 비우세요', '날아가는 일은 그냥 보내 주세요'],
  snowy: ['담요와 따뜻한 차를 챙기세요', '오늘은 느리게 걸으세요'],
  cloudy: ['가벼운 산책을 추천합니다', '창문을 열고 환기하세요'],
  mixed: ['우산과 선글라스를 함께 챙기세요', '겉옷을 하나 더 챙기세요'],
};

// 눈에 띄었던 날을 문장으로. 큰 흐름의 변화가 없을 때는 사건마다 어울리는 뒷말을 붙인다.
const EVENT = {
  rainbow: { text: (d) => `${d}에는 무지개까지 떴`, link: '고', after: '그 여운이 오래 남았습니다.' },
  clear: { text: (d) => `${d}에는 유난히 볕이 좋았`, link: '고', after: '그 밖에는 큰 변화가 없었습니다.' },
  cloud: { text: (d) => `${d}에는 구름이 잔뜩 꼈`, link: '지만', after: '큰 비는 없었습니다.' },
  snow: { text: (d) => `${d}에는 고요한 눈이 쌓였`, link: '고', after: '이내 마음이 조용해졌습니다.' },
  wind: { text: (d) => `${d}에는 강한 돌풍이 불었`, link: '지만', after: '곧 다시 잠잠해졌습니다.' },
  fog: { text: (d) => `${d}에는 짙은 안개가 꼈`, link: '지만', after: '서서히 걷혔습니다.' },
  rain: { text: (d) => `${d}에는 마음에 비가 내렸`, link: '지만', after: '곧 그쳤습니다.' },
  thunder: { text: (d) => `${d}에는 천둥을 동반한 짜증이 지나갔`, link: '지만', after: '곧 다시 잠잠해졌습니다.' },
};

export function buildForecast(monday, today = todayKey()) {
  const sunday = addDays(monday, 6);
  const days = DOW_SHORT.map((label, i) => {
    const key = addDays(monday, i);
    const entry = store.get(key);
    return { key, label, long: DOW_LONG[i], w: entry?.w || null, isFuture: key > today };
  });
  const logged = days.filter((d) => d.w);
  const n = logged.length;
  if (!n) return null;

  const count = (id) => logged.filter((d) => d.w === id).length;
  const R = rng(hash(`forecast${monday}`));
  const order = Object.keys(W)
    .map((id) => [id, count(id)])
    .filter(([, c]) => c)
    .sort((a, b) => b[1] - a[1] || W[b[0]].temp - W[a[0]].temp);
  const [dominant, topN] = order[0];

  const bright = count('clear') + count('rainbow');
  const wet = count('rain') + count('thunder');
  const avg = logged.reduce((s, d) => s + W[d.w].temp, 0) / n;
  const name = W[dominant].name;

  let tone;
  let headline;
  if (n === 1) {
    tone = { clear: 'bright', rainbow: 'bright', rain: 'rainy', thunder: 'stormy', fog: 'foggy', wind: 'windy', snow: 'snowy', cloud: 'cloudy' }[dominant];
    headline = `하루뿐인 ${name}`;
  } else if (topN === n && n >= 3) {
    tone = { clear: 'bright', rainbow: 'bright', rain: 'rainy', thunder: 'stormy', fog: 'foggy', wind: 'windy', snow: 'snowy', cloud: 'cloudy' }[dominant];
    headline = `내내 ${name}`;
  } else if (count('thunder') >= 2 || count('thunder') / n >= 0.4) {
    tone = 'stormy';
    headline = '천둥번개 주의보';
  } else if (bright / n >= 0.6) {
    tone = 'bright';
    if (count('rainbow')) headline = '맑고 무지개 뜸';
    else if (count('thunder')) headline = '맑고 한때 천둥';
    else if (count('rain')) headline = '맑고 한때 소나기';
    else headline = '대체로 맑음';
  } else if (count('rain') / n >= 0.5) {
    tone = 'rainy';
    headline = '흐리고 곳곳에 비';
  } else if (count('fog') / n >= 0.5) {
    tone = 'foggy';
    headline = '짙은 안개 주의보';
  } else if (count('wind') / n >= 0.5) {
    tone = 'windy';
    headline = '강풍 주의보';
  } else if (count('snow') / n >= 0.5) {
    tone = 'snowy';
    headline = '소복소복 눈 소식';
  } else if (count('cloud') / n >= 0.5) {
    tone = 'cloudy';
    headline = '구름 많음';
  } else if (wet / n >= 0.4) {
    tone = 'rainy';
    headline = '흐리고 가끔 비';
  } else {
    tone = 'mixed';
    headline = '맑았다 흐렸다';
  }

  let body;
  if (n === 1) {
    body = `이번 주는 ${logged[0].long} 하루만 관측되었습니다. 관측 결과는 ${josa(name, '이었/였')}습니다.`;
  } else if (topN === n && n >= 3) {
    body = `이번 주 마음은 ${n}일 내내 ${josa(name, '이었/였')}습니다. 흔치 않은 기록입니다.`;
  } else {
    const lead = pick(LEADS[tone], R);
    // 평범한 날보다 기온이 튄 날을 사건으로 고른다
    const sorted = [...logged].sort((a, b) => W[a.w].temp - W[b.w].temp);
    const low = sorted[0];
    const high = sorted[n - 1];
    const lowGap = avg - W[low.w].temp;
    const highGap = W[high.w].temp - avg;
    const hasRainbow = logged.find((d) => d.w === 'rainbow');
    let event;
    if (hasRainbow && (tone === 'bright' || tone === 'mixed')) event = hasRainbow;
    else if (tone === 'rainy' || tone === 'stormy') event = low;
    else event = lowGap >= highGap ? low : high;

    let trend = 0;
    if (n >= 4) {
      const mid = Math.floor(n / 2);
      const mean = (arr) => arr.reduce((s, d) => s + W[d.w].temp, 0) / arr.length;
      const delta = mean(logged.slice(mid)) - mean(logged.slice(0, mid));
      trend = delta >= 5 ? 1 : delta <= -5 ? -1 : 0;
    }
    const ev = EVENT[event.w];
    let link = ev.link;
    let tail = ev.after;
    if (trend !== 0) {
      const positive = W[event.w].temp >= 20;
      link = (positive && trend < 0) || (!positive && trend > 0) ? '지만' : '고';
      tail = trend > 0 ? '주 후반으로 갈수록 차차 개었습니다.' : '주 후반으로 갈수록 구름이 몰려왔습니다.';
    }
    body = `${lead} ${ev.text(event.long)}${link}, ${tail}`;
  }

  const complete = today > sunday || (today === sunday && !!store.get(sunday));
  const outlook = complete ? pick(OUTLOOK[tone], R) : '남은 며칠의 날씨는 아직 내 손에 있습니다.';
  const tip = pick(TIPS[tone], R);
  const d1 = parseKey(monday);
  const d2 = parseKey(sunday);

  return {
    monday,
    sunday,
    days,
    n,
    dominant,
    tone,
    headline,
    body,
    outlook,
    tip,
    complete,
    avgTemp: Math.round(avg),
    rainPct: Math.round((wet / n) * 100),
    brightDays: bright,
    range: `${pad(d1.getMonth() + 1)}.${pad(d1.getDate())} – ${pad(d2.getMonth() + 1)}.${pad(d2.getDate())}`,
    rangeLong: `${formatDate(monday)} – ${formatDate(sunday)}`,
  };
}

export function listWeeks() {
  const seen = new Set();
  const out = [];
  for (const e of store.all().reverse()) {
    const m = mondayOf(e.key);
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

// 다 지나간 주(또는 일요일 기록을 마친 이번 주) 가운데 아직 안 본 가장 최근 카드
export function arrivedWeek(today = todayKey()) {
  for (const mon of listWeeks()) {
    const sunday = addDays(mon, 6);
    const done = today > sunday || (today === sunday && !!store.get(sunday));
    if (!done) continue;
    return store.isSeen(mon) ? null : mon;
  }
  return null;
}

export function weekLabel(mon, today = todayKey()) {
  const thisMon = mondayOf(today);
  if (mon === thisMon) return '이번 주';
  if (mon === addDays(thisMon, -7)) return '지난주';
  return formatDate(mon);
}
