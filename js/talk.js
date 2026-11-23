// 몽글이가 메모에 답하는 말 — 휴대폰 안에서만 알아듣는다(메모를 밖으로 보내지 않는다).
// 메모 속 사람(엄마·팀장…)·일(혼남·다툼·이별·합격·아픔…)·마음(슬픔·불안·뿌듯함…)과 '안 힘들었다' 같은 부정을 읽고,
// 쓴 말에 맞춰 답한다. 힘든 마음엔 비유 없이 진심으로, 좋은 날엔 몽글이답게(뒷마디).
// 죽고 싶다 같은 위험한 말에는 귀여운 말 없이 진심으로 답하고 도움받을 곳(109)을 알려 준다.
// 대사는 '짧은 말|덧붙이는 말'(weather.js 참고).
import { tokensOf } from './insights.js';
import { josa } from './forecast-text.js';
import { withTail, toneOf } from './weather.js';

const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const pickBy = (arr, seed) => arr[hash(seed) % arr.length];
const safe = (s) => String(s).replace(/\|/g, '｜');
const len = (s) => Array.from(String(s)).length;

// ---------------------------------------------------------------- 위험한 말
const CRISIS = ['죽고 싶', '죽고싶', '자살', '자해', '사라지고 싶', '사라지고싶', '살기 싫', '살기싫', '살고 싶지 않', '없어지고 싶', '없어지고싶', '끝내고 싶', '끝내고싶', '죽어 버리', '죽어버리'];
export const isCrisis = (m) => { const s = String(m).replace(/\s+/g, ' '); return CRISIS.some((w) => s.includes(w)); };
// 한 마디로 둔다('차분하게'에서도 109까지 다 보이게)
export const CRISIS_LINE = '그만큼 많이 힘들었군요. 말해 줘서 고마워요. 혼자 견디지 말고 109에 전화해 주세요';

// ---------------------------------------------------------------- 메모 속 마음 (말의 앞부분)
const MOODS = [
  ['sad', ['슬프', '슬퍼', '슬펐', '우울', '눈물', '울었', '울고 싶', '서럽', '서러', '허무', '공허', '속상', '마음이 아프', '맘이 아프']],
  ['lonely', ['외롭', '외로', '쓸쓸', '혼자라', '혼자인']],
  ['hurt', ['서운', '상처받', '상처를 받', '섭섭', '배신', '무시당', '무시를 당']],
  ['anxious', ['불안', '걱정', '초조', '긴장', '무섭', '무서', '두렵', '두려', '떨려', '떨리', '조마조마']],
  ['regret', ['후회', '실수', '자책', '잘못했']],
  ['angry', ['화나', '화났', '화가 나', '짜증', '열받', '빡치', '빡쳐', '억울', '분하', '분해', '어이없']],
  ['tired', ['피곤', '지쳤', '지친', '지쳐', '힘들', '힘드', '힘듦', '녹초', '번아웃', '기진맥진', '고단']],
  ['down', ['좋지 않', '좋진 않', '별로였', '최악', '엉망']],
  ['meh', ['심심', '지루', '재미없', '무기력', '귀찮', '멍하', '멍때']],
  ['soso', ['그저 그', '그냥 그', '평범', '무난', '별일 없']],
  ['relief', ['다행', '화해', '풀렸', '나았', '괜찮아졌']],
  ['proud', ['뿌듯', '해냈', '칭찬받', '칭찬을 받']],
  ['happy', ['행복', '기뻤', '기쁘', '기뻐', '좋았', '좋다', '신났', '신나', '설레', '설렜', '재밌', '재미있', '즐거', '즐겁', '많이 웃', '실컷 웃']],
  ['thanks', ['고마', '감사', '덕분']],
  ['calm', ['편안', '평온', '여유', '느긋', '힐링', '푹 쉬', '잘 쉬', '푹 잤', '잘 잤']],
];
const NEG = new Set(['sad', 'lonely', 'hurt', 'anxious', 'regret', 'angry', 'tired', 'down']);
const POS = new Set(['relief', 'proud', 'happy', 'thanks', 'calm', 'okay']);
// 여럿이면 무거운 마음부터
const ORDER = ['sad', 'lonely', 'hurt', 'anxious', 'regret', 'angry', 'tired', 'down', 'meh', 'soso', 'relief', 'okay', 'proud', 'happy', 'thanks', 'calm'];
const MOOD_TONE = { sad: 'bad', lonely: 'bad', hurt: 'bad', anxious: 'bad', regret: 'bad', angry: 'bad', tired: 'bad', down: 'bad', meh: 'mid', soso: 'mid', mixed: 'mid', relief: 'good', okay: 'good', proud: 'good', happy: 'good', thanks: 'good', calm: 'good' };
// 이 마음일 땐 '또 썼네요'보다 마음에 먼저 답한다
const HEAVY = new Set(['sad', 'lonely', 'hurt', 'anxious', 'regret', 'down']);

/** 메모 속 마음 하나: 'sad'… / 'okay'(힘든 말을 부정: 안 힘들었다) / 'down'(좋은 말을 부정: 안 좋았다) / 'mixed'(둘 다) / null */
export function moodOf(memo) {
  const s = ` ${String(memo).replace(/\s+/g, ' ')} `;
  const found = [];
  for (const [k, words] of MOODS) {
    for (const w of words) {
      for (let i = s.indexOf(w); i >= 0; i = s.indexOf(w, i + 1)) {
        const before = s.slice(Math.max(0, i - 2), i);
        const after = s.slice(i + w.length, i + w.length + 6);
        const neg = /(안|못) $/.test(before) || /^[가-힣]?(지|진|지는) ?(않|못|말)/.test(after) || /^ ?없/.test(after);
        found.push(neg ? (NEG.has(k) ? 'okay' : POS.has(k) ? 'down' : k) : k);
      }
    }
  }
  if (!found.length) return null;
  const hasNeg = found.some((k) => NEG.has(k));
  const hasPos = found.some((k) => POS.has(k));
  if (hasNeg && hasPos) return 'mixed';
  return ORDER.find((k) => found.includes(k)) || found[0];
}

// ---------------------------------------------------------------- 메모 속 일 (앞에 있을수록 먼저)
const EVENTS = [
  ['breakup', ['헤어졌', '헤어짐', '이별', '차였', '헤어지자']],
  ['scolded', ['혼났', '혼나', '꾸중', '잔소리', '욕먹', '욕 먹', '깨졌']],
  ['fight', ['싸웠', '다퉜', '싸움', '말다툼', '다툼']],
  ['fail', ['떨어졌', '불합격', '탈락', '망쳤', '망했', '실패', '놓쳤']],
  ['pass', ['합격', '붙었', '통과', '성공', '해냈', '승진', '1등', '일등']],
  ['sick', ['아프', '아파', '아팠', '감기', '병원', '두통', '몸살', '배탈', '열나', '열이 나', '다쳤', '입원', '독감']],
  ['nosleep', ['못잤', '못 잤', '잠을 못', '잠이 안', '불면', '밤샜', '밤새']],
  ['work', ['야근', '회의', '출근', '퇴근', '회사', '업무', '보고서', '마감', '상사', '팀장', '부장', '과장', '직장', '알바', '출장']],
  ['study', ['시험', '공부', '과제', '수업', '학교', '발표', '면접', '수능', '학원', '숙제']],
  ['pet', ['강아지', '고양이', '댕댕이', '냥이', '반려견', '반려묘']],
  ['gift', ['선물', '생일', '기념일', '축하']],
  ['payday', ['월급', '보너스', '용돈']],
  ['money', ['돈이 없', '돈 없', '카드값', '대출']],
  ['exercise', ['운동', '산책', '헬스', '요가', '달리기', '러닝', '수영', '등산', '자전거', '필라테스', '걸었']],
  ['food', ['치킨', '커피', '맛있', '먹었', '떡볶이', '라면', '케이크', '국수', '고기', '맛집', '디저트', '빵']],
  ['oversleep', ['늦잠']],
  ['rest', ['휴가', '여행', '영화', '드라마', '게임', '책을', '책 읽', '독서', '쉬었', '놀았', '카페', '전시']],
];
// 마음 말이 없을 때 그 일의 기본 결
const EVENT_TONE = { breakup: 'bad', scolded: 'bad', fight: 'bad', fail: 'bad', pass: 'good', sick: 'bad', nosleep: 'bad', money: 'bad', payday: 'good', gift: 'good', pet: 'good', oversleep: 'good' };
/** 메모 속 일 하나와 그 말: { k, word } | null */
function eventOf(memo) {
  const s = String(memo);
  for (const [k, words] of EVENTS) for (const w of words) if (s.includes(w)) return { k, word: w };
  return null;
}

// ---------------------------------------------------------------- 메모 속 사람 (가장 앞에 나온 사람, 같은 자리면 긴 말)
const PEOPLE = ['남자친구', '여자친구', '할머니', '할아버지', '부모님', '선생님', '교수님', '팀장님', '부장님', '과장님', '엄마', '아빠', '친구', '동생', '언니', '오빠', '누나', '남편', '아내', '와이프', '애인', '남친', '여친', '팀장', '상사', '아기', '아들', '손주', '동료', '선배', '후배', '룸메'];
function personOf(memo) {
  const s = String(memo);
  let best = null;
  for (const p of PEOPLE) {
    const i = s.indexOf(p);
    if (i >= 0 && (!best || i < best.i || (i === best.i && p.length > best.p.length))) best = { i, p };
  }
  return best ? best.p : null;
}
const rang = (p) => `${p}${josa(p, '이랑', '랑')}`;

// ---------------------------------------------------------------- 답
const EVENT_LINES = {
  breakup: { bad: () => ['헤어져서 많이 아프죠.|마음을 다한 만큼 아픈 거예요. 오늘은 실컷 슬퍼해도 돼요'], good: () => ['새로운 시작을 고른 날이군요.|어떤 마음이든 제가 곁에 있을게요'] },
  scolded: {
    bad: (p) => [p ? `${p}한테 혼나서 많이 속상했죠.|열심히 한 만큼 더 서러웠을 거예요` : '혼나서 많이 속상했죠.|열심히 한 만큼 더 서러웠을 거예요'],
    good: () => ['혼났지만 잘 넘겼군요.|그래도 오늘 정말 수고 많았어요'],
  },
  fight: {
    bad: (p) => [p ? `${rang(p)} 다퉈서 마음이 무겁죠.|소중한 사이라서 더 아픈 거예요` : '다툰 일 때문에 마음이 무겁죠.|소중한 사이라서 더 아픈 거예요'],
    good: (p) => [p ? `${rang(p)} 다퉜지만 잘 풀렸군요.|마음이 한결 가벼워졌길 바라요` : '다퉜지만 잘 풀렸군요.|마음이 한결 가벼워졌길 바라요'],
  },
  fail: { bad: () => ['원하던 결과가 아니라 많이 속상하죠.|그래도 애쓴 시간은 사라지지 않아요'], good: () => ['아쉽지만 잘 털어 냈군요.|그 마음이면 다음엔 분명 더 잘될 거예요'] },
  pass: {
    good: () => ['와, 정말 축하해요!|그동안 애쓴 시간이 빛을 봤네요. 저도 둥실 떠올랐어요'],
    bad: () => ['좋은 결과인데도 마음이 무겁군요.|그동안 너무 애써서 그럴 거예요. 이제 좀 쉬어요'],
  },
  sick: { bad: () => ['몸이 아프면 마음까지 지치죠.|따뜻하게 하고 푹 쉬어요. 많이 아프면 꼭 병원에 가요'], good: () => ['몸이 좀 나아졌다니 다행이에요.|그래도 오늘은 무리하지 마요'] },
  nosleep: { bad: () => ['잠을 잘 못 잤군요.|오늘 밤엔 꼭 푹 잘 수 있길 바라요'] },
  work: {
    bad: () => ['일하느라 정말 고생 많았어요.|오늘은 일 생각은 접어 두고 푹 쉬어요'],
    mid: () => ['오늘도 일하느라 수고했어요.|퇴근한 뒤엔 일 생각은 구름에 실어 보내요'],
    good: () => ['일이 잘 풀렸군요! 멋져요.|오늘은 수고한 자신에게 작은 선물을 줘요'],
  },
  study: {
    bad: () => ['애썼어요. 결과보다 그 마음이 대단해요.|끝까지 해낸 것만으로도 충분해요'],
    mid: () => ['오늘도 공부하느라 수고했어요.|조금씩 쌓이는 게 제일 커요'],
    good: () => ['열심히 한 보람이 있네요!|그동안 애쓴 자신을 꼭 칭찬해 줘요'],
  },
  pet: {
    good: (p, w) => [`${rang(w)} 함께한 하루였군요!|생각만 해도 마음이 몽글몽글해요`],
    bad: (p, w) => [`${w} 일로 마음이 많이 쓰였군요.|오늘은 둘 다 푹 쉬었으면 좋겠어요`],
  },
  gift: { good: () => ['좋은 날이었군요! 축하해요.|이런 날은 제 구름 주머니에 꼭 넣어 둘게요'], bad: () => ['특별한 날인데 마음이 무거웠군요.|그래도 오늘 와 줘서 고마워요'] },
  payday: { good: () => ['기다리던 날이군요! 저도 신나요.|오늘은 자신에게 작은 선물 하나 해요'] },
  money: { bad: () => ['돈 걱정이 많았군요.|혼자 끙끙 앓지 말고 여기 털어놓아요'] },
  exercise: { good: () => ['몸을 움직였군요! 상쾌했겠어요.|저도 바람 타고 같이 달린 기분이에요'], bad: () => ['그래도 움직인 나, 칭찬해요.|몸이 움직이면 마음도 조금씩 따라와요'] },
  food: { good: () => ['맛있는 거 먹었군요! 저도 냠냠.|맛있는 건 기분까지 몽글몽글하게 해 줘요'], bad: () => ['맛있는 거 먹고 기운 내요.|든든하게 먹은 것만으로도 잘한 거예요'] },
  oversleep: { good: () => ['늦잠 잔 날도 좋아요.|푹 잔 만큼 마음도 말랑해졌을 거예요'], bad: () => ['늦잠 때문에 하루가 바빴군요.|그래도 푹 잔 몸은 고마워할 거예요'] },
  rest: { good: () => ['잘 쉬었다니 저도 좋아요.|이런 시간이 있어야 또 힘이 나죠'], bad: () => ['쉬어도 마음이 무거웠군요. 괜찮아요.|마음도 쉬는 데 시간이 걸려요'] },
};
const PERSON_LINES = {
  good: (p) => [`${rang(p)} 좋은 시간 보냈군요.|그런 순간이 오래 마음에 남을 거예요`, `${p} 이야기만 들어도 저까지 따뜻해져요.|오늘은 제 구름 주머니에 넣어 둘게요`],
  mid: (p) => [`${p} 이야기를 들려줘서 고마워요.|오늘 하루도 잘 지나왔어요`],
  bad: (p) => [`${p} 일로 마음이 많이 쓰였군요.|이야기해 줘서 고마워요. 제가 다 들어 줄게요`],
};
const MOOD_LINES = {
  sad: ['많이 속상했죠? 토닥토닥.|울고 싶으면 울어도 괜찮아요', '슬픈 건 약해서가 아니에요.|그만큼 마음을 다했다는 뜻이에요', '오늘은 괜찮은 척하지 않아도 돼요.|제가 여기서 조용히 곁에 있을게요'],
  lonely: ['외로운 하루였군요.|여기 와서 이야기해 줘서 고마워요. 혼자가 아니에요', '혼자라고 느껴질 때도 저는 여기 있어요.|언제든 와서 이야기해요'],
  hurt: ['서운했겠어요.|마음을 쓴 만큼 서운한 거예요. 제가 알아요', '마음에 상처가 났군요.|오늘은 그 마음부터 꼭 안아 줘요'],
  anxious: ['걱정이 많았군요.|걱정이 많은 건 그만큼 잘하고 싶어서예요', '마음이 불안했군요. 천천히 숨 쉬어 봐요.|지금 이 순간은 괜찮아요'],
  regret: ['마음에 계속 걸리는군요.|누구나 실수해요. 그렇게 마음 쓰는 것만으로도 충분해요', '후회되는 일이 있었군요.|스스로를 너무 다그치지 마요'],
  angry: ['화날 만했어요.|그 마음, 참지 말고 여기 다 꺼내 놔도 돼요', '정말 화났겠어요.|오늘 많이 참았죠. 이제 내려놓아요'],
  tired: ['오늘 정말 많이 지쳤죠?|여기까지 온 것만으로도 충분히 잘했어요', '많이 힘들었죠.|오늘은 아무것도 안 해도 괜찮아요. 푹 쉬어요'],
  down: ['오늘은 마음이 좀 가라앉았군요.|그런 날도 괜찮아요. 제가 곁에 있을게요', '정말 힘든 하루였군요.|그런 날을 끝까지 버텨 낸 것만으로도 대단해요'],
  meh: ['기운이 없는 하루였군요.|작은 것 하나만 해도 충분히 잘한 거예요', '힘이 안 나는 날도 있어요.|오늘은 느긋하게 보내도 괜찮아요'],
  soso: ['그저 그런 날도 있어요.|별일 없는 하루도 잘 보낸 거예요', '무난한 하루였군요.|평범한 날이 쌓여서 좋은 날이 와요'],
  mixed: ['힘든 와중에도 좋은 순간을 찾아냈군요.|그게 정말 큰 힘이에요', '좋은 일도 힘든 일도 있었던 하루네요.|둘 다 소중한 오늘의 마음이에요'],
  okay: ['생각보다 괜찮은 하루였군요.|다행이에요. 저도 마음이 놓여요'],
  relief: ['다행이에요. 정말 다행이에요.|저도 마음이 놓여서 둥실 떠올랐어요'],
  proud: ['정말 해냈군요! 대단해요.|너무 신나서 저도 둥실 떠올랐어요'],
  happy: ['좋은 하루였군요!|이 한 줄은 제 구름 주머니에 꼭 넣어 둘게요', '이야기만 들어도 저까지 신나요!|오늘의 반짝임, 오래 기억할게요'],
  thanks: ['고마운 마음이 가득한 날이네요.|그 마음, 꼭 전해 봐요. 분명 기뻐할 거예요'],
  calm: ['편안한 하루였군요.|이런 날은 저도 몽글몽글 느긋해져요'],
};
// 아무것도 못 알아들었을 때
const PLAIN = {
  good: ['좋은 날의 한 줄, 잘 간직할게요.|힘든 날 꺼내 보면 힘이 될 거예요', '이 한 줄 보면 또 웃게 될 거예요.|오늘을 남겨 줘서 고마워요', '오늘의 반짝임을 적어 줘서 고마워요.|제 구름 주머니에 꼭 넣어 둘게요'],
  mid: ['소중한 한 줄, 잘 간직할게요.|내일도 한 줄 들려줘요', '평범한 하루도 적어 두면 특별해져요.|오늘도 남겨 줘서 고마워요', '오늘의 나, 잘 기억할게요.|별일 없는 하루도 소중해요'],
  bad: ['말해 줘서 고마워요. 여기 내려놓고 가요.|제가 곁에 있을게요', '그랬군요. 오늘 정말 애썼어요.|힘든 마음, 여기 다 내려놓아요', '적고 나니 조금은 가벼워졌길 바라요.|오늘은 스스로에게 다정하게 대해 줘요'],
};
// 짧게 쓴 날: 그 말을 그대로 받아 준다
const ECHO_TAIL = {
  good: ['오늘의 한 줄, 제 구름 주머니에 넣어 둘게요'],
  mid: ['짧아도 괜찮아요. 오늘을 남긴 게 중요해요'],
  bad: ['짧은 한 줄에도 마음이 느껴져요. 제가 곁에 있을게요'],
};
// 길게 쓴 날
const LONG = {
  good: '긴 이야기 들려줘서 고마워요.|좋은 하루를 꼼꼼히 남겼네요',
  mid: '오늘 하고 싶은 말이 많았군요.|하나하나 다 읽었어요',
  bad: '많은 일이 있었군요. 다 읽었어요.|털어놓고 나니 조금은 가벼워졌길 바라요',
};

/** 이 결의 말이 없으면 가까운 결로 */
function byTone(set, tone) {
  return set[tone] || (tone === 'mid' ? set.good || set.bad : set.mid || set.good || set.bad);
}

/**
 * memo: 오늘 메모, w: 오늘 날씨, recent: 최근 7일(오늘 빼고)의 [{ k, m, w }], key: 오늘 날짜, ctx: 상황(main.js lineCtx)
 * 반환: 몽글이 한마디('짧은 말|덧붙이는 말'). 위험한 말 > 일주일 새 또 쓴 말 > 일 > 사람 > 마음 > 긴 글 > 짧은 글 > 그 밖
 */
export function memoReply(memo, w, recent = [], key = '', ctx = {}) {
  const m = String(memo).replace(/\s+/g, ' ').trim();
  if (isCrisis(m)) return CRISIS_LINE;
  const seed = `${key}|${m}`;
  const mood = moodOf(m);
  const ev = eventOf(m);
  const person = personOf(m);
  const tone = mood ? MOOD_TONE[mood] : ev && EVENT_TONE[ev.k] ? EVENT_TONE[ev.k] : toneOf(w);
  // 메모 답은 쓴 말에 대한 답이라 상황 덧붙임(월요일·주말…)으로 바꾸지 않는다. 늦은 밤만 그 시간에 맞춘다.
  const finish = (line) => (ctx && ctx.lateNight && tone !== 'bad' ? withTail(line, tone, { lateNight: true, hour: 2, dow: -1, month: 5 }, seed) : line);

  // 일주일 새 같은 말을 또 썼으면 기억한다 (무거운 마음일 땐 마음에 먼저 답한다)
  if (!HEAVY.has(mood)) {
    let best = null;
    for (const t of tokensOf(m)) {
      const n = recent.filter((r) => r.m && tokensOf(r.m).includes(t)).length;
      if (n >= 1 && (!best || n > best.n)) best = { t, n };
    }
    if (best) {
      const nth = best.n + 1;
      const tk = safe(best.t);
      const is = josa(tk, '이에요', '예요');
      if (tone === 'good') return `또 '${tk}'${is}! 일주일 새 ${nth}번째예요.|좋은 건 자주 할수록 좋죠`;
      if (tone === 'mid') return `또 '${tk}'${is}? 일주일 새 ${nth}번째예요.|요즘 마음에 자주 남는 일인가 봐요`;
      return `또 '${tk}'${is}? 일주일 새 ${nth}번째예요.|많이 지쳤죠? 오늘은 꼭 스스로를 챙겨요`;
    }
  }
  if (ev) {
    const make = byTone(EVENT_LINES[ev.k], tone);
    if (make) return finish(pickBy(make(person, ev.word), seed));
  }
  if (person) return finish(pickBy(byTone(PERSON_LINES, tone)(person), seed));
  if (mood) return finish(pickBy(MOOD_LINES[mood], seed));
  if (len(m) >= 40) return finish(LONG[tone]);
  if (len(m) <= 10) return finish(`'${safe(m)}'${josa(m, '이라고', '라고')} 남겼군요.|${pickBy(ECHO_TAIL[tone], seed)}`);
  return finish(pickBy(PLAIN[tone], seed));
}

// 최근에 한 말은 앱을 다시 켜도 기억해 반복을 줄인다(기록 데이터와 따로 둔다)
const RECENT_KEY = 'kibun-weather:recent-talk';
export function rememberLine(line, keep = 12) {
  try {
    const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x) => x !== line);
    arr.push(line);
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(-keep)));
  } catch { /* 못 적으면 그만 */ }
}
export function recentLines() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
