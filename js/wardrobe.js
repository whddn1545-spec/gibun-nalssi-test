// 몽글이 옷장: 기록한 날이 쌓이면 소품이 하나씩 열린다. 열림은 기록 수로 계산하므로 따로 저장하지 않는다.
// 그림 좌표는 몽글이 몸 가운데가 원점(art.js의 friendG와 같은 좌표계). 머리 꼭대기는 대략 (-5, -60).
const INK = '#46352D';
/** 테두리 속성 (중복 속성이 생기면 카드 이미지용 SVG(XML)가 깨지므로 굵기는 인자로만) */
const st = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const FLOWER = (x, y, s, fill, core = '#FFD25E') => `<g transform="translate(${x} ${y}) scale(${s})"><g fill="${fill}" ${st(2.2)}><circle cy="-4.6" r="4"/><circle cx="4.4" cy="-1.4" r="4"/><circle cx="2.7" cy="3.7" r="4"/><circle cx="-2.7" cy="3.7" r="4"/><circle cx="-4.4" cy="-1.4" r="4"/></g><circle r="2.6" fill="${core}"/></g>`;

export const ITEMS = [
  {
    id: 'sprout', name: '새싹', need: 1, slot: 'head', gift: '첫 기록 선물! 머리에 새싹이 돋았어요',
    svg: `<g transform="translate(-6 -57)">
      <path d="M0 2C0-7 1-14 3-21" fill="none" ${st(3.4)}/>
      <path d="M3-19C-5-30-20-28-23-18C-13-11-2-13 3-19Z" fill="#8FD47C" ${st()}/>
      <path d="M3-20C8-33 23-35 28-26C21-16 10-14 3-20Z" fill="#A9E392" ${st()}/>
      <path d="M-15-19Q-8-19-1-19M9-24Q15-26 20-27" fill="none" stroke="#5E9E52" stroke-width="1.8" stroke-linecap="round"/></g>`,
  },
  {
    id: 'bow', name: '리본', need: 3, slot: 'head', gift: '기록 3일 선물! 분홍 리본을 받았어요',
    svg: `<g transform="translate(-41 -46) rotate(-20) scale(1.22)">
      <path d="M-3 4L-11 19L-4 17L-1 22L2 6Z" fill="#FF7E9C" ${st(2.6)}/>
      <path d="M3 4L10 19L3 17L0 22L-2 6Z" fill="#FF7E9C" ${st(2.6)}/>
      <path d="M-3 0C-10-15-29-16-29-2C-29 11-12 10-3 3Z" fill="#FF9BB3" ${st()}/>
      <path d="M3 0C10-15 29-16 29-2C29 11 12 10 3 3Z" fill="#FF9BB3" ${st()}/>
      <path d="M-21-4Q-15-6-10-2M21-4Q15-6 10-2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
      <circle cy="1" r="6.4" fill="#FF7E9C" ${st()}/></g>`,
  },
  {
    id: 'beanie', name: '털모자', need: 7, slot: 'head', gift: '기록 7일 선물! 포근한 털모자예요',
    svg: `<g transform="translate(-1 5) scale(1.1)">
      <path d="M-40-44C-42-80-14-94 2-94C24-94 40-78 38-50Z" fill="#FF9F7A" ${st()}/>
      <path d="M-20-84C-14-88-6-90 2-90" fill="none" stroke="#FFC4AC" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M-24-48V-80M-10-46V-90M4-46V-92M18-48V-88M30-50V-78" fill="none" stroke="#E87E5A" stroke-width="2" stroke-linecap="round" opacity=".55"/>
      <path d="M-45-50C-20-38 18-40 43-54L45-41C19-27-21-25-47-36Z" fill="#FFD27A" ${st()}/>
      <path d="M-35-42V-32M-23-38V-28M-11-36V-26M1-36V-26M13-37V-27M25-40V-30M35-45V-35" fill="none" stroke="#E5A63D" stroke-width="2" stroke-linecap="round"/>
      <circle cx="0" cy="-98" r="10" fill="#FFF3E2" ${st()}/></g>`,
  },
  {
    id: 'glasses', name: '동글 안경', need: 10, slot: 'face', gift: '기록 10일 선물! 똑똑해 보이는 동글 안경',
    svg: `<g fill="none" stroke="${INK}" stroke-linecap="round">
      <circle cx="-24" cy="6" r="14" fill="rgba(255,255,255,.28)" stroke-width="3.4"/>
      <circle cx="24" cy="6" r="14" fill="rgba(255,255,255,.28)" stroke-width="3.4"/>
      <path d="M-10 4Q0-3 10 4M-38 3L-52-3M38 3L52-3" stroke-width="3.2"/>
      <path d="M-31-1Q-28-5-23-5M17-1Q20-5 25-5" stroke="#fff" stroke-width="2.2" opacity=".85"/></g>`,
  },
  {
    id: 'headphones', name: '헤드폰', need: 14, slot: 'head', gift: '기록 14일 선물! 같이 음악 들어요',
    svg: `<g>
      <path d="M-86 2C-88-74 88-76 86 2" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>
      <path d="M-86 2C-88-74 88-76 86 2" fill="none" stroke="#8EC7F2" stroke-width="6.6" stroke-linecap="round"/>
      <rect x="-104" y="-14" width="24" height="38" rx="11" fill="#FF8B6D" ${st()}/>
      <rect x="80" y="-14" width="24" height="38" rx="11" fill="#FF8B6D" ${st()}/>
      <path d="M-97-6V14M97-6V14" stroke="#FFC0AE" stroke-width="3" stroke-linecap="round"/></g>`,
  },
  {
    id: 'flowers', name: '꽃 화관', need: 21, slot: 'head', gift: '기록 21일 선물! 꽃 화관을 엮었어요',
    svg: `<g>
      <path d="M-70-30C-56-46-36-52-18-58C-2-63 14-60 28-54C44-49 58-50 70-44" fill="none" stroke="#6EAE69" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M-56-42q-6-8-14-6q4 8 14 6M-8-62q2-10-4-14q-6 8 4 14M38-54q6-9 14-7q-4 8-14 7" fill="#8FD47C" ${st(2)}/>
      ${FLOWER(-66, -34, 1.35, '#FF9FB4')}${FLOWER(-40, -50, 1.2, '#FFFFFF', '#FFC14D')}${FLOWER(-16, -60, 1.45, '#FFB98A')}
      ${FLOWER(10, -61, 1.25, '#BDA6F1', '#FFE07A')}${FLOWER(34, -53, 1.4, '#FF9FB4')}${FLOWER(58, -48, 1.15, '#FFFFFF', '#FFC14D')}</g>`,
  },
  {
    id: 'crown', name: '왕관', need: 30, slot: 'head', gift: '기록 30일 선물! 반짝이는 왕관이에요',
    svg: `<g transform="translate(-4 -56) rotate(-8)">
      <path d="M-24 2L-28-28L-13-14L-1-36L10-14L25-28L21 2Z" fill="#FFD54F" ${st()}/>
      <path d="M-23-6H20" fill="none" stroke="#F2B53C" stroke-width="3"/>
      <circle cx="-28" cy="-30" r="4" fill="#FF8B6D" ${st(2.4)}/><circle cx="-1" cy="-38" r="4.4" fill="#8EC7F2" ${st(2.4)}/><circle cx="25" cy="-30" r="4" fill="#9ADDB2" ${st(2.4)}/>
      <path d="M-17-18L-15-12" stroke="#FFF3C6" stroke-width="2.6" stroke-linecap="round"/></g>`,
  },
  {
    id: 'wizard', name: '마법사 모자', need: 50, slot: 'head', gift: '기록 50일 선물! 마음을 읽는 마법사 모자예요',
    svg: `<g transform="translate(-3 -50) rotate(-8) scale(1.3)">
      <path d="M-26 0L-2-66C2-74 12-74 16-68C11-70 7-67 6-62L24 0Z" fill="#8E7BD6" ${st()}/>
      <path d="M-44 2C-24 12 24 12 44 2C34-8-34-8-44 2Z" fill="#7E6BC4" ${st()}/>
      <path d="M-22-10C-8-6 8-6 22-10L19-2C6 1-6 1-19-2Z" fill="#FFD54F" ${st(2.4)}/>
      <path d="M-6-40l1.6 3.4 3.7.4-2.8 2.5.8 3.7-3.3-1.9-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z" fill="#FFE16E" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
      <circle cx="8" cy="-24" r="2.4" fill="#FFF3C6"/><circle cx="-10" cy="-20" r="1.8" fill="#FFF3C6"/><circle cx="4" cy="-50" r="1.6" fill="#FFF3C6"/></g>`,
  },
  {
    id: 'catears', name: '고양이 귀', need: 70, slot: 'head', gift: '기록 70일 선물! 쫑긋 고양이 귀예요',
    svg: `<g>
      <path d="M-42-40L-46-80L-14-58Z" fill="#FFF7EE" ${st()}/>
      <path d="M-38-48L-40-70L-22-57Z" fill="#FFB3C4"/>
      <path d="M12-60L36-84L36-46Z" fill="#FFF7EE" ${st()}/>
      <path d="M18-58L32-74L32-52Z" fill="#FFB3C4"/></g>`,
  },
  {
    id: 'party', name: '고깔모자', need: 100, slot: 'head', gift: '기록 100일 축하해요! 파티 고깔모자예요',
    svg: `<g transform="translate(-4 -54) rotate(-10) scale(1.15)">
      <path d="M-20 0L0-52L20 0Z" fill="#FFD25E" ${st()}/>
      <path d="M-14-14L6-36M-8 0L13-25M-17-28L-4-43" fill="none" stroke="#FF8B6D" stroke-width="5" stroke-linecap="round"/>
      <path d="M-20 0L0-52L20 0Z" fill="none" ${st()}/>
      <path d="M-24 2Q0 9 24 2" fill="none" ${st(3.4)}/>
      <circle cy="-55" r="8" fill="#FF9BB3" ${st(2.6)}/>
      <circle cx="-3" cy="-57" r="2.4" fill="#fff" opacity=".8"/></g>`,
  },
  {
    id: 'sunglasses', name: '선글라스', need: 150, slot: 'face', gift: '기록 150일 선물! 멋쟁이 선글라스예요',
    svg: `<g>
      <path d="M-40-4H-9Q-8 12-22 15Q-38 15-40-4Z" fill="#3B2F2A" ${st(3)}/>
      <path d="M9-4H40Q38 15 22 15Q8 12 9-4Z" fill="#3B2F2A" ${st(3)}/>
      <path d="M-9-2Q0-6 9-2M-40-3L-52-8M40-3L52-8" fill="none" stroke="#46352D" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M-33 1L-24 1M16 1L25 1" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".75"/></g>`,
  },
];
export const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

/** 입은 소품 목록으로 정리: 옛 데이터(문자열 하나)도 받는다. 칸(머리·얼굴)마다 하나, 열린 것만. */
export function wearList(v, n = Infinity) {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  const bySlot = {};
  for (const id of arr) {
    const it = ITEM[id];
    if (!it || n < it.need) continue;
    bySlot[it.slot] = id;
  }
  return ['face', 'head'].map((sl) => bySlot[sl]).filter(Boolean);
}
/** 입은 소품의 SVG (얼굴 → 머리 순, 없으면 빈 문자열). 문자열 하나나 목록 모두 받는다. */
export const wearSVG = (v) => wearList(v).map((id) => ITEM[id].svg).join('');
/** 소품 하나를 입거나 벗긴다(같은 칸의 다른 소품은 벗긴다). 반환: 새 목록 */
export function toggleWear(list, id) {
  const cur = wearList(list);
  if (cur.includes(id)) return cur.filter((x) => x !== id);
  const slot = ITEM[id] && ITEM[id].slot;
  return [...cur.filter((x) => ITEM[x].slot !== slot), id];
}
/** 기록 n일로 열린 소품들 */
export const unlockedBy = (n) => ITEMS.filter((it) => n >= it.need);
/** 아직 본 적 없는 선물 (열린 것 중 seen에 없는 것) */
export const newGifts = (n, seen = []) => unlockedBy(n).filter((it) => !seen.includes(it.id));
/** 다음에 열릴 소품 */
export const nextItem = (n) => ITEMS.find((it) => n < it.need) || null;
/** 머리 위로 높이 올라가는 소품(그림 틀 위쪽을 넓혀야 함) */
export const TALL = { beanie: 1, wizard: 1, sprout: 1, crown: 1, catears: 1, party: 1 };
export const isTall = (v) => wearList(v).some((id) => TALL[id]);
