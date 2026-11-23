// 날씨 = 기분. 순서는 고르기 버튼 순서.
export const WEATHERS = [
  { id: 'sunny', name: '맑음', mood: '좋아요', score: 4, ph: '어떤 일이 좋았나요?' },
  { id: 'rainbow', name: '무지개', mood: '최고예요', score: 5, ph: '최고의 순간을 적어요' },
  { id: 'cloudy', name: '구름', mood: '그저 그래요', score: 3, ph: '오늘을 한 줄로 남겨요' },
  { id: 'snow', name: '눈', mood: '차분해요', score: 3.5, ph: '고요했던 순간을 적어요' },
  { id: 'rain', name: '비', mood: '울적해요', score: 2, ph: '마음을 여기 내려놓아요' },
  { id: 'thunder', name: '천둥', mood: '화나요', score: 1, ph: '무엇이 화나게 했나요?' },
];
export const WEATHER_IDS = WEATHERS.map((w) => w.id);
export const W = Object.fromEntries(WEATHERS.map((w) => [w.id, w]));
const GOOD = new Set(['sunny', 'rainbow']);
const BAD = new Set(['rain', 'thunder']);
/** 날씨의 결 — 몽글이 말투를 고를 때: good(맑음·무지개) · mid(구름·눈) · bad(비·천둥) */
export const toneOf = (w) => (GOOD.has(w) ? 'good' : BAD.has(w) ? 'bad' : 'mid');

// 마음 단어: 날씨마다 5개, 하루에 최대 3개. 같은 말은 날씨가 달라도 같은 id를 쓴다(돌아보기에서 함께 센다).
export const FEEL_MAX = 3;
export const FEEL_LABEL = {
  joy: '기뻐요', proud: '뿌듯해요', flutter: '설레요', comfy: '편안해요', thankful: '고마워요',
  happy: '행복해요', thrilled: '신나요', moved: '감동이에요', achieved: '해냈어요', loved: '사랑받았어요',
  tired: '피곤해요', bored: '심심해요', lazy: '귀찮아요', blank: '멍해요', meh: '무기력해요',
  peaceful: '평온해요', drowsy: '나른해요', missing: '그리워요', pensive: '생각이 많아요',
  sad: '슬퍼요', lonely: '외로워요', hurt: '서운해요', anxious: '불안해요', exhausted: '지쳤어요',
  angry: '화나요', annoyed: '짜증나요', unfair: '억울해요', stuffy: '답답해요', stressed: '스트레스받아요',
};
export const FEELINGS = {
  sunny: ['joy', 'proud', 'flutter', 'comfy', 'thankful'],
  rainbow: ['happy', 'thrilled', 'moved', 'achieved', 'loved'],
  cloudy: ['tired', 'bored', 'lazy', 'blank', 'meh'],
  snow: ['peaceful', 'flutter', 'drowsy', 'missing', 'pensive'],
  rain: ['sad', 'lonely', 'hurt', 'anxious', 'exhausted'],
  thunder: ['angry', 'annoyed', 'unfair', 'stuffy', 'stressed'],
};
/** 마음 단어의 지난 일 꼴: '슬펐'군요 · '피곤했'던 날 · '화가 났'다고 했죠 */
const FEEL_PAST = {
  joy: '기뻤', proud: '뿌듯했', flutter: '설렜', comfy: '편안했', thankful: '고마웠',
  happy: '행복했', thrilled: '신났', moved: '감동이었', achieved: '해냈', loved: '사랑받았',
  tired: '피곤했', bored: '심심했', lazy: '귀찮았', blank: '멍했', meh: '무기력했',
  peaceful: '평온했', drowsy: '나른했', missing: '그리웠', pensive: '생각이 많았',
  sad: '슬펐', lonely: '외로웠', hurt: '서운했', anxious: '불안했', exhausted: '지쳤',
  angry: '화가 났', annoyed: '짜증이 났', unfair: '억울했', stuffy: '답답했', stressed: '스트레스를 받았',
};
/** 마음 단어의 결: pos(좋은 마음) · tired(지친) · low(기운 없는) · hurt(아픈) · angry(화난) */
const FEEL_KIND = {
  joy: 'pos', proud: 'pos', flutter: 'pos', comfy: 'pos', thankful: 'pos', happy: 'pos', thrilled: 'pos', moved: 'pos', achieved: 'pos', loved: 'pos', peaceful: 'pos',
  tired: 'tired', drowsy: 'tired', exhausted: 'tired',
  bored: 'low', lazy: 'low', blank: 'low', meh: 'low',
  missing: 'hurt', pensive: 'hurt', sad: 'hurt', lonely: 'hurt', hurt: 'hurt', anxious: 'hurt',
  angry: 'angry', annoyed: 'angry', unfair: 'angry', stuffy: 'angry', stressed: 'angry',
};
export const feelKind = (id) => FEEL_KIND[id] || 'low';
const KIND_TONE = { pos: 'good', tired: 'mid', low: 'mid', hurt: 'bad', angry: 'bad' };

/** 아는 마음 단어만 남기고(순서 유지·중복 제거) 최대 3개. 날씨와 마음은 다를 수 있으니 날씨를 바꿔도 지우지 않는다. */
export function cleanFeel(w, f) {
  if (!Array.isArray(f)) return [];
  const out = [];
  for (const id of f) if (FEEL_LABEL[id] && !out.includes(id)) out.push(id);
  return out.slice(0, FEEL_MAX);
}
/** 모든 마음 단어 id (날씨별 묶음 순서대로, 겹치는 것은 한 번) */
export const ALL_FEELINGS = [...new Set(Object.values(FEELINGS).flat())];

const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const pickBy = (arr, seed) => arr[hash(seed) % arr.length];
const short = (s, n) => (Array.from(s).length > n ? `${Array.from(s).slice(0, n).join('')}…` : s);
// 사용자가 쓴 글을 대사에 넣을 때: '|'는 대사를 두 마디로 나누는 표시라 비슷한 글자로 바꾼다
const safe = (s) => String(s).replace(/\|/g, '｜');

// ================================================================ 대사의 짜임
// 대사는 '짧은 말|덧붙이는 말' 두 마디다. 보통은 이어서 보여 주고, '차분하게'에서는 앞마디만 보여 준다(main.js say()).
// 덧붙이는 말은 지금 상황(늦은 밤·불금·월요일·주말·아침·밤·계절)에 맞는 말로 바뀔 수 있다.
const TAILS = {
  lateNight: { good: '늦었어요. 좋은 기분 안고 푹 자요', mid: '늦었어요. 이제 푹 자요', bad: '늦은 밤까지 고생했어요. 이제 자요' },
  fridayEve: { good: '기분 좋은 불금이에요!', mid: '이번 주도 정말 수고 많았어요', bad: '힘든 한 주였죠. 주말엔 꼭 쉬어요' },
  monday: { good: '월요일부터 좋은 출발이에요', mid: '월요일은 원래 천천히 시동이 걸려요', bad: '월요일이라 더 힘들었을 거예요' },
  weekend: { good: '주말을 마음껏 즐겨요', mid: '주말엔 느긋해도 괜찮아요', bad: '주말엔 푹 쉬면서 마음을 돌봐요' },
  night: { good: '오늘 밤은 좋은 꿈 꿀 것 같아요', mid: '오늘 밤은 포근하게 쉬어요', bad: '오늘 밤은 일찍 푹 자요' },
  morning: { good: '오늘 하루도 이 기분 그대로 가요', mid: '오늘 하루는 천천히 가요', bad: '오늘은 무리하지 말고 천천히 가요' },
  winter: { good: '추운 날에도 마음은 따뜻하네요', mid: '날이 추워요. 따뜻하게 입어요', bad: '추운 날엔 마음도 더 시리죠' },
  summer: { good: '더위도 이긴 좋은 기분이에요', mid: '더운 날엔 물 많이 마셔요', bad: '더위에 더 지쳤을 거예요' },
};
/** 지금 맞는 상황과, 그 말을 덧붙일 확률. ctx: { hour, dow(논리상 오늘의 요일), month, lateNight } */
function tailKinds(ctx) {
  const now = new Date();
  const h = ctx.hour ?? now.getHours();
  const dow = ctx.dow ?? now.getDay();
  const mon = ctx.month ?? now.getMonth() + 1;
  const out = [];
  if (ctx.lateNight) out.push(['lateNight', 1]);
  if (dow === 5 && h >= 15) out.push(['fridayEve', 0.67]);
  if (dow === 1) out.push(['monday', 0.67]);
  if (dow === 0 || dow === 6) out.push(['weekend', 0.5]);
  if (h >= 21 && !ctx.lateNight) out.push(['night', 0.5]);
  if (h >= 5 && h < 11) out.push(['morning', 0.5]);
  if (mon === 12 || mon <= 2) out.push(['winter', 0.25]);
  if (mon >= 6 && mon <= 8) out.push(['summer', 0.25]);
  return out;
}
/** '짧은 말|덧붙이는 말'의 뒷마디를 상황에 맞는 말로 바꿀 수도 있다. seed가 같으면 결과도 같다(같은 날 같은 말). */
export function withTail(line, tone, ctx = {}, seed = '') {
  const i = line.indexOf('|');
  if (i < 0) return line;
  for (const [k, p] of tailKinds(ctx || {})) {
    if ((hash(`${seed}|${k}`) % 100) / 100 < p) return `${line.slice(0, i)}|${TAILS[k][tone] || TAILS[k].mid}`;
  }
  return line;
}

// ================================================================ 마음 단어를 골랐을 때
const FEEL_LINES = {
  joy: ['기쁜 일이 있었군요!|무슨 일이었는지 한 줄 남겨 두면 두고두고 웃을 수 있어요', '기쁜 마음이 여기까지 전해져요.|오늘 이 기분, 제가 오래 기억해 둘게요'],
  proud: ['정말 잘했어요!|오늘은 스스로를 마음껏 칭찬해 줘요', '뿌듯한 하루였군요.|그 마음 잊지 않게 제가 꼭 간직할게요'],
  flutter: ['설레는 일이 있었군요!|두근두근한 마음, 저한테도 살짝 알려 줄래요?', '설렘은 좋은 일이 온다는 신호래요.|오늘 그 마음을 한 줄로 남겨 봐요'],
  comfy: ['편안한 하루였다니 좋아요.|이런 날이 자주 찾아오면 좋겠어요', '마음이 편안하면 저도 둥실둥실해요.|오늘은 이 느긋함을 즐겨요'],
  thankful: ['고마운 마음이 드는 날이네요.|그 마음을 전하면 상대도 분명 기뻐할 거예요', '고마움을 아는 마음, 참 예뻐요.|오늘을 따뜻하게 기억해 둘게요'],
  happy: ['행복하다니 저까지 덩달아 행복해요!|오늘 같은 날이 자주 오면 좋겠어요', '행복한 하루였군요.|이 기분을 오래 꺼내 볼 수 있게 한 줄 남겨요'],
  thrilled: ['신나는 일이 있었군요!|저도 같이 폴짝폴짝 뛰고 싶어요', '오늘 정말 신났죠?|그 기분 그대로 내일도 이어지길 바라요'],
  moved: ['마음이 뭉클했던 날이네요.|오래오래 기억할 순간이에요', '감동받은 하루였군요.|그 순간을 한 줄로 남겨 두면 좋겠어요'],
  achieved: ['해냈군요! 정말 멋져요.|그동안 애쓴 자신에게 오늘은 크게 박수 쳐 줘요', '와, 해냈다니 저까지 신나요!|오늘의 뿌듯함, 오래오래 기억해요'],
  loved: ['사랑받는 날이었군요.|그 따뜻함이 마음에 오래 남길 바라요', '누군가의 사랑을 느낀 하루네요.|그 마음, 저도 같이 간직할게요'],
  tired: ['오늘 많이 피곤했죠?|따뜻한 물 한 잔 마시고 일찍 쉬어요', '피곤한 날엔 아무것도 안 해도 괜찮아요.|푹 자고 내일 다시 만나요'],
  bored: ['심심한 날도 있죠.|좋아하는 노래 한 곡 들어 보는 건 어때요?', '가끔은 심심한 것도 쉼이에요.|오늘은 느긋하게 보내요'],
  lazy: ['귀찮은 날도 있는 거예요.|오늘은 꼭 해야 할 것 하나만 해요', '다 귀찮을 땐 쉬어 가라는 신호래요.|오늘은 무리하지 마요'],
  blank: ['멍때리는 것도 마음의 쉼이에요.|오늘은 천천히 숨 쉬어 봐요', '머리가 멍한 날이었군요.|잠깐 창밖 하늘을 올려다봐요'],
  meh: ['힘이 안 나는 날도 있어요.|작은 것 하나만 해도 충분히 잘한 거예요', '기운이 없는 하루였군요.|오늘은 스스로에게 조금 더 다정해져요'],
  peaceful: ['평온한 마음, 참 좋아요.|이 고요함이 오래 머물길 바라요', '마음이 잔잔한 날이네요.|오늘은 포근하게 쉬어 가요'],
  drowsy: ['나른한 하루였군요.|따뜻한 이불 속에서 푹 쉬어요', '나른할 땐 잠깐 눈을 감아도 좋아요.|오늘도 수고했어요'],
  missing: ['누군가 그리운 날이군요.|그리운 마음도 소중한 마음이에요', '그리움이 찾아온 하루네요.|그 사람에게 안부 한마디 건네 보는 건 어때요?'],
  pensive: ['생각이 많은 날이었군요.|머릿속 생각을 한 줄로 적어 보면 조금 가벼워져요', '고민이 많았죠?|천천히 하나씩 정리해도 괜찮아요'],
  sad: ['많이 속상했죠? 토닥토닥.|울고 싶으면 울어도 괜찮아요', '슬픈 마음, 여기 내려놓고 가요.|제가 곁에 있을게요'],
  lonely: ['외로운 날이었군요.|제가 옆에 있을게요. 혼자가 아니에요', '외로울 땐 좋아하는 사람에게 연락해 봐요.|저도 늘 여기 있어요'],
  hurt: ['서운할 만했어요.|그 마음을 적어 두면 조금은 풀릴 거예요', '마음이 서운했군요.|오늘은 스스로를 먼저 챙겨요'],
  anxious: ['괜찮아요, 천천히 숨 쉬어 봐요.|들이마시고, 내쉬고. 제가 같이 있을게요', '불안한 마음이 들었군요.|지금 할 수 있는 작은 것부터 해 봐요'],
  exhausted: ['오늘 정말 많이 지쳤죠?|아무 생각 말고 푹 쉬어요. 잘 버텼어요', '지친 마음, 여기 내려놓아요.|내일은 조금 더 가벼워질 거예요'],
  angry: ['화날 만했어요.|크게 숨 한번 쉬고, 화난 이유를 적어 봐요', '으르렁! 화난 마음 이해해요.|오늘은 마음을 지키는 게 먼저예요'],
  annoyed: ['짜증 날 만했어요.|잠깐 걷거나 물 한 잔 마셔 봐요', '짜증 나는 일이 있었군요.|여기 다 털어놓고 가요'],
  unfair: ['억울했겠어요.|그 마음을 여기 적어 두면 제가 다 들어 줄게요', '억울한 일이 있었군요.|너무 자책하지 말아요. 잘못한 게 아니에요'],
  stuffy: ['마음이 답답했군요.|창문 열고 크게 숨 한번 쉬어 봐요', '답답한 마음, 여기 내려놔요.|조금씩 풀릴 거예요'],
  stressed: ['스트레스가 많았던 하루네요.|오늘은 좋아하는 걸 하나 해 봐요', '많이 버거웠죠?|잠깐 쉬어 가도 괜찮아요. 충분히 잘하고 있어요'],
};
const FEEL_FALLBACK = ['마음을 알려 줘서 고마워요.|오늘의 마음, 제가 잘 간직할게요'];
const GOOD_SKY = { sunny: '맑은 날인데', rainbow: '무지개 뜬 날인데' };
const BAD_SKY = { rain: '비 오는 날에도', thunder: '천둥 치는 날에도' };
const REPEAT_TAIL = {
  pos: '요즘 좋은 일이 많나 봐요',
  tired: '요즘 많이 지쳤나 봐요. 푹 쉬어요',
  low: '요즘 기운이 없나 봐요. 천천히 가요',
  hurt: '요즘 마음이 무거운가 봐요. 제가 곁에 있을게요',
  angry: '요즘 마음 쓸 일이 많았나 봐요',
};
/**
 * 마음 단어를 골랐을 때의 답. w: 오늘 날씨, ctx: 상황(main.js lineCtx — weekFeel: 지난 7일 마음 단어 수), exclude: 최근에 한 말.
 * 날씨와 마음이 엇갈리거나 일주일 새 같은 마음이 또 나오면 그 이야기를 먼저 하고,
 * 아니면 단어마다 두 가지 중 하나에 상황에 맞는 말을 덧붙인다.
 */
export function feelReply(id, { w = '', ctx = {}, exclude = [] } = {}) {
  const kind = feelKind(id);
  const P = FEEL_PAST[id];
  const first = [];
  if (P && GOOD_SKY[w] && (kind === 'hurt' || kind === 'angry' || id === 'exhausted')) {
    first.push(`${GOOD_SKY[w]} 마음 한쪽은 ${P}군요.|그런 마음도 괜찮아요. 제가 들어 줄게요`);
  }
  if (P && BAD_SKY[w] && kind === 'pos') first.push(`${BAD_SKY[w]} ${P}던 순간이 있었군요.|그 순간을 꼭 붙잡아 둬요`);
  const n = (ctx && ctx.weekFeel && ctx.weekFeel[id]) || 0;
  if (P && n >= 1) first.push(`일주일 새 ${n + 1}번째 ${P}던 날이에요${kind === 'pos' ? '!' : '.'}|${REPEAT_TAIL[kind]}`);
  const hit = first.find((s) => !exclude.includes(s));
  if (hit) return hit;
  const own = (FEEL_LINES[id] || FEEL_FALLBACK).map((s) => withTail(s, KIND_TONE[kind], ctx, `${(ctx && ctx.key) || ''}|${id}|${s}`));
  const pool = own.filter((s) => !exclude.includes(s));
  const list = pool.length ? pool : own;
  return list[Math.floor(Math.random() * list.length)];
}

// ================================================================ 날씨를 고른 순간
// 어제와 견주는 말
const PAST = { sunny: '맑았', rainbow: '무지개가 떴', cloudy: '흐렸', snow: '눈이 왔', rain: '비가 왔', thunder: '천둥이 쳤' };
const NOW = { sunny: '맑네요', rainbow: '무지개가 떴네요', cloudy: '흐리네요', snow: '눈이 오네요', rain: '비가 오네요', thunder: '천둥이 치네요' };
const RUN_BAD = { rain: '비가 와요', thunder: '천둥이 쳐요', cloudy: '흐려요' };
const RUN_GOOD = { sunny: '맑아요', rainbow: '무지개가 떠요', snow: '고요해요' };

// 평소의 말 (날짜마다 하나로 고정해 매일 조금씩 다르게). 앞마디는 예전 짧은 대사 그대로라 '차분하게'에서는 달라지지 않는다.
const PICKED = {
  sunny: ['햇살 가득! 오늘 기분 좋아 보여요.|무슨 좋은 일 있었는지 들려줄래요?', '맑은 마음, 저까지 반짝여요.|오늘 웃었던 순간을 한 줄로 남겨 봐요', '좋은 하루였군요! 오래 기억해요.|이런 날이 자주 오면 좋겠어요', '오늘 웃은 일, 메모로 남겨 볼까요?|나중에 꺼내 보면 또 웃게 될 거예요', '맑은 날엔 저도 둥실둥실해요.|오늘 좋았던 일 하나만 들려줘요', '이 기분 그대로 내일도 만나요.|오늘 하루 정말 잘 보냈어요'],
  rainbow: ['우와, 최고의 하루예요! 축하해요.|어떤 일이 있었는지 꼭 남겨 줘요', '무지개 뜬 날! 저도 신나요.|오늘 정말 좋은 일이 있었나 봐요', '오늘 같은 날을 위해 사는 거죠!|오늘의 기쁨을 마음껏 누려요', '최고의 순간, 꼭 메모로 남겨요.|두고두고 꺼내 볼 보물이 될 거예요', '오늘은 우주 최고 날씨예요!|이 기분 오래오래 간직해요', '이런 날은 오래오래 기억할게요.|무엇이 오늘을 최고로 만들었어요?'],
  cloudy: ['그저 그런 날도 괜찮아요. 천천히 가요.|오늘도 잘 지나왔어요', '흐린 날도 소중한 하루예요.|별일 없는 하루도 잘 보낸 거예요', '오늘은 쉬어 가도 돼요.|따뜻한 차 한 잔 어때요?', '구름 뒤엔 언제나 하늘이 있어요.|내일은 조금 더 맑을 거예요', '무난한 하루도 잘 보낸 거예요.|오늘 있었던 일 하나만 적어 볼까요?', '멍하니 있어도 괜찮은 날이에요.|오늘은 스스로를 너무 다그치지 마요'],
  snow: ['차분한 하루네요. 포근하게 쉬어요.|오늘 하루도 수고 많았어요', '고요한 마음도 멋진 날씨예요.|조용히 쌓인 생각을 한 줄로 남겨 봐요', '조용히 쌓이는 하루였군요.|오늘은 스스로에게 따뜻한 시간을 줘요', '따뜻한 차 한 잔 어때요?|차분한 마음이 오래 머물면 좋겠어요', '눈 오는 날처럼 포근하게 쉬어요.|이불 속에서 좋아하는 걸 해도 좋아요', '생각이 많은 날도 괜찮아요.|천천히 정리해도 돼요'],
  rain: ['울적한 날엔 제가 곁에 있을게요.|무슨 일이 있었는지 여기 털어놓아도 돼요', '많이 힘들었죠? 토닥토닥.|오늘은 따뜻한 데서 푹 쉬어요', '비는 꼭 그쳐요. 오늘도 수고했어요.|오늘은 일찍 푹 쉬어요', '울고 싶으면 울어도 괜찮아요.|제가 곁에서 기다릴게요', '오늘은 나를 꼭 안아 줘요.|힘든 마음, 여기 내려놓고 가요', '마음을 여기 내려놓고 가요.|내일은 조금 더 가벼워질 거예요'],
  thunder: ['화날 만했어요. 크게 숨 한번 쉬어요.|무엇이 화나게 했는지 적어 봐도 좋아요', '으르렁! 제가 같이 화내 줄게요.|그래도 오늘을 잘 버텨 냈어요', '천둥 뒤엔 공기가 맑아져요.|오늘의 화는 여기 두고 가요', '오늘 참느라 고생 많았어요.|이제 스스로를 챙길 시간이에요', '화난 마음, 여기 쏟아 놓아요.|제가 다 들어 줄게요', '내일은 분명 갤 거예요.|오늘은 일찍 쉬어요'],
};
// 밤에는 '햇살' 대신
const PICKED_NIGHT = {
  sunny: ['맑은 밤이에요. 별처럼 반짝인 하루였군요.|좋은 꿈 꿔요', '좋은 하루를 보냈군요. 푹 자요.|내일도 맑은 마음으로 만나요', '오늘 좋았던 일, 꿈에서도 만나요.|오늘 하루 정말 잘 보냈어요'],
  rainbow: ['밤하늘에도 무지개가 떴네요! 최고의 하루.|이 기분 그대로 포근하게 자요', '최고의 하루였군요. 행복한 꿈 꿔요.|내일도 오늘처럼 반짝이길 바라요'],
};
// 특별한 날에 고르면
const SPECIAL_PICK = {
  birthday: { good: '생일에 이렇게 좋은 마음이라니, 최고의 선물이에요!|생일 정말 축하해요', mid: '생일 축하해요! 오늘 마음은 조금 흐렸군요.|그래도 오늘은 태어나 줘서 고마운 날이에요', bad: '생일인데 마음이 무거웠군요.|그래도 태어나 줘서 정말 고마워요' },
  newyear: { good: '새해 첫 마음이 맑아요!|올해도 이런 날이 가득하길 바라요', mid: '새해 첫날, 차분하게 시작하네요.|올해도 제가 곁에서 함께할게요', bad: '새해 첫날부터 마음이 무거웠군요.|괜찮아요. 한 해는 기니까 천천히 가요' },
  xmaseve: { good: '크리스마스이브에 설레는 마음이네요!|따뜻하고 반짝이는 밤 보내요', mid: '크리스마스이브예요. 포근하게 보내요.|내일은 더 따뜻한 하루가 되길 바라요', bad: '크리스마스이브인데 마음이 무거웠군요.|오늘은 스스로에게 작은 선물을 줘요' },
  xmas: { good: '메리 크리스마스! 반짝이는 마음이네요.|따뜻하고 행복한 하루 보내요', mid: '메리 크리스마스! 오늘은 포근하게 쉬어요.|제가 작은 눈송이를 선물할게요', bad: '크리스마스인데 마음이 무거웠군요.|따뜻한 데서 푹 쉬어요. 제가 곁에 있을게요' },
  yearend: { good: '올해 마지막 날이 맑네요!|한 해 동안 정말 수고 많았어요', mid: '올해 마지막 날이에요. 차분하게 마무리해요.|한 해 동안 정말 수고 많았어요', bad: '올해 마지막 날, 마음이 흐렸군요.|한 해 동안 정말 애썼어요' },
};
const COMEBACK = { good: '맑은 마음으로 와 줘서 더 반가워요', mid: '그동안 어떻게 지냈어요?', bad: '힘든 날 찾아와 줘서 고마워요' };

/**
 * 고른 순간의 말. ctx(main.js lineCtx): { key(날짜), night, prev(어제 기록), runBefore(어제까지 같은 날씨가 이어진 날 수),
 *   gap(마지막 기록이 며칠 전인지, 처음이면 0), week({good,mid,bad}: 어제까지 7일), special, hour, dow, month, lateNight }
 * 특별한 날 > 오랜만 > 어제와 크게 달라짐 > 같은 날씨가 이어짐 > 요즘 흐름 > 어제보다 조금 나아짐 > 평소 말(+상황에 맞는 덧붙임)
 */
export function pickedLine(w, ctx = {}) {
  const { key = '', night = false, prev = null, runBefore = 0, gap = 0, week = null, special = null } = ctx;
  const tone = toneOf(w);
  const sp = special && SPECIAL_PICK[special];
  if (sp) return sp[tone];
  if (gap >= 3) return `${gap >= 14 ? '정말 오랜만이에요! 다시 와 줘서 반가워요.' : `${gap}일 만이에요! 다시 와 줘서 반가워요.`}|${COMEBACK[tone]}`;
  const pt = prev && prev.w && prev.w !== w ? toneOf(prev.w) : '';
  if (pt === 'bad' && tone === 'good') return `어제는 ${PAST[prev.w]}는데 오늘은 ${NOW[w]}! 다행이에요.|좋은 일이 있었나 봐요`;
  if (pt === 'good' && tone === 'bad') return `어제는 ${PAST[prev.w]}는데… 오늘은 힘들었군요. 토닥토닥.|여기 다 털어놓아도 돼요`;
  const run = prev && prev.w === w ? runBefore + 1 : 1;
  if (run >= 3 && RUN_BAD[w]) return `벌써 ${run}일째 ${RUN_BAD[w]}. 많이 지쳤죠?|제가 곁에 있을게요. 오늘은 꼭 푹 쉬어요`;
  if (run >= 3 && RUN_GOOD[w]) return `${run}일째 ${RUN_GOOD[w]}! 좋은 흐름이에요.|이 기분 그대로 쭉 이어 가요`;
  if (week && tone === 'good' && week.bad >= 3) return `요즘 힘든 날이 많았는데 오늘은 ${NOW[w]}!|조금씩 개고 있어요`;
  if (week && tone === 'bad' && week.good >= 4) return `요즘 맑은 날이 많았는데 오늘은 ${NOW[w]}.|그런 날도 있어요. 금방 갤 거예요`;
  if (pt && hash(`${key}|${w}|soft`) % 2 === 0) {
    if (pt === 'mid' && tone === 'good') return `어제는 ${PAST[prev.w]}는데 오늘은 ${NOW[w]}!|좋은 일이 있었나 봐요`;
    if (pt === 'bad' && tone === 'mid') return '어제보다 마음이 조금 개었네요.|천천히 나아지고 있어요. 잘하고 있어요';
  }
  const pool = night && PICKED_NIGHT[w] ? PICKED_NIGHT[w] : PICKED[w] || PICKED.cloudy;
  return withTail(pickBy(pool, key), tone, ctx, `${key}|${w}`);
}

// ================================================================ 오늘 기록이 있는 날 다시 열었을 때
const AGAIN = {
  sunny: ['오늘의 반짝임, 잘 기억하고 있어요.|남은 하루도 맑기를 바라요', '맑은 마음이 오래 머물면 좋겠어요.|좋았던 일이 또 생각나면 적어 줘요', '좋은 하루, 끝까지 좋기를!|저도 옆에서 응원할게요'],
  rainbow: ['오늘 같은 날을 위해 사는 거죠!|다시 봐도 기분 좋아요', '무지개 뜬 날은 오래오래 기억할게요.|오늘의 기쁨, 마음껏 누려요', '최고의 하루, 다시 봐도 좋아요.|이 기분 오래 간직해요'],
  cloudy: ['구름 뒤엔 언제나 하늘이 있어요.|남은 하루는 느긋하게 보내요', '평범한 하루도 소중한 날씨예요.|오늘도 잘 지나왔어요', '오늘은 느긋하게 가요.|천천히 해도 괜찮아요'],
  snow: ['조용한 마음도 멋진 날씨예요.|포근한 시간 보내요', '포근하게 쉬어 가는 하루였죠.|오늘 하루도 고마워요', '고요한 밤 보내요.|내일 또 만나요'],
  rain: ['비는 곧 그쳐요. 오늘도 수고했어요.|제가 여기 있을게요', '울적한 마음, 여기 잠시 내려놓아요.|조금은 가벼워졌길 바라요', '오늘은 나에게 다정하게 대해 줘요.|따뜻하게 쉬어요'],
  thunder: ['번개가 지나가면 공기가 맑아져요.|오늘의 화는 여기 두고 가요', '내일은 갤 거예요. 푹 쉬어요.|오늘 정말 잘 버텼어요', '화난 마음, 조금은 풀렸어요?|아직이라면 천천히 해도 괜찮아요'],
};
const RECALL_MEMO = { good: '다시 봐도 좋은 하루예요', mid: '오늘도 잘 지나가고 있어요', bad: '지금은 좀 괜찮아요?' };
const RECALL_FEEL = { pos: '그 기분 아직 남아 있어요?', tired: '조금은 쉬었어요?', low: '지금은 기운이 좀 났어요?', hurt: '지금은 좀 괜찮아졌어요?', angry: '화는 조금 풀렸어요?' };
/**
 * ctx: { key, memo(오늘 메모), feel(오늘 마음 단어), hour, ... } — 아까 남긴 메모나 마음을 기억해 묻거나, 날씨에 맞는 말.
 * 같은 날·같은 시간대(3시간)에는 같은 말. (예전처럼 againLine(id, dateKey)로 불러도 된다)
 */
export function againLine(id, ctx = {}) {
  if (typeof ctx === 'string') ctx = { key: ctx };
  const { key = '', memo = '', feel = [], hour = 0 } = ctx;
  const pool = AGAIN[id];
  if (!pool) return INIT_LINE;
  const tone = toneOf(id);
  const opts = [withTail(pickBy(pool, key), tone, ctx, `${key}|again`)];
  if (memo) opts.push(`아까 남긴 '${safe(short(memo, 10))}', 잘 간직하고 있어요.|${RECALL_MEMO[tone]}`);
  const f0 = (feel || []).find((f) => FEEL_PAST[f]);
  if (f0) opts.push(`아까 ${FEEL_PAST[f0]}다고 했죠?|${RECALL_FEEL[feelKind(f0)]}`);
  return pickBy(opts, `${key}|${Math.floor(hour / 3)}`);
}

export const INIT_LINE = '오늘 마음에 맞는 날씨를 골라 줄래요?';
export const INIT_PH = '오늘을 한 줄로 남겨요';

/** 특별한 날. birthday는 'M-D' (설정에서 넣은 경우) */
export function specialDay(d = new Date(), birthday = '') {
  const md = `${d.getMonth() + 1}-${d.getDate()}`;
  if (birthday && md === birthday) return 'birthday';
  if (md === '1-1') return 'newyear';
  if (md === '12-24') return 'xmaseve';
  if (md === '12-25') return 'xmas';
  if (md === '12-31') return 'yearend';
  return null;
}

/**
 * 기록하기 전 첫인사: 특별한 날 > 늦은 밤 > 오랜만 > 어제 남긴 메모 기억 > 불금·월요일 > 어제 날씨 기억 > 주말·시간대
 * ctx: { birthday, yesterday: { w, m } | null, lateNight, gap(마지막 기록이 며칠 전인지), key }
 */
export function greetLine(d = new Date(), { birthday = '', yesterday = null, lateNight = false, gap = 0, key = '' } = {}) {
  const sp = specialDay(d, birthday);
  if (sp === 'birthday') return '생일 축하해요! 오늘 마음 날씨는 어때요?';
  if (sp === 'newyear') return '새해 첫 하늘이에요! 올해 첫 마음 날씨는요?';
  if (sp === 'xmaseve') return '크리스마스이브예요. 오늘 마음은 어떤 날씨예요?';
  if (sp === 'xmas') return '메리 크리스마스! 오늘 마음 날씨는요?';
  if (sp === 'yearend') return '올해 마지막 하늘이에요. 오늘 마음은요?';
  if (lateNight) return '늦은 밤이네요. 오늘 하루는 어땠어요?';
  if (gap >= 3) return gap >= 14 ? '정말 오랜만이에요! 많이 보고 싶었어요.|오늘 마음 날씨는 어때요?' : '오랜만이에요! 보고 싶었어요.|그동안 마음 날씨는 어땠어요?';
  if (yesterday && yesterday.m) {
    const m = safe(short(yesterday.m, 10));
    if (GOOD.has(yesterday.w)) return `어제는 '${m}'! 오늘은 어떤 하루예요?`;
    return `어제 남긴 '${m}', 오늘은 좀 괜찮아요?`;
  }
  const h = d.getHours();
  const dow = d.getDay();
  if (dow === 5 && h >= 15) return '불금이에요! 이번 주 마음은 어땠어요?';
  if (dow === 1 && h < 15) return '새로운 한 주예요. 오늘 마음은 어떤가요?';
  if (yesterday && PAST[yesterday.w] && toneOf(yesterday.w) !== 'mid' && hash(`${key}|y`) % 2 === 0) {
    return toneOf(yesterday.w) === 'good' ? `어제는 ${PAST[yesterday.w]}죠! 오늘은 어떤 하루예요?` : `어제는 ${PAST[yesterday.w]}죠. 오늘은 좀 괜찮아요?`;
  }
  if ((dow === 0 || dow === 6) && h >= 9) return '주말이에요. 오늘 마음 날씨를 남겨 볼까요?';
  if (h >= 5 && h < 11) return '좋은 아침이에요! 오늘 마음은 어떤 날씨예요?';
  if (h >= 21 || h < 5) return '오늘 하루 어땠어요? 날씨로 알려 줘요';
  return INIT_LINE;
}

// ================================================================ 몽글이를 누르면
// 최근에 한 말은 하지 않는다(앱을 다시 켜도 기억). 반쯤은 지금 상황(날씨·시각·요일·오늘 마음)에 맞는 말에서 고른다.
const TAP_ANY = ['간질간질! 히히|자꾸 누르면 웃음이 안 멈춰요', '저 폭신하죠?|힘들 땐 언제든 기대도 돼요', '오늘도 와 줘서 고마워요|덕분에 저도 힘이 나요', '물 한 잔 마셨어요?|몸이 촉촉해야 마음도 말랑해져요', '깊게 숨 한번 쉬어 봐요|들이마시고, 내쉬고. 잘했어요', '제가 여기 있을게요|언제든 와서 이야기해 줘요',
  '구름은 원래 말랑해요|마음도 가끔은 말랑하게 풀어 줘요', '어깨 한번 쭉 펴 볼까요?|목도 천천히 돌려 봐요', '오늘 하늘 한번 올려다봤어요?|잠깐 고개를 들면 기분이 달라져요', '잘하고 있어요, 정말로|제가 다 보고 있었어요', '저는 언제나 당신 편이에요|무슨 일이 있어도요', '방금 웃었죠? 다 봤어요|웃는 얼굴이 제일 예뻐요',
  '저 오늘 바람 타고 왔어요|보고 싶어서 둥실둥실 날아왔죠', '구름도 가끔은 쉬어 가요|오늘은 조금 쉬어도 괜찮아요', '오늘 제일 잘한 일은 뭐였어요?|작은 일이라도 좋아요', '좋아하는 노래 하나 틀어 볼까요?|저도 옆에서 같이 들을게요', '창밖 한번 봐요. 하늘이 예뻐요|오늘 하늘은 무슨 색이에요?',
  '천천히 가도 다 도착해요|조급해하지 않아도 괜찮아요', '오늘의 나에게 박수 짝짝|오늘도 정말 애썼어요', '저는 폭신폭신 응원 담당이에요|힘들 땐 저를 꾹 눌러요', '작은 일에도 웃을 수 있길|제가 옆에서 같이 웃을게요', '오늘도 여기까지 온 거, 대단해요|스스로를 많이 칭찬해 줘요'];
const TAP_TIME = {
  morning: ['좋은 아침! 물 한 잔부터 해요|오늘 하루도 술술 풀리길 바라요', '오늘 하루도 둥실둥실 시작해요|가벼운 마음으로 출발!'],
  evening: ['저녁은 맛있게 먹었어요?|든든하게 먹어야 마음도 든든해요', '오늘 하루 수고 많았어요|이제 천천히 쉬어요'],
  weekend: ['주말엔 늦잠도 좋아요|오늘은 푹 쉬는 날이에요', '오늘은 하고 싶은 거 하나만 해요|그거면 충분히 좋은 주말이에요'],
  monday: ['월요일은 천천히 시동 걸어요|처음부터 달리지 않아도 돼요', '한 주의 시작, 같이 힘내요|이번 주도 제가 응원할게요'],
  friday: ['불금이에요! 이번 주도 잘 버텼어요|오늘 저녁은 좋아하는 걸 먹어요', '금요일이다! 둥실둥실|주말까지 조금만 더 힘내요'],
};
const TAP = {
  initial: ['날씨 버튼을 눌러 봐요!|오늘 마음과 닮은 날씨를 하나 골라요', '오늘 마음, 궁금해요|어떤 날씨인지 알려 줄래요?', '저는 몽글이예요. 반가워요!|매일 마음 날씨를 같이 기억할게요'],
  sunny: ['햇살이 따뜻해요!|오늘 기분처럼 반짝반짝해요', '웃는 얼굴이 예뻐요|오늘 같은 날 자주 보고 싶어요', '오늘은 둥실둥실 날아갈 것 같아요|좋은 기분, 오래 가길!'],
  rainbow: ['오늘은 뭐든 할 수 있겠어요!|하고 싶던 일, 오늘 해 봐요', '무지개 끝까지 가 볼까요?|보물이 있을지도 몰라요', '반짝반짝, 신난다!|오늘은 마음껏 신나도 돼요'],
  cloudy: ['멍하니 있어도 괜찮아요|구름도 가끔은 그냥 떠 있어요', '구름이랑 같이 둥둥|오늘은 흘러가는 대로 가요', '느릿느릿 가도 돼요|오늘은 쉬엄쉬엄 가요'],
  snow: ['눈 오는 날엔 코코아죠|따뜻한 거 한 잔 어때요?', '포근하게 꼭 안아 줄게요|이리 와요, 폭신폭신', '사각사각, 고요해요|조용한 마음도 참 좋아요'],
  rain: ['우산은 제가 될게요|비 맞지 않게 꼭 붙어 있을게요', '울어도 괜찮아요|실컷 울고 나면 하늘도 개요', '빗소리 들으며 쉬어요|빗소리는 마음을 차분하게 해 줘요'],
  thunder: ['같이 으르렁! 해 줄게요|화난 마음, 혼자 참지 마요', '화날 땐 잠깐 걷기!|바깥 공기 한번 마셔 봐요', '쾅! 하고 털어 버려요|털고 나면 조금 시원해질 거예요'],
};
const TAP_NIGHT = ['이제 푹 자요. 내일 또 만나요|이불 꼭 덮고요', '오늘 하루도 고생 많았어요|따뜻하게 하고 푹 자요', '좋은 꿈 꿔요|꿈에서도 둥실둥실 만나요'];
// 오늘 고른 마음 단어에 맞춰
const TAP_FEEL = {
  pos: ['오늘 좋은 일 있었죠? 저도 다 알아요|생각만 해도 웃음이 나요'],
  tired: ['오늘 피곤했죠? 어깨 주물러 줄게요|조물조물, 조금 풀렸어요?'],
  low: ['기운 없을 땐 저랑 같이 둥실둥실 해요|천천히 해도 괜찮아요'],
  hurt: ['오늘 마음이 무거웠죠? 꼭 안아 줄게요|폭신폭신, 조금은 괜찮아졌어요?'],
  angry: ['아직 화가 남았어요? 같이 크게 숨 쉬어요|후, 조금 시원해졌어요?'],
};
/** exclude: 최근에 한 말(앱을 다시 켜도 기억한 것). ctx: { feel(오늘 마음 단어), streak(연속 기록 일수) } */
export function tapLine(w, d = new Date(), exclude = [], { feel = [], streak = 0 } = {}) {
  const h = d.getHours();
  const dow = d.getDay();
  const ctx = [
    ...(h >= 5 && h < 11 ? TAP_TIME.morning : []),
    ...(h >= 18 && h < 22 ? TAP_TIME.evening : []),
    ...(dow === 0 || dow === 6 ? TAP_TIME.weekend : []),
    ...(dow === 1 ? TAP_TIME.monday : []),
    ...(dow === 5 ? TAP_TIME.friday : []),
    ...(h >= 22 || h < 4 ? TAP_NIGHT : []),
  ];
  const mine = [...new Set((feel || []).map(feelKind))].flatMap((k) => TAP_FEEL[k] || []);
  if (streak >= 3) mine.push(`${streak}일째 만나고 있어요!|매일 와 줘서 정말 고마워요`);
  const near = [...(TAP[w || 'initial'] || []), ...ctx, ...mine];
  const all = [...near, ...TAP_ANY];
  const fresh = (arr) => arr.filter((s) => !exclude.includes(s));
  let pool = Math.random() < 0.5 ? fresh(near) : [];
  if (!pool.length) pool = fresh(all);
  if (!pool.length) pool = all;
  return pool[Math.floor(Math.random() * pool.length)];
}

// 매일 알림 문구 (요일·특별한 날)
export function remindText(d, { birthday = '' } = {}) {
  const sp = specialDay(d, birthday);
  if (sp === 'birthday') return '생일 축하해요! 오늘 마음은 어떤 날씨예요?';
  if (sp === 'newyear') return '새해 첫날! 올해 첫 마음 날씨를 남겨 볼까요?';
  if (sp === 'xmas') return '메리 크리스마스! 오늘 마음은 어떤 날씨였어요?';
  if (sp === 'yearend') return '올해 마지막 하늘이에요. 오늘 마음을 남겨요';
  const dow = d.getDay();
  if (dow === 5) return '불금이에요! 이번 주 마음 날씨, 몽글이에게 알려 줘요';
  if (dow === 0) return '주말 마무리! 오늘 하루는 어떤 날씨였어요?';
  if (dow === 1) return '월요일 수고했어요. 오늘 마음 날씨는요?';
  return pickBy(['오늘 마음 하늘은 어떤 날씨였어요?', '몽글이가 오늘 하루를 기다려요', '10초면 돼요. 오늘 기분을 날씨로 남겨요'], `${d.getMonth()}-${d.getDate()}`);
}

/** 받침에 따라 '로/으로' */
export function ro(s) {
  const c = s.charCodeAt(s.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return '로';
  const j = c % 28;
  return j === 0 || j === 8 ? '로' : '으로';
}
