// '나의 기분 일기예보' 문장 만들기. 입력: 월~일 7칸 [{ key, date, entry|null }]
import { W } from './weather.js';
import { DOW } from './dates.js';

const ALL_SAME = { sunny: '내내 맑음', rainbow: '무지개 주간', cloudy: '내내 흐림', snow: '포근한 눈 주간', rain: '긴 장마', thunder: '천둥 경보' };
const MOSTLY = { sunny: '대체로 맑음', rainbow: '곳곳에 무지개', cloudy: '대체로 흐림', snow: '대체로 눈', rain: '대체로 비', thunder: '잦은 천둥' };
const PHRASE = { sunny: '반짝 맑음', rainbow: '무지개', cloudy: '구름', snow: '눈', rain: '한때 비', thunder: '천둥 번개' };
const SAME_LINE = {
  sunny: '기록한 날 모두 맑았어요.', rainbow: '기록한 날마다 무지개가 떴어요!', cloudy: '구름이 오래 머문 한 주였어요.',
  snow: '내내 고요한 눈이 내렸어요.', rain: '비가 그치지 않았네요. 많이 지쳤죠?', thunder: '천둥이 잦았던 한 주, 정말 고생했어요.',
};

const BUT = { sunny: '맑았지만', rainbow: '무지개가 떴지만', cloudy: '구름이 꼈지만', snow: '눈이 내렸지만', rain: '비가 내렸지만', thunder: '천둥이 쳤지만' };
const LATE = { sunny: '맑게 갰어요', rainbow: '무지개가 떴어요', cloudy: '구름이 몰려왔어요', snow: '눈이 내렸어요', rain: '비가 내렸어요', thunder: '천둥이 쳤어요' };

const dowName = (d) => `${DOW[d.getDay()]}요일`;
const hash = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

// 다음 주 예보: 제목·확률·한마디가 같은 칸에서 나오게 (서로 어긋나지 않게)
const BUCKETS = [
  { min: 4.2, w: 'sunny', label: '맑고 화창', lines: ['햇살 가득한 한 주가 기다려요. 이 기분 그대로!', '반짝이는 한 주가 될 거예요. 좋은 기운 나눠 줘요!', '구름 한 점 없는 마음, 다음 주에도 이어 가요.'] },
  { min: 3.4, w: 'sunny', label: '대체로 맑음', lines: ['대체로 맑겠어요. 가벼운 마음으로 출발해요.', '가끔 구름이 지나가도 금방 개요.', '산뜻한 바람이 부는 한 주가 될 거예요.'] },
  { min: 2.6, w: 'cloudy', label: '구름 많음', lines: ['구름이 조금 끼어도 괜찮아요. 나를 챙기는 한 주 되세요.', '흐린 날엔 따뜻한 차 한 잔 어때요?', '구름 사이로 해가 보일 거예요. 천천히 가요.'] },
  { min: 1.8, w: 'rain', label: '가끔 비, 차차 갬', lines: ['작은 우산을 챙겨요. 비가 와도 곧 갤 거예요.', '비 온 뒤엔 하늘이 더 맑아져요.', '쉬어 가도 괜찮은 한 주예요. 몽글이가 응원할게요.'] },
  { min: -Infinity, w: 'rain', label: '비 그친 뒤 갬', lines: ['먹구름 뒤엔 늘 해가 있어요. 쉬어 가도 괜찮아요.', '많이 지쳤죠? 다음 주엔 꼭 갤 거예요.', '천둥이 지나가면 공기가 맑아져요. 힘내요.'] },
];
/** 받침에 따라 조사 고르기 (예: 맑음과 / 비와) */
export function josa(word, withJong, without) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return without;
  return (c - 0xac00) % 28 ? withJong : without;
}

export function summarize(days, { isCurrent = false } = {}) {
  const rec = days.filter((d) => d.entry);
  const n = rec.length;
  const out = { recorded: n, headline: '', detail: '', index: null, best: null, top: null, next: null, trend: null };

  if (n === 0) {
    out.headline = isCurrent ? '아직 관측 전' : '관측 기록 없음';
    out.detail = isCurrent ? '이번 주 첫 날씨를 남기면 예보가 시작돼요.' : '이 주에는 남긴 날씨가 없어요.';
    out.nextText = '기록이 쌓이면 다음 주 예보를 알려 드릴게요.';
    return out;
  }

  const counts = {};
  rec.forEach((d) => (counts[d.entry.w] = (counts[d.entry.w] || 0) + 1));
  // 가장 많은 날씨 (같으면 더 늦게 나온 쪽)
  let top = null;
  rec.forEach((d) => {
    const w = d.entry.w;
    if (!top || counts[w] >= counts[top]) top = w;
  });
  out.top = top;
  const distinct = Object.keys(counts).length;
  const ratio = counts[top] / n;
  const second = Object.keys(counts).filter((w) => w !== top).sort((a, b) => counts[b] - counts[a])[0];

  const tie = second && counts[second] === counts[top];
  // 셋 이상이 같은 횟수로 가장 많으면(예: 맑음·구름·비 2번씩) 둘만 골라 말하지 않는다
  const tiedTop = Object.keys(counts).filter((w) => counts[w] === counts[top]).sort((a, b) => rec.findIndex((d) => d.entry.w === a) - rec.findIndex((d) => d.entry.w === b));
  const manyTie = tiedTop.length >= 3 && counts[top] >= 2;
  // 같은 횟수면 이번 주에 먼저 나온 날씨부터 말한다
  const firstSeen = (w) => rec.findIndex((d) => d.entry.w === w);
  const [ta, tb] = tie ? [top, second].sort((a, b) => firstSeen(a) - firstSeen(b)) : [top, second];
  if (n === 1) out.headline = W[top].name;
  else if (distinct === 1) out.headline = ALL_SAME[top];
  else if (ratio > 0.5) out.headline = MOSTLY[top];
  else if (distinct === 2 && tie) out.headline = `반은 ${W[ta].name}, 반은 ${W[tb].name}`;
  else if (manyTie) out.headline = '변덕스러운 날씨';
  else if (tie && counts[top] >= 2) out.headline = `${W[ta].name}·${W[tb].name} 번갈아`;
  else if (distinct >= 4 || (tie && counts[top] === 1)) out.headline = '변덕스러운 날씨';
  else out.headline = `${W[top].name}, 때때로 ${W[second].name}`;

  // 흐름: 주 초반(월~수) vs 주 후반(금~일)
  const avgOf = (arr) => (arr.length ? arr.reduce((s, d) => s + W[d.entry.w].score, 0) / arr.length : null);
  const earlyDays = days.slice(0, 3).filter((d) => d.entry);
  const lateDays = days.slice(4).filter((d) => d.entry);
  const early = avgOf(earlyDays);
  const late = avgOf(lateDays);
  if (early != null && late != null) {
    if (late - early >= 1.2) out.trend = 'up';
    else if (early - late >= 1.2) out.trend = 'down';
    else out.trend = 'flat';
  }
  // 뚜렷하게 좋아지거나 나빠졌으면 그 흐름이 제목
  if (n >= 4 && ratio <= 0.5 && out.trend === 'up') out.headline = '흐린 뒤 갬';
  if (n >= 4 && ratio <= 0.5 && out.trend === 'down') out.headline = '맑은 뒤 흐려짐';

  // 자세히
  const others = rec.filter((d) => d.entry.w !== top);
  const listed = n <= 3 ? rec : others;
  let detail;
  if (n === 1) {
    detail = `${dowName(rec[0].date)} ${PHRASE[top] === '한때 비' ? '비' : PHRASE[top]}. 기록이 쌓일수록 예보가 정확해져요.`;
  } else if (!others.length) {
    detail = SAME_LINE[top];
  } else if (n >= 4 && (out.trend === 'up' || out.trend === 'down')) {
    // 좋아졌으면 초반의 가장 흐린 날과 후반의 가장 맑은 날을, 나빠졌으면 그 반대를 말한다
    const pick = (arr, best) => arr.reduce((a, d) => (!a || (best ? W[d.entry.w].score > W[a].score : W[d.entry.w].score < W[a].score) ? d.entry.w : a), null);
    const up = out.trend === 'up';
    detail = `주 초반엔 ${BUT[pick(earlyDays, !up)]}, 주 후반엔 ${LATE[pick(lateDays, up)]}.`;
  } else if (manyTie && out.trend !== 'up' && out.trend !== 'down') {
    const names = tiedTop.map((w) => W[w].name);
    const last = names.pop();
    detail = `${names.join(', ')}, ${last}${josa(last, '이', '가')} 고루 찾아왔어요.`;
  } else if (tie && counts[top] >= 2 && out.trend !== 'up' && out.trend !== 'down') {
    detail = `${W[ta].name}${josa(W[ta].name, '과', '와')} ${W[tb].name}${josa(W[tb].name, '이', '가')} 번갈아 찾아왔어요.`;
  } else if (out.headline === '변덕스러운 날씨' && n >= 4) {
    detail = `${distinct}가지 날씨가 오간 다채로운 한 주였어요.`;
  } else {
    const items = listed.slice(0, 3).map((d) => `${dowName(d.date)} ${PHRASE[d.entry.w]}`);
    detail = items.join(', ') + (listed.length > 3 ? ' 등' : '') + '.';
  }
  out.detail = detail;

  const avg = avgOf(rec);
  out.index = Math.round(((avg - 1) / 4) * 100);

  // 가장 좋았던 날: 같은 점수가 여럿이면 함께 말하고, 모두 같은 날씨면 하루를 고르지 않는다
  const bestScore = Math.max(...rec.map((d) => W[d.entry.w].score));
  const tops = rec.filter((d) => W[d.entry.w].score === bestScore);
  if (distinct === 1 && n >= 2) out.best = { text: `모두 ${W[top].name}`, w: top };
  else if (tops.length === 1) out.best = { text: dowName(tops[0].date), key: tops[0].key, w: tops[0].entry.w };
  else out.best = { text: tops.slice(0, 2).map((d) => DOW[d.date.getDay()]).join('·') + (tops.length > 2 ? ' 외' : ''), w: tops[0].entry.w };
  out.best.dow = out.best.text;

  // 다음 주 예보는 관측이 3일 이상일 때만 (하루 이틀로 확률을 말하지 않는다)
  if (n < 3) {
    out.nextText = '관측이 3일 넘게 쌓이면 다음 주 예보를 알려 드릴게요.';
    return out;
  }

  // 다음 주 예보: 뒤쪽 날일수록 무게를 더 두고, 살짝 희망 쪽으로
  let ws = 0;
  let wsum = 0;
  days.forEach((d, i) => {
    if (!d.entry) return;
    ws += W[d.entry.w].score * (i + 1);
    wsum += i + 1;
  });
  const wavg = Math.min(5, ws / wsum + 0.3);
  const b = BUCKETS.find((x) => wavg >= x.min);
  // 맑음 확률은 칸과 맞물린다: 맑고 화창 80+ / 대체로 맑음 60~79 / 구름 많음 40~59 / 가끔 비 20~39 / 비 그친 뒤 5~19
  const prob = Math.max(5, Math.min(95, Math.floor(20 + (wavg - 1.8) * 25)));
  const line = b.lines[hash(days[0].key) % b.lines.length];
  out.next = { w: b.w, label: b.label, prob, line };
  out.nextText = `다음 주 ${b.label} · 맑음 확률 ${prob}%`;
  return out;
}
