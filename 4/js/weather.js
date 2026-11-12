// 날씨 = 기분. 순서는 고르기 버튼 순서.
export const WEATHERS = [
  { id: 'sunny', name: '맑음', mood: '좋아요', score: 4, line: '햇살 가득! 오늘 기분 좋아 보여요', ph: '어떤 일이 좋았나요?' },
  { id: 'rainbow', name: '무지개', mood: '최고예요', score: 5, line: '우와, 최고의 하루예요! 축하해요', ph: '최고의 순간을 적어요' },
  { id: 'cloudy', name: '구름', mood: '그저 그래요', score: 3, line: '그저 그런 날도 괜찮아요. 천천히 가요', ph: '오늘을 한 줄로 남겨요' },
  { id: 'snow', name: '눈', mood: '차분해요', score: 3.5, line: '차분한 하루네요. 포근하게 쉬어요', ph: '고요했던 순간을 적어요' },
  { id: 'rain', name: '비', mood: '울적해요', score: 2, line: '울적한 날엔 제가 곁에 있을게요', ph: '마음을 여기 내려놓아요' },
  { id: 'thunder', name: '천둥', mood: '화나요', score: 1, line: '화날 만했어요. 크게 숨 한번 쉬어요', ph: '무엇이 화나게 했나요?' },
];
export const WEATHER_IDS = WEATHERS.map((w) => w.id);
export const W = Object.fromEntries(WEATHERS.map((w) => [w.id, w]));

export const INIT_LINE = '오늘 마음에 맞는 날씨를 골라 줄래요?';
export const INIT_PH = '오늘을 한 줄로 남겨요';

// 다시 열었을 때 몽글이가 건네는 말 (날짜마다 하나로 고정)
const AGAIN = {
  sunny: ['오늘의 반짝임, 잘 기억하고 있어요', '맑은 마음이 오래 머물면 좋겠어요'],
  rainbow: ['오늘 같은 날을 위해 사는 거죠!', '무지개 뜬 날은 오래오래 기억할게요'],
  cloudy: ['구름 뒤엔 언제나 하늘이 있어요', '평범한 하루도 소중한 날씨예요'],
  snow: ['조용한 마음도 멋진 날씨예요', '포근하게 쉬어 가는 하루였죠'],
  rain: ['비는 곧 그쳐요. 오늘도 수고했어요', '울적한 마음, 여기 잠시 내려놓아요'],
  thunder: ['번개가 지나가면 공기가 맑아져요', '내일은 갤 거예요. 푹 쉬어요'],
};

export function againLine(id, dateKey = '') {
  const arr = AGAIN[id] || [INIT_LINE];
  let h = 0;
  for (const ch of dateKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}

/** 받침에 따라 '로/으로' */
export function ro(s) {
  const c = s.charCodeAt(s.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return '로';
  const j = c % 28;
  return j === 0 || j === 8 ? '로' : '으로';
}
