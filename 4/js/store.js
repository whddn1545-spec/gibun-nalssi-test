// 기록 저장소: 이 기기의 localStorage 하나의 키에 JSON으로 둔다. 서버로 보내지 않는다.
// 여러 창(설치한 앱 + 브라우저 탭)이 같은 저장소를 쓰므로, 쓸 때마다 최신 내용을 다시 읽고 고친 뒤 쓴다.
import { isValidKey } from './dates.js';
import { WEATHER_IDS } from './weather.js';

export const KEY = 'kibun-weather:v1';
const BROKEN_PREFIX = 'kibun-weather:broken-';
export const MEMO_MAX = 40; // 입력칸 maxlength와 같은 기준(UTF-16 길이)

let state = blank();
const listeners = new Set();
/** 앱이 켜질 때 생긴 문제: null | 'corrupt' | 'unavailable' */
export let loadProblem = null;

function blank() {
  return { v: 1, entries: {}, meta: {} };
}
const clone = (o) => JSON.parse(JSON.stringify(o));

/** 한 줄·40자로 정리. 이모지(서로게이트 쌍)를 반쪽으로 자르지 않는다. */
export function cleanMemo(s) {
  const one = String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (one.length <= MEMO_MAX) return one;
  let out = '';
  for (const ch of one) {
    if (out.length + ch.length > MEMO_MAX) break;
    out += ch;
  }
  return out.trim();
}

function normalize(d) {
  const out = blank();
  const src = d && typeof d.entries === 'object' && d.entries && !Array.isArray(d.entries) ? d.entries : {};
  for (const [k, e] of Object.entries(src)) {
    if (!isValidKey(k) || !e || typeof e !== 'object' || !WEATHER_IDS.includes(e.w)) continue;
    out.entries[k] = { w: e.w, m: cleanMemo(e.m), t: Number(e.t) || 0 };
  }
  if (d && typeof d.meta === 'object' && d.meta && !Array.isArray(d.meta)) out.meta = { ...d.meta };
  return out;
}

/** 저장소에서 읽기. 깨져 있으면 원본을 옆에 보관하고 빈 상태로. */
function readStorage({ keepBroken = true } = {}) {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return { ok: false, problem: 'unavailable' };
  }
  if (!raw) return { ok: true, data: blank() };
  try {
    const d = JSON.parse(raw);
    const okShape = d && typeof d === 'object' && !Array.isArray(d) && d.entries && typeof d.entries === 'object'
      && !Array.isArray(d.entries) && (d.v == null || d.v === 1);
    if (!okShape) throw new Error('shape'); // 다른 판(v)이거나 모양이 틀리면 덮어쓰지 않고 보관
    return { ok: true, data: normalize(d) };
  } catch {
    if (keepBroken) {
      try { localStorage.setItem(`${BROKEN_PREFIX}${Date.now()}`, raw); } catch { /* 보관도 못 하면 그대로 */ }
    }
    return { ok: true, data: blank(), problem: 'corrupt' };
  }
}

export function load() {
  const r = readStorage();
  if (!r.ok) {
    loadProblem = r.problem;
    return state;
  }
  state = r.data;
  if (r.problem) {
    loadProblem = r.problem;
    // 깨진 내용은 보관했으니 빈 상태로 덮어 다음부터는 정상으로 연다
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 다음 저장 때 다시 시도 */ }
  }
  return state;
}

function emit(change) {
  for (const fn of listeners) {
    try { fn(change); } catch (e) { console.warn(e); }
  }
}

/**
 * 읽고-고치고-쓰기. 쓰기에 실패하면(저장 공간 부족 등) 바꾸기 전으로 되돌리고 false.
 * fn(state)가 false를 돌려주면 아무것도 쓰지 않는다.
 */
function mutate(fn) {
  const fresh = readStorage({ keepBroken: false });
  if (fresh.ok && !fresh.problem) state = fresh.data;
  const before = clone(state);
  if (fn(state) === false) return true;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('[기분날씨] 저장 실패', e && e.name);
    state = before;
    return false;
  }
}

// 다른 창에서 바뀌면 다시 읽고 화면에 알린다
window.addEventListener('storage', (e) => {
  if (e.key !== null && e.key !== KEY) return;
  const r = readStorage({ keepBroken: false });
  if (r.ok && !r.problem) {
    state = r.data;
    emit({ type: 'external' });
  }
});

export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const getEntry = (k) => state.entries[k] || null;
export const entries = () => state.entries;
export const count = () => Object.keys(state.entries).length;
export const getMeta = (k) => state.meta[k];

/** 그날 기록을 만들거나 고친다. 반환: 저장 성공 여부 (실패하면 그대로 되돌림) */
export function setEntry(k, patch) {
  let next = null;
  const ok = mutate((s) => {
    const prev = s.entries[k];
    const n = { w: prev?.w, m: prev?.m || '', ...patch, t: Date.now() };
    if (!WEATHER_IDS.includes(n.w)) return false;
    n.m = cleanMemo(n.m);
    s.entries[k] = n;
    next = n;
  });
  emit({ type: 'entry', key: k, entry: state.entries[k] || null, ok });
  return ok && !!next;
}

export function removeEntry(k) {
  const ok = mutate((s) => {
    if (!s.entries[k]) return false;
    delete s.entries[k];
  });
  emit({ type: 'remove', key: k, ok });
  return ok;
}

export function setMeta(k, v) {
  return mutate((s) => {
    s.meta[k] = v;
  });
}

export function exportJSON() {
  return JSON.stringify({ app: '기분날씨', exportedAt: new Date().toISOString(), ...state }, null, 2);
}

/**
 * 백업 파일을 합친다. 같은 날짜는 더 최근에 고친 쪽을 남긴다(지금 기록이 더 새것이면 그대로 둔다).
 * 미래 날짜는 들이지 않는다. 반환 {ok, added, updated, kept, future, reason}
 */
export function importJSON(text, todayKey) {
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'parse' };
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, reason: 'parse' };
  const n = normalize(d);
  const keys = Object.keys(n.entries);
  const rawCount = d.entries && typeof d.entries === 'object' && !Array.isArray(d.entries) ? Object.keys(d.entries).length : 0;
  if (!keys.length) return { ok: false, reason: 'empty' };
  const res = { added: 0, updated: 0, kept: 0, future: 0, invalid: Math.max(0, rawCount - keys.length) };
  const ok = mutate((s) => {
    for (const k of keys) {
      if (todayKey && k > todayKey) { res.future++; continue; }
      const cur = s.entries[k];
      const inc = n.entries[k];
      if (!cur) { s.entries[k] = inc; res.added++; }
      else if ((inc.t || 0) > (cur.t || 0)) { s.entries[k] = inc; res.updated++; }
      else if (cur.w !== inc.w || cur.m !== inc.m) res.kept++;
    }
    if (!res.added && !res.updated) return false;
  });
  emit({ type: 'import', ok });
  return { ok, ...res, total: count(), reason: ok ? '' : 'quota' };
}

/** 모두 지우기: 기록과 깨진 원본 사본까지. 설정(본 주 표시 등)은 처음으로. */
export function clearAll() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BROKEN_PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* 저장소를 못 쓰면 아래에서 실패로 알린다 */ }
  const ok = mutate((s) => {
    s.entries = {};
    s.meta = {};
  });
  emit({ type: 'clear', ok });
  return ok;
}

/** 연속 기록 일수 (오늘 또는 어제부터 거꾸로) */
export function streak(todayKey, keyOfFn, addDaysFn, parseKeyFn) {
  let d = parseKeyFn(todayKey);
  if (!state.entries[todayKey]) d = addDaysFn(d, -1);
  let n = 0;
  while (state.entries[keyOfFn(d)]) {
    n++;
    d = addDaysFn(d, -1);
  }
  return n;
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* 지원하지 않으면 그만 */ }
}
