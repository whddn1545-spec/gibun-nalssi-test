// 몽글이의 오늘의 운세 — 재미로 보는 하루 한 번의 작은 쪽지.
// - 날짜와 사람마다 다른 씨앗으로 정해서 하루 동안은 몇 번을 열어도 같고, 사람마다 다르다(휴대폰 안에서만 계산).
// - 나쁜 운세는 없다. 요즘 힘든 날이 많았으면 위로하는 운세, 생일·월요일·금요일엔 그날에 맞는 운세.
// - 행운의 소품은 옷장에서 열린 소품 중에서 골라 '입혀 보기'로 이어진다.
import { ITEMS } from './wardrobe.js';

const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const pick = (arr, seed) => arr[hash(seed) % arr.length];

// 오늘의 하늘(제목)과 몽글이 한마디 — 짝으로 둔다
const SKIES = [
  ['작은 행운이 몽글몽글 피어나는 날', '오늘은 평소보다 한 번 더 웃어 봐요. 웃음이 행운을 불러와요'],
  ['바람이 등을 살짝 밀어 주는 날', '망설이던 일이 있다면 오늘 한 걸음만 내디뎌 봐요'],
  ['반가운 소식이 둥실 날아오는 날', '오랜만에 떠오르는 사람에게 먼저 안부를 건네 봐요'],
  ['마음에 무지개가 걸리는 날', '좋아하는 걸 하나 해 보세요. 오늘은 그게 다 잘 맞아요'],
  ['포근한 일이 소복소복 쌓이는 날', '작은 친절을 받으면 꼭 고맙다고 말해 줘요. 두 배로 돌아와요'],
  ['생각지 못한 웃음이 터지는 날', '오늘은 사소한 일에도 크게 웃어 줘요. 저도 따라 웃을게요'],
  ['천천히 가도 다 잘 풀리는 날', '서두르지 않아도 괜찮아요. 오늘은 느린 걸음이 행운이에요'],
  ['좋은 사람이 곁에 머무는 날', '곁에 있는 사람에게 고마운 마음을 한마디 전해 봐요'],
  ['작은 용기가 큰 기쁨이 되는 날', '하고 싶던 말 하나, 오늘은 용기 내서 꺼내 봐요'],
  ['하늘이 내 편이 되어 주는 날', '오늘 하는 일에는 구름 한 점 없는 응원이 따라가요'],
  ['반짝이는 생각이 떠오르는 날', '떠오른 생각은 바로 적어 두세요. 오늘 생각이 보물이 돼요'],
  ['맛있는 행운이 기다리는 날', '오늘은 먹고 싶던 걸 먹어도 좋아요. 기분까지 든든해져요'],
];
// 요즘 힘든 날이 많았을 때
const SKIES_GENTLE = [
  ['구름 사이로 햇살이 비치는 날', '요즘 많이 힘들었죠. 오늘은 작은 다정함이 꼭 찾아올 거예요'],
  ['무거운 짐을 조금 내려놓는 날', '오늘은 해야 할 일 하나만 하고 나머지는 내일에 맡겨요'],
  ['다정한 일이 살며시 찾아오는 날', '힘든 날들을 잘 버텨 왔어요. 오늘은 스스로를 꼭 안아 줘요'],
];
const SKIES_DAY = {
  birthday: ['하늘의 구름이 모두 축하하러 오는 날', '생일 축하해요! 오늘은 하고 싶은 걸 마음껏 해도 되는 날이에요'],
  monday: ['한 주를 가볍게 여는 날', '처음부터 달리지 않아도 돼요. 천천히 시동 걸면 이번 주는 잘 풀려요'],
  friday: ['기다린 주말이 문을 두드리는 날', '이번 주도 정말 수고했어요. 오늘 저녁엔 좋아하는 걸 해요'],
};
const COLORS = [
  { name: '햇살 노랑', hex: '#FFC94F' }, { name: '무지개 분홍', hex: '#FF97A5' }, { name: '하늘 파랑', hex: '#8EC7F2' },
  { name: '새싹 초록', hex: '#9ADDB2' }, { name: '라벤더 보라', hex: '#BDA6F1' }, { name: '노을 코랄', hex: '#FF8B6D' },
  { name: '구름 하양', hex: '#F4F1EC' }, { name: '포근한 베이지', hex: '#E9D2B4' },
];
const MISSIONS = ['하늘 사진 한 장 찍기', '좋아하는 노래 한 곡 듣기', '물 한 잔 천천히 마시기', '고마운 사람에게 짧은 메시지 보내기', '5분 동안 산책하기',
  '창문 열고 크게 숨 한번 쉬기', '좋아하는 간식 하나 먹기', '오늘 웃었던 일 한 줄 적기', '어깨 쭉 펴고 기지개 켜기', '평소보다 30분 일찍 잠들기',
  '거울 보고 한 번 웃어 보기', '책상 위 하나만 정리하기'];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const hourText = (h) => (h < 12 ? `오전 ${h}시` : h === 12 ? '낮 12시' : h < 18 ? `오후 ${h - 12}시` : `저녁 ${h - 12}시`);

/**
 * 오늘의 운세. key: 오늘 날짜(YYYY-MM-DD), seed: 사람마다 정해 둔 수, ctx: { count(기록한 날 수), hard(요즘 힘든 날 수), special, dow }
 * 반환: { sky, word, color, item, itemOpen, time, mission }
 */
export function fortune(key, seed, { count = 0, hard = 0, special = null, dow = -1 } = {}) {
  const s = `${seed}|${key}`;
  let pair;
  if (special === 'birthday') pair = SKIES_DAY.birthday;
  else if (hard >= 3) pair = pick(SKIES_GENTLE, `${s}|g`);
  else if (dow === 1 && hash(`${s}|d`) % 2 === 0) pair = SKIES_DAY.monday;
  else if (dow === 5 && hash(`${s}|d`) % 2 === 0) pair = SKIES_DAY.friday;
  else pair = pick(SKIES, `${s}|sky`);
  // 행운의 소품: 열린 소품 중에서(아직 없으면 첫 선물인 새싹을 미리 보여 준다)
  const open = ITEMS.filter((it) => count >= it.need);
  const item = open.length ? pick(open, `${s}|item`) : ITEMS[0];
  return {
    sky: pair[0],
    word: pair[1],
    color: pick(COLORS, `${s}|color`),
    item,
    itemOpen: count >= item.need,
    time: hourText(pick(HOURS, `${s}|time`)),
    mission: pick(MISSIONS, `${s}|mission`),
  };
}
