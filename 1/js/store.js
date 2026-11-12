// 기록 저장소. 서버 없이 이 기기의 localStorage에만 저장한다.

import { addDays, isValidKey, rng, hash, todayKey } from './util.js';
import { isWeather, WEATHERS } from './weather.js';

const params = new URLSearchParams(location.search);
// 체험 모드는 별도 칸에 저장되어 실제 기록과 절대 섞이지 않는다.
export const DEMO = params.has('demo');
const KEY = DEMO ? 'gibun-nalssi.demo.v1' : 'gibun-nalssi.v1';

export const MEMO_MAX = 60;

const blank = () => ({ v: 1, entries: {}, seen: {}, flags: {} });
const cleanMemo = (m) => (typeof m === 'string' ? m.replace(/[\r\n]+/g, ' ').trim().slice(0, MEMO_MAX) : '');

function sanitize(raw) {
  const out = blank();
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, e] of Object.entries(raw.entries || {})) {
    if (isValidKey(k) && e && isWeather(e.w)) {
      out.entries[k] = { w: e.w, memo: cleanMemo(e.memo), t: Number(e.t) || 0 };
    }
  }
  for (const k of Object.keys(raw.seen || {})) if (isValidKey(k)) out.seen[k] = true;
  for (const k of Object.keys(raw.flags || {})) {
    if (/^[a-z0-9-]{1,40}$/.test(k)) out.flags[k] = true;
  }
  return out;
}

let state = blank();
let writable = true;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

function read() {
  let text = null;
  try {
    text = localStorage.getItem(KEY);
  } catch {
    writable = false;
    return blank();
  }
  if (!text) return blank();
  try {
    return sanitize(JSON.parse(text));
  } catch {
    // 손상된 기록은 지우지 않고 옆에 보관해 둔다
    try {
      localStorage.setItem(`${KEY}.corrupt`, text);
    } catch {
      /* 보관 실패는 무시 */
    }
    return blank();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    writable = true;
    return true;
  } catch {
    writable = false;
    return false;
  }
}

export const isWritable = () => writable;

export function load() {
  state = read();
  if (DEMO) seedDemo();
  // 브라우저가 공간 부족 시 기록을 지우지 않도록 요청한다
  try {
    navigator.storage?.persist?.();
  } catch {
    /* 지원하지 않는 브라우저 */
  }
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    state = read();
    notify();
  }
});

export const get = (k) => state.entries[k] || null;

export function set(k, { w, memo = '' }) {
  if (!isValidKey(k) || !isWeather(w)) return false;
  state.entries[k] = { w, memo: cleanMemo(memo), t: Date.now() };
  const ok = persist();
  notify();
  return ok;
}

export function remove(k) {
  delete state.entries[k];
  const ok = persist();
  notify();
  return ok;
}

export const all = () =>
  Object.keys(state.entries)
    .sort()
    .map((key) => ({ key, ...state.entries[key] }));

export const count = () => Object.keys(state.entries).length;

export function streak() {
  let k = todayKey();
  if (!state.entries[k]) k = addDays(k, -1);
  let n = 0;
  while (state.entries[k]) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

export const isSeen = (mon) => !!state.seen[mon];
export function markSeen(mon) {
  if (state.seen[mon]) return;
  state.seen[mon] = true;
  persist();
}

export const flag = (name) => !!state.flags[name];
export function setFlag(name) {
  state.flags[name] = true;
  persist();
}

export const exportData = () =>
  JSON.stringify({ app: '기분날씨', exportedAt: new Date().toISOString(), ...state }, null, 2);

// 가져오기는 합치기다. 같은 날짜는 더 나중에 수정한 기록을 남겨 어느 쪽도 함부로 잃지 않는다.
export function importData(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !parsed.entries) throw new Error('형식이 맞지 않아요');
  const incoming = sanitize(parsed);
  let added = 0;
  let updated = 0;
  for (const [k, e] of Object.entries(incoming.entries)) {
    const mine = state.entries[k];
    if (!mine) {
      state.entries[k] = e;
      added++;
    } else if (e.t > mine.t) {
      state.entries[k] = e;
      updated++;
    }
  }
  Object.assign(state.seen, incoming.seen);
  Object.assign(state.flags, incoming.flags);
  persist();
  notify();
  return { added, updated };
}

export function clearAll() {
  state = blank();
  persist();
  notify();
}

/* 체험용 기록: 오늘은 비워 두어 첫 기록 흐름을 그대로 눌러 볼 수 있게 한다 */
function seedDemo() {
  const today = todayKey();
  if (state.flags[`seeded-${today.replace(/-/g, '')}`.slice(0, 40)]) return;
  const R = rng(hash(`demo${today}`));
  const memos = {
    rainbow: ['친구가 깜짝 선물을 보냈다', '드디어 합격 소식!', '가족이랑 저녁 먹으며 실컷 웃었다', '오래 기다린 연락이 왔다'],
    clear: ['점심에 산책했는데 바람이 좋았다', '오랜만에 푹 잤다', '커피가 유난히 맛있었어', '칭찬 한마디에 하루가 좋아짐', '퇴근길 노을이 예뻤다'],
    cloud: ['그냥저냥 평범한 하루', '회의가 많았지만 괜찮았다', '점심 메뉴 고르다 하루 다 감', '별일 없었다'],
    snow: ['혼자 조용히 책 읽었다', '따뜻한 차 한 잔', '말없이 창밖만 봤다'],
    wind: ['할 일이 밀려서 정신없었다', '약속 세 개를 연달아', '이사 준비로 바쁨'],
    fog: ['머리가 멍해서 아무것도 못 했다', '뭘 해야 할지 모르겠는 날', '잠이 덜 깬 채로 하루가 갔다'],
    rain: ['괜히 눈물이 났다', '친구랑 오해가 생겼다', '집에 오는 길이 유난히 길었다'],
    thunder: ['지하철에서 발 밟히고 사과도 못 받음', '회의에서 말 끊겨서 너무 화났다', '택배가 또 분실됨'],
  };
  const weights = { rainbow: 1, clear: 6, cloud: 4, snow: 1.4, wind: 2.2, fog: 1.6, rain: 2.2, thunder: 1 };
  const ids = WEATHERS.map((w) => w.id);
  const roll = () => {
    let total = 0;
    for (const id of ids) total += weights[id];
    let x = R() * total;
    for (const id of ids) {
      x -= weights[id];
      if (x <= 0) return id;
    }
    return 'clear';
  };
  state = blank();
  for (let i = 1; i <= 84; i++) {
    const k = addDays(today, -i);
    if (i > 3 && R() < 0.07) continue;
    const w = roll();
    const memo = R() < 0.78 ? memos[w][Math.floor(R() * memos[w].length)] : '';
    state.entries[k] = { w, memo, t: 1 };
  }
  state.flags[`seeded-${today.replace(/-/g, '')}`.slice(0, 40)] = true;
  persist();
}
