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
// 마음 단어를 고르면 몽글이가 짧게 답한다
export const FEEL_REPLY = {
  joy: '기쁜 일이 있었군요!', proud: '정말 잘했어요!', flutter: '설레는 일이 있었군요!', comfy: '편안한 하루, 좋아요', thankful: '고마운 마음, 예뻐요',
  happy: '저도 덩달아 행복해요', thrilled: '저도 신나요!', moved: '오래 기억할 순간이에요', achieved: '해냈군요! 멋져요', loved: '사랑받는 날이었군요',
  tired: '오늘은 일찍 쉬어요', bored: '심심한 날도 괜찮아요', lazy: '귀찮은 날도 있죠', blank: '멍때리는 것도 쉼이에요', meh: '천천히 해도 괜찮아요',
  peaceful: '평온한 마음, 좋아요', drowsy: '포근하게 쉬어요', missing: '그리운 마음도 소중해요', pensive: '생각이 많을 땐 적어 봐요',
  sad: '토닥토닥, 많이 속상했죠', lonely: '제가 옆에 있을게요', hurt: '서운할 만했어요', anxious: '괜찮아요, 천천히 숨 쉬어요', exhausted: '오늘은 푹 쉬어요',
  angry: '화날 만했어요', annoyed: '짜증 날 만했어요', unfair: '억울했겠어요', stuffy: '답답한 마음, 여기 내려놔요', stressed: '잠깐 쉬어 가요',
};

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

// 어제와 견주는 말
const PAST = { sunny: '맑았', rainbow: '무지개가 떴', cloudy: '흐렸', snow: '눈이 왔', rain: '비가 왔', thunder: '천둥이 쳤' };
const NOW = { sunny: '맑네요', rainbow: '무지개가 떴네요', cloudy: '흐리네요', snow: '눈이 오네요', rain: '비가 오네요', thunder: '천둥이 치네요' };
const RUN_BAD = { rain: '비가 와요', thunder: '천둥이 쳐요', cloudy: '흐려요' };
const RUN_GOOD = { sunny: '맑아요', rainbow: '무지개가 떠요', snow: '고요해요' };

// 고른 순간 몽글이가 건네는 말 (날짜마다 하나로 고정해 매일 조금씩 다르게)
const PICKED = {
  sunny: ['햇살 가득! 오늘 기분 좋아 보여요', '맑은 마음, 저까지 반짝여요', '좋은 하루였군요! 오래 기억해요', '오늘 웃은 일, 메모로 남겨 볼까요?', '맑은 날엔 저도 둥실둥실해요', '이 기분 그대로 내일도 만나요'],
  rainbow: ['우와, 최고의 하루예요! 축하해요', '무지개 뜬 날! 저도 신나요', '오늘 같은 날을 위해 사는 거죠!', '최고의 순간, 꼭 메모로 남겨요', '오늘은 우주 최고 날씨예요!', '이런 날은 오래오래 기억할게요'],
  cloudy: ['그저 그런 날도 괜찮아요. 천천히 가요', '흐린 날도 소중한 하루예요', '오늘은 쉬어 가도 돼요', '구름 뒤엔 언제나 하늘이 있어요', '무난한 하루도 잘 보낸 거예요', '멍하니 있어도 괜찮은 날이에요'],
  snow: ['차분한 하루네요. 포근하게 쉬어요', '고요한 마음도 멋진 날씨예요', '조용히 쌓이는 하루였군요', '따뜻한 차 한 잔 어때요?', '눈 오는 날처럼 포근하게 쉬어요', '생각이 많은 날도 괜찮아요'],
  rain: ['울적한 날엔 제가 곁에 있을게요', '많이 힘들었죠? 토닥토닥', '비는 꼭 그쳐요. 오늘도 수고했어요', '울고 싶으면 울어도 괜찮아요', '오늘은 나를 꼭 안아 줘요', '마음을 여기 내려놓고 가요'],
  thunder: ['화날 만했어요. 크게 숨 한번 쉬어요', '으르렁! 제가 같이 화내 줄게요', '천둥 뒤엔 공기가 맑아져요', '오늘 참느라 고생 많았어요', '화난 마음, 여기 쏟아 놓아요', '내일은 분명 갤 거예요'],
};
// 밤에는 '햇살' 대신
const PICKED_NIGHT = {
  sunny: ['맑은 밤이에요. 별처럼 반짝인 하루였군요', '좋은 하루를 보냈군요. 푹 자요', '오늘 좋았던 일, 꿈에서도 만나요'],
  rainbow: ['밤하늘에도 무지개가 떴네요! 최고의 하루', '최고의 하루였군요. 행복한 꿈 꿔요'],
};

/**
 * 고른 순간의 말. ctx: { key(날짜), night, prev: { w, m }(어제 기록), runBefore(어제까지 같은 날씨가 이어진 날 수) }
 * 어제와 크게 달라졌거나 같은 날씨가 이어지면 그 이야기를 먼저 한다(몽글이가 기억한다는 느낌).
 */
export function pickedLine(w, { key = '', night = false, prev = null, runBefore = 0 } = {}) {
  if (prev && prev.w && prev.w !== w) {
    if (BAD.has(prev.w) && GOOD.has(w)) return `어제는 ${PAST[prev.w]}는데 오늘은 ${NOW[w]}! 다행이에요`;
    if (GOOD.has(prev.w) && BAD.has(w)) return `어제는 ${PAST[prev.w]}는데… 오늘은 힘들었군요. 토닥토닥`;
  }
  const run = prev && prev.w === w ? runBefore + 1 : 1;
  if (run >= 3 && RUN_BAD[w]) return `벌써 ${run}일째 ${RUN_BAD[w]}. 많이 지쳤죠? 제가 곁에 있을게요`;
  if (run >= 3 && RUN_GOOD[w]) return `${run}일째 ${RUN_GOOD[w]}! 좋은 흐름이에요`;
  const pool = night && PICKED_NIGHT[w] ? PICKED_NIGHT[w] : PICKED[w] || PICKED.cloudy;
  return pickBy(pool, key);
}

// 다시 열었을 때 (날짜마다 하나로 고정)
const AGAIN = {
  sunny: ['오늘의 반짝임, 잘 기억하고 있어요', '맑은 마음이 오래 머물면 좋겠어요', '좋은 하루, 끝까지 좋기를!'],
  rainbow: ['오늘 같은 날을 위해 사는 거죠!', '무지개 뜬 날은 오래오래 기억할게요', '최고의 하루, 다시 봐도 좋아요'],
  cloudy: ['구름 뒤엔 언제나 하늘이 있어요', '평범한 하루도 소중한 날씨예요', '오늘은 느긋하게 가요'],
  snow: ['조용한 마음도 멋진 날씨예요', '포근하게 쉬어 가는 하루였죠', '고요한 밤 보내요'],
  rain: ['비는 곧 그쳐요. 오늘도 수고했어요', '울적한 마음, 여기 잠시 내려놓아요', '오늘은 나에게 다정하게 대해 줘요'],
  thunder: ['번개가 지나가면 공기가 맑아져요', '내일은 갤 거예요. 푹 쉬어요', '화난 마음, 조금은 풀렸어요?'],
};
export const againLine = (id, dateKey = '') => pickBy(AGAIN[id] || ['오늘 마음에 맞는 날씨를 골라 줄래요?'], dateKey);

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
 * 기록하기 전 첫인사: 특별한 날 > 어제 남긴 메모 기억 > 요일 > 시간대
 * ctx: { birthday, yesterday: { w, m } | null, lateNight }
 */
export function greetLine(d = new Date(), { birthday = '', yesterday = null, lateNight = false } = {}) {
  const sp = specialDay(d, birthday);
  if (sp === 'birthday') return '생일 축하해요! 오늘 마음 날씨는 어때요?';
  if (sp === 'newyear') return '새해 첫 하늘이에요! 올해 첫 마음 날씨는요?';
  if (sp === 'xmaseve') return '크리스마스이브예요. 오늘 마음은 어떤 날씨예요?';
  if (sp === 'xmas') return '메리 크리스마스! 오늘 마음 날씨는요?';
  if (sp === 'yearend') return '올해 마지막 하늘이에요. 오늘 마음은요?';
  if (lateNight) return '늦은 밤이네요. 오늘 하루는 어땠어요?';
  if (yesterday && yesterday.m) {
    const m = short(yesterday.m, 10);
    if (GOOD.has(yesterday.w)) return `어제는 '${m}'! 오늘은 어떤 하루예요?`;
    return `어제 남긴 '${m}', 오늘은 좀 괜찮아요?`;
  }
  const h = d.getHours();
  const dow = d.getDay();
  if (dow === 5 && h >= 15) return '불금이에요! 이번 주 마음은 어땠어요?';
  if (dow === 1 && h < 15) return '새로운 한 주예요. 오늘 마음은 어떤가요?';
  if ((dow === 0 || dow === 6) && h >= 9) return '주말이에요. 오늘 마음 날씨를 남겨 볼까요?';
  if (h >= 5 && h < 11) return '좋은 아침이에요! 오늘 마음은 어떤 날씨예요?';
  if (h >= 21 || h < 5) return '오늘 하루 어땠어요? 날씨로 알려 줘요';
  return INIT_LINE;
}

// 몽글이를 누르면 (최근에 한 말은 하지 않는다 — 앱을 다시 켜도 기억)
const TAP_ANY = ['간질간질! 히히', '저 폭신하죠?', '오늘도 와 줘서 고마워요', '물 한 잔 마셨어요?', '깊게 숨 한번 쉬어 봐요', '제가 여기 있을게요',
  '구름은 원래 말랑해요', '어깨 한번 쭉 펴 볼까요?', '오늘 하늘 한번 올려다봤어요?', '잘하고 있어요, 정말로', '저는 언제나 당신 편이에요', '방금 웃었죠? 다 봤어요',
  '저 오늘 바람 타고 왔어요', '구름도 가끔은 쉬어 가요', '오늘 제일 잘한 일은 뭐였어요?', '좋아하는 노래 하나 틀어 볼까요?', '창밖 한번 봐요. 하늘이 예뻐요',
  '천천히 가도 다 도착해요', '오늘의 나에게 박수 짝짝', '저는 폭신폭신 응원 담당이에요', '작은 일에도 웃을 수 있길', '오늘도 여기까지 온 거, 대단해요'];
const TAP_TIME = {
  morning: ['좋은 아침! 물 한 잔부터 해요', '오늘 하루도 둥실둥실 시작해요'],
  evening: ['저녁은 맛있게 먹었어요?', '오늘 하루 수고 많았어요'],
  weekend: ['주말엔 늦잠도 좋아요', '오늘은 하고 싶은 거 하나만 해요'],
  monday: ['월요일은 천천히 시동 걸어요', '한 주의 시작, 같이 힘내요'],
  friday: ['불금이에요! 이번 주도 잘 버텼어요', '금요일이다! 둥실둥실'],
};
const TAP = {
  initial: ['날씨 버튼을 눌러 봐요!', '오늘 마음, 궁금해요', '저는 몽글이예요. 반가워요!'],
  sunny: ['햇살이 따뜻해요!', '웃는 얼굴이 예뻐요', '오늘은 둥실둥실 날아갈 것 같아요'],
  rainbow: ['오늘은 뭐든 할 수 있겠어요!', '무지개 끝까지 가 볼까요?', '반짝반짝, 신난다!'],
  cloudy: ['멍하니 있어도 괜찮아요', '구름이랑 같이 둥둥', '느릿느릿 가도 돼요'],
  snow: ['눈 오는 날엔 코코아죠', '포근하게 꼭 안아 줄게요', '사각사각, 고요해요'],
  rain: ['우산은 제가 될게요', '울어도 괜찮아요', '빗소리 들으며 쉬어요'],
  thunder: ['같이 으르렁! 해 줄게요', '화날 땐 잠깐 걷기!', '쾅! 하고 털어 버려요'],
};
const TAP_NIGHT = ['이제 푹 자요. 내일 또 만나요', '오늘 하루도 고생 많았어요', '좋은 꿈 꿔요'];
/** exclude: 최근에 한 말(앱을 다시 켜도 기억한 것) */
export function tapLine(w, d = new Date(), exclude = []) {
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
  const all = [...(TAP[w || 'initial'] || []), ...ctx, ...TAP_ANY];
  let pool = all.filter((s) => !exclude.includes(s));
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
