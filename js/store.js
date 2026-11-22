// 기록 저장소: 이 기기의 localStorage 하나의 키에 JSON으로 둔다. 서버로 보내지 않는다.
// 여러 창(설치한 앱 + 브라우저 탭)이 같은 저장소를 쓰므로, 쓸 때마다 최신 내용을 다시 읽고 고친 뒤 쓴다.
// 앱(네이티브)에서는 기기 설정 저장소(Preferences)에 한 벌 더 두고, 켤 때 둘을 날짜별로 합친다(reconcile).
import { isValidKey } from './dates.js';
import { WEATHER_IDS, cleanFeel } from './weather.js';

export const KEY = 'kibun-weather:v1';
const BROKEN_PREFIX = 'kibun-weather:broken-';
export const MEMO_MAX = 40; // 입력칸 maxlength와 같은 기준(UTF-16 길이)
const VERSION = 1;

let state = blank();
const listeners = new Set();
const persisters = new Set();
/** 설정처럼 '모든 기록 지우기'에도 남겨 두는 meta 키 */
const KEEP_ON_CLEAR = ['remind', 'haptics', 'fontScale', 'calm', 'dayStart', 'birthday'];
/** 백업을 가져올 때 지금 값이 없으면 되살리는 meta 키 */
const IMPORT_META = ['wear', 'fontScale', 'haptics', 'calm', 'dayStart', 'birthday'];
/** 앱이 켜질 때 생긴 문제: null | 'corrupt' | 'unavailable' | 'newer' */
export let loadProblem = null;
/** 더 새 판의 앱이 쓴 데이터면 덮어쓰지 않는다(읽기만) */
let readOnly = false;
export const isReadOnly = () => readOnly;

function blank() {
  return { v: VERSION, entries: {}, meta: {} };
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

/** 한 날의 기록 정리. 모르는 칸(다음 판에서 더한 것)은 버리지 않고 그대로 둔다. */
function cleanEntry(e) {
  const { w, m, t, f, ...rest } = e;
  const n = { ...rest, w, m: cleanMemo(m), t: Number(t) || 0 };
  const ff = cleanFeel(w, f);
  if (ff.length) n.f = ff;
  return n;
}

function normalize(d) {
  const out = blank();
  const src = d && typeof d.entries === 'object' && d.entries && !Array.isArray(d.entries) ? d.entries : {};
  for (const [k, e] of Object.entries(src)) {
    if (!isValidKey(k) || !e || typeof e !== 'object' || !WEATHER_IDS.includes(e.w)) continue;
    out.entries[k] = cleanEntry(e);
  }
  if (d && typeof d.meta === 'object' && d.meta && !Array.isArray(d.meta)) out.meta = { ...d.meta };
  return out;
}

/** JSON 문자열을 검사해 읽는다. 반환 { ok, data, newer } (모양이 틀리면 ok:false) */
function parse(raw) {
  try {
    const d = JSON.parse(raw);
    const okShape = d && typeof d === 'object' && !Array.isArray(d) && d.entries && typeof d.entries === 'object' && !Array.isArray(d.entries);
    if (!okShape) return { ok: false };
    if (d.v != null && d.v !== VERSION) {
      if (typeof d.v === 'number' && d.v > VERSION) return { ok: true, data: normalize(d), newer: true };
      return { ok: false };
    }
    return { ok: true, data: normalize(d) };
  } catch {
    return { ok: false };
  }
}

function keepBrokenCopy(raw) {
  try { localStorage.setItem(`${BROKEN_PREFIX}${Date.now()}`, raw); } catch { /* 보관도 못 하면 그대로 */ }
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
  const p = parse(raw);
  if (p.ok) return { ok: true, data: p.data, problem: p.newer ? 'newer' : null };
  if (keepBroken) keepBrokenCopy(raw);
  return { ok: true, data: blank(), problem: 'corrupt' };
}

/** 같은 날짜는 더 최근(t)에 고친 쪽, 설정은 a 우선·없는 것만 b에서. 본 선물은 합친다. */
function mergeData(a, b) {
  const out = clone(a);
  for (const [k, e] of Object.entries(b.entries)) {
    const cur = out.entries[k];
    if (!cur || (e.t || 0) > (cur.t || 0)) out.entries[k] = clone(e);
  }
  for (const [k, v] of Object.entries(b.meta || {})) {
    if (out.meta[k] === undefined) out.meta[k] = clone(v);
  }
  const seen = [...new Set([...(a.meta.seenGifts || []), ...(b.meta.seenGifts || [])])];
  if (seen.length) out.meta.seenGifts = seen;
  return out;
}

/**
 * 앱을 켤 때 웹 저장소와 기기 설정 저장소(savedRaw)를 맞춘다. store.load() 전에 부른다.
 * - 웹 저장소가 비었거나 깨졌으면 기기 사본으로 되살린다(깨진 것은 옆에 보관).
 * - 둘 다 멀쩡하면 날짜별로 더 최근 기록을 합친다(어느 쪽도 기록이 줄지 않는다).
 * 반환: 기기 저장소에 다시 써 둘 JSON 문자열(없으면 null), 그리고 무엇을 했는지.
 */
export function reconcile(savedRaw) {
  let localRaw = null;
  try { localRaw = localStorage.getItem(KEY); } catch { return { raw: null, action: 'unavailable' }; }
  const L = localRaw ? parse(localRaw) : null;
  const S = savedRaw ? parse(savedRaw) : null;
  if ((L && L.newer) || (S && S.newer)) return { raw: null, action: 'newer' };
  const lOk = L && L.ok;
  const sOk = S && S.ok;
  if (!lOk && !sOk) return { raw: null, action: localRaw ? 'both-bad' : 'empty' };
  if (lOk && !sOk) return { raw: localRaw, action: 'local' };
  if (!lOk && sOk) {
    if (localRaw) keepBrokenCopy(localRaw);
    try { localStorage.setItem(KEY, JSON.stringify(S.data)); } catch { return { raw: null, action: 'unavailable' }; }
    return { raw: null, action: 'restored' };
  }
  const merged = mergeData(L.data, S.data);
  const out = JSON.stringify(merged);
  const changedLocal = out !== JSON.stringify(L.data);
  if (changedLocal) {
    try { localStorage.setItem(KEY, out); } catch { /* 다음 저장 때 다시 */ }
  }
  return { raw: out === savedRaw ? null : out, action: changedLocal ? 'merged' : 'same' };
}

export function load() {
  const r = readStorage();
  if (!r.ok) {
    loadProblem = r.problem;
    return state;
  }
  state = r.data;
  if (r.problem === 'newer') {
    loadProblem = 'newer';
    readOnly = true;
    return state;
  }
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
  if (readOnly) return false;
  const fresh = readStorage({ keepBroken: false });
  if (fresh.ok && !fresh.problem) state = fresh.data;
  if (fresh.problem === 'newer') { readOnly = true; return false; }
  const before = clone(state);
  if (fn(state) === false) return true;
  try {
    const raw = JSON.stringify(state);
    localStorage.setItem(KEY, raw);
    for (const p of persisters) {
      try { p(raw); } catch (err) { console.warn(err); }
    }
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
/** 저장에 성공할 때마다 JSON 문자열을 받는다 (네이티브 이중 저장용) */
export const onPersist = (fn) => (persisters.add(fn), () => persisters.delete(fn));
export const rawState = () => JSON.stringify(state);
export const getEntry = (k) => state.entries[k] || null;
export const entries = () => state.entries;
export const count = () => Object.keys(state.entries).length;
export const getMeta = (k) => state.meta[k];

/** 그날 기록을 만들거나 고친다. 반환: 저장 성공 여부 (실패하면 그대로 되돌림) */
export function setEntry(k, patch) {
  let next = null;
  const ok = mutate((s) => {
    const prev = s.entries[k];
    const n = { ...(prev || {}), w: prev?.w, m: prev?.m || '', f: prev?.f, ...patch, t: Date.now() };
    if (!WEATHER_IDS.includes(n.w)) return false;
    n.m = cleanMemo(n.m);
    // 날씨가 바뀌면 새 날씨에 없는 마음 단어는 정리한다
    const f = cleanFeel(n.w, n.f);
    if (f.length) n.f = f;
    else delete n.f;
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

/** 깨져서 따로 보관해 둔 원본들 (백업 파일에 함께 넣어 꺼낼 수 있게) */
function brokenCopies() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BROKEN_PREFIX)) out.push({ at: Number(k.slice(BROKEN_PREFIX.length)) || 0, raw: localStorage.getItem(k) });
    }
  } catch { /* 없음 */ }
  return out;
}

export function exportJSON() {
  const broken = brokenCopies();
  return JSON.stringify({ app: '기분날씨', exportedAt: new Date().toISOString(), ...state, ...(broken.length ? { broken } : {}) }, null, 2);
}

/**
 * 백업 파일을 합친다. 같은 날짜는 더 최근에 고친 쪽을 남긴다(지금 기록이 더 새것이면 그대로 둔다).
 * 미래 날짜는 들이지 않는다. 지금 값이 없는 설정(입은 소품·글자 크기·진동 등)과 본 선물도 되살린다.
 * 반환 {ok, added, updated, kept, future, invalid, meta, reason}
 */
export function importJSON(text, todayKey) {
  let d;
  try {
    d = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { ok: false, reason: 'parse' };
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, reason: 'parse' };
  const n = normalize(d);
  const keys = Object.keys(n.entries);
  const rawCount = d.entries && typeof d.entries === 'object' && !Array.isArray(d.entries) ? Object.keys(d.entries).length : 0;
  if (!keys.length) return { ok: false, reason: 'empty' };
  const res = { added: 0, updated: 0, kept: 0, future: 0, invalid: Math.max(0, rawCount - keys.length), meta: 0 };
  const ok = mutate((s) => {
    for (const k of keys) {
      if (todayKey && k > todayKey) { res.future++; continue; }
      const cur = s.entries[k];
      const inc = n.entries[k];
      if (!cur) { s.entries[k] = inc; res.added++; }
      else if ((inc.t || 0) > (cur.t || 0)) { s.entries[k] = inc; res.updated++; }
      else if (cur.w !== inc.w || cur.m !== inc.m || String(cur.f || '') !== String(inc.f || '')) res.kept++;
    }
    const im = n.meta || {};
    for (const k of IMPORT_META) {
      if (im[k] !== undefined && im[k] !== '' && (s.meta[k] === undefined || s.meta[k] === '' || (Array.isArray(s.meta[k]) && !s.meta[k].length))) {
        s.meta[k] = clone(im[k]);
        res.meta++;
      }
    }
    if (Array.isArray(im.seenGifts)) {
      const seen = [...new Set([...(s.meta.seenGifts || []), ...im.seenGifts])];
      if (seen.length !== (s.meta.seenGifts || []).length) { s.meta.seenGifts = seen; res.meta++; }
    }
    if (!res.added && !res.updated && !res.meta) return false;
  });
  emit({ type: 'import', ok });
  return { ok, ...res, total: count(), reason: ok ? '' : 'quota' };
}

/** 모두 지우기: 기록과 깨진 원본 사본까지. 본 주 표시·옷장 등은 처음으로, 알림·진동·글자 크기 같은 설정은 남긴다. */
export function clearAll() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BROKEN_PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* 저장소를 못 쓰면 아래에서 실패로 알린다 */ }
  const ok = mutate((s) => {
    s.entries = {};
    const keep = {};
    for (const k of KEEP_ON_CLEAR) if (s.meta[k] !== undefined) keep[k] = s.meta[k];
    s.meta = keep;
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
