// 몽글이가 메모에 답하는 말: 같은 말을 일주일 새 또 썼으면 기억하고, 아니면 메모 주제(일·몸·사람·음식…)에 맞춰 답한다.
// 대사는 '짧은 말|덧붙이는 말'(weather.js 참고). 덧붙이는 말은 상황(늦은 밤·불금·월요일…)에 맞춰 바뀔 수 있다.
import { tokensOf } from './insights.js';
import { josa } from './forecast-text.js';
import { withTail, toneOf } from './weather.js';

const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const pickBy = (arr, seed) => arr[hash(seed) % arr.length];

// 주제: 메모에 이 말(앞부분)이 들어 있으면. 날씨가 좋을 때·힘들 때 답을 다르게.
const TOPICS = [
  { words: ['아프', '아파', '감기', '병원', '두통', '몸살', '배탈', '열나', '다쳤'], good: '몸은 괜찮아졌어요?|그래도 무리하지 말고 오늘은 일찍 쉬어요', bad: '몸은 좀 괜찮아요? 오늘은 푹 쉬어요.|따뜻하게 하고, 많이 아프면 꼭 병원에 가요' },
  { words: ['야근', '회의', '출근', '퇴근', '회사', '업무', '보고서', '마감', '상사', '일이'], good: '일이 잘 풀렸군요! 멋져요.|오늘은 수고한 자신에게 작은 선물을 줘요', bad: '일하느라 정말 고생 많았어요.|오늘은 일 생각은 접어 두고 푹 쉬어요' },
  { words: ['시험', '공부', '과제', '수업', '학교', '발표', '면접'], good: '열심히 한 보람이 있네요!|그동안 애쓴 자신을 꼭 칭찬해 줘요', bad: '애썼어요. 결과보다 그 마음이 대단해요.|끝까지 해낸 것만으로도 충분해요' },
  { words: ['운동', '산책', '헬스', '요가', '달리', '러닝', '수영', '등산', '걸었'], good: '몸을 움직였군요! 상쾌했겠어요.|이 좋은 습관, 제가 응원할게요', bad: '그래도 움직인 나, 칭찬해요.|몸이 움직이면 마음도 조금씩 따라와요' },
  { words: ['치킨', '커피', '맛있', '먹었', '떡볶이', '라면', '케이크', '국수', '고기', '빵'], good: '맛있는 거 먹었군요! 저도 냠냠.|맛있는 건 기분까지 맑게 해 줘요', bad: '맛있는 거 먹고 기운 내요.|든든하게 먹은 것만으로도 잘한 거예요' },
  { words: ['친구', '엄마', '아빠', '가족', '동생', '언니', '오빠', '누나', '애인', '남친', '여친', '손주', '아이', '아들', '딸'], good: '함께한 시간이 마음에 남았군요.|소중한 사람과의 하루, 오래 기억해요', bad: '마음 쓰였겠어요. 이야기해 줘서 고마워요.|제가 다 들어 줄게요' },
  { words: ['잠', '졸려', '늦잠', '못잤', '못 잤', '피곤'], good: '푹 쉬고 나니 좋죠?|잘 자는 것도 스스로를 아끼는 일이에요', bad: '오늘은 일찍 푹 자요.|잠이 보약이래요. 내일은 더 가벼울 거예요' },
  { words: ['휴가', '여행', '영화', '드라마', '게임', '책', '쉬었', '놀았'], good: '잘 쉬었다니 저도 좋아요.|이런 시간이 있어야 또 힘이 나죠', bad: '쉬어도 마음이 무거웠군요. 괜찮아요.|마음도 쉬는 데 시간이 걸려요' },
  { words: ['칭찬', '합격', '성공', '해냈', '선물', '축하', '월급', '당첨'], good: '와, 정말 좋은 일이에요!|오늘의 기쁨, 오래오래 꺼내 봐요', bad: '좋은 일도 있었군요. 그걸 붙잡아 봐요.|힘든 날에도 이런 순간이 힘이 돼요' },
  { words: ['싸웠', '다퉜', '혼났', '짜증', '화났', '서운', '억울'], good: '그래도 잘 풀렸군요.|마음이 한결 가벼워졌길 바라요', bad: '속상했겠어요. 제가 들어 줄게요.|여기 다 털어놓아요. 몽글이는 언제나 응원해요' },
];

const PLAIN = {
  good: ['좋은 날의 한 줄, 잘 간직할게요.|힘든 날 꺼내 보면 힘이 될 거예요', '이 한 줄 보면 또 웃게 될 거예요.|오늘을 남겨 줘서 고마워요', '오늘의 반짝임을 적어 줘서 고마워요.|이런 날이 자주 오면 좋겠어요'],
  mid: ['소중한 한 줄, 잘 간직할게요.|내일도 한 줄 들려줘요', '평범한 하루도 적어 두면 특별해져요.|오늘도 남겨 줘서 고마워요', '오늘의 나, 잘 기억할게요.|별일 없는 하루도 소중해요'],
  bad: ['말해 줘서 고마워요. 여기 내려놓고 가요.|제가 곁에 있을게요', '그랬군요. 오늘 정말 애썼어요.|힘든 마음, 여기 다 내려놓아요', '적고 나니 조금은 가벼워졌길 바라요.|오늘은 스스로에게 다정하게 대해 줘요'],
};
// 길게 쓴 날
const LONG = {
  good: '긴 이야기 들려줘서 고마워요.|좋은 하루를 꼼꼼히 남겼네요',
  mid: '오늘 하고 싶은 말이 많았군요.|하나하나 다 읽었어요',
  bad: '많은 일이 있었군요. 다 읽었어요.|털어놓고 나니 조금은 가벼워졌길 바라요',
};

/**
 * memo: 오늘 메모, w: 오늘 날씨, recent: 최근 7일(오늘 빼고)의 [{ k, m, w }], key: 오늘 날짜, ctx: 상황(main.js lineCtx)
 * 반환: 몽글이 한마디('짧은 말|덧붙이는 말')
 */
export function memoReply(memo, w, recent = [], key = '', ctx = {}) {
  const tone = toneOf(w);
  const toks = tokensOf(memo);
  // 일주일 새 같은 말을 또 썼으면 기억한다 (가장 많이 나온 말 하나)
  let best = null;
  for (const t of toks) {
    const n = recent.filter((r) => r.m && tokensOf(r.m).includes(t)).length;
    if (n >= 1 && (!best || n > best.n)) best = { t, n };
  }
  if (best) {
    const nth = best.n + 1;
    const tk = best.t.replace(/\|/g, '｜');
    const is = josa(tk, '이에요', '예요');
    if (tone === 'good') return `또 '${tk}'${is}! 일주일 새 ${nth}번째예요.|좋은 건 자주 할수록 좋죠`;
    if (tone === 'mid') return `또 '${tk}'${is}? 일주일 새 ${nth}번째예요.|요즘 마음에 자주 남는 일인가 봐요`;
    return `또 '${tk}'${is}? 일주일 새 ${nth}번째예요.|많이 지쳤죠? 오늘은 꼭 스스로를 챙겨요`;
  }
  const m = String(memo);
  const seed = `${key}|${m}`;
  for (const tp of TOPICS) {
    if (tp.words.some((x) => m.includes(x))) return withTail(tone === 'good' ? tp.good : tp.bad, tone, ctx, seed);
  }
  if (Array.from(m).length >= 40) return withTail(LONG[tone], tone, ctx, seed);
  return withTail(pickBy(PLAIN[tone], seed), tone, ctx, seed);
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
