// 날짜는 언제나 '이 기기의 현지 날짜'로 다룬다. toISOString()은 UTC라서 쓰지 않는다.
export const pad = (n) => String(n).padStart(2, '0');
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
export const todayKey = () => keyOf(new Date());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
/** 월요일 시작 주의 월요일 */
export const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
export const weekKeys = (monday) => Array.from({ length: 7 }, (_, i) => keyOf(addDays(monday, i)));
export const isValidKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && keyOf(parseKey(k)) === k;

export const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const fmtMD = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
export const fmtFull = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일`;
export const fmtYM = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`;

/** 일요일 시작 달력 칸(앞뒤 달 날짜 포함, 7의 배수) */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = addDays(first, -first.getDay());
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((first.getDay() + days) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => addDays(start, i));
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return '고요한 밤이에요';
  if (h < 11) return '좋은 아침이에요';
  if (h < 17) return '좋은 오후예요';
  if (h < 21) return '좋은 저녁이에요';
  return '편안한 밤이에요';
}

/** 하늘 색에 쓰는 시간대: 0 낮, 1 노을, 2 밤 */
export function dayPhase(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 6.5 && h < 17) return 'day';
  if ((h >= 17 && h < 19.5) || (h >= 5 && h < 6.5)) return 'dusk';
  return 'night';
}
