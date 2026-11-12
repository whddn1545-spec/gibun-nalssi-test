// 저장: localStorage, 스키마 버전, 손상 복구, 백업·복원(날짜별 합치기·직전 사본·되돌리기), 예시 데이터 분리.
import { WEATHERS } from './palette.js';
import { now, dayKey } from './dates.js';
export const KEY = 'kibun-nalssi';
export const UNDO_KEY = KEY + '.undo'; // 복원 직전 기록 사본(되돌리기용). KEY로 시작하므로 전체 삭제 때 같이 지워진다
export const SCHEMA = 1;
let mem = null;          // 실제 기록
let sample = null;       // 예시 데이터(메모리에만)
let damaged = false;

const blank = () => ({ schema: SCHEMA, days: {}, meta: { intro: 0 }, name: '' });
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const T_MIN = -4, T_MAX = 36; // 마음 온도 전체 범위(today.js RANGES: 눈 -4 ~ 천둥 36)
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
// 실제 있는 날짜만('2026-02-31'은 거부)
function realKey(k) {
  if (typeof k !== 'string' || !KEY_RE.test(k)) return false;
  const [y, m, d] = k.split('-').map(Number), dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
function cleanDay(r) {
  if (!r || typeof r !== 'object' || !WEATHERS.includes(r.w)) return null;
  return { w: r.w, memo: typeof r.memo === 'string' ? r.memo.slice(0, 50) : '', t: Number.isFinite(r.t) ? r.t : null, at: Number.isFinite(r.at) ? r.at : 0, up: Number.isFinite(r.up) ? r.up : 0 };
}
// 백업 파일 항목(엄격): 실제 있는 지난 날짜, 날씨 6종, 메모는 50자 이하 문자열, t는 범위 안 숫자. 하나라도 어긋나면 건너뛴다
function strictDay(k, r, todayKey) {
  if (!realKey(k) || k > todayKey || !isObj(r) || !WEATHERS.includes(r.w)) return null;
  if (r.memo != null && (typeof r.memo !== 'string' || r.memo.length > 50)) return null;
  if (r.t != null && !(Number.isFinite(r.t) && r.t >= T_MIN && r.t <= T_MAX)) return null;
  const n = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
  return { w: r.w, memo: r.memo || '', t: r.t == null ? null : r.t, at: n(r.at), up: n(r.up) };
}
// meta 형식 검사: 아는 키만, 목록은 배열(아니면 기본값)
function cleanMeta(m) {
  const out = { intro: 0 };
  if (!isObj(m)) return out;
  if (m.intro) out.intro = 1;
  for (const k of ['seen', 'bandOff']) if (Array.isArray(m[k])) out[k] = m[k].filter((v) => realKey(v));
  if (realKey(m.installNudge)) out.installNudge = m.installNudge;
  return out;
}
function normalize(o) {
  const out = blank(); let lost = false;
  if (!o || typeof o !== 'object') return { out, lost: true };
  if (o.days && typeof o.days === 'object') {
    for (const [k, v] of Object.entries(o.days)) { const c = realKey(k) ? cleanDay(v) : null; if (c) out.days[k] = c; else lost = true; }
  }
  out.meta = cleanMeta(o.meta);
  if (typeof o.name === 'string') out.name = o.name.slice(0, 20);
  return { out, lost };
}
export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { mem = blank(); return; }
  if (!raw) { mem = blank(); return; }
  try {
    const { out, lost } = normalize(JSON.parse(raw));
    mem = out; if (lost) { damaged = true; backupBroken(raw); persist(); }
  } catch (e) {
    damaged = true; backupBroken(raw); mem = blank();
  }
}
function backupBroken(raw) { try { localStorage.setItem(KEY + '.broken.' + Date.now(), raw); } catch (e) { /* 공간 없음 */ } }
const isFull = (e) => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); return { ok: true }; }
  catch (e) { return { ok: false, full: isFull(e) }; }
}
export const isDamaged = () => damaged;
const src = () => (sample ? sample : mem.days);
export function getDay(k) { return src()[k] || null; }
export function allDays() { return src(); }
export function count() { return Object.keys(src()).length; }
export function setDay(k, rec) {
  const c = cleanDay({ ...rec, at: (getDay(k) || {}).at || Date.now(), up: Date.now() });
  if (!c) return { ok: false };
  if (sample) { sample[k] = c; return { ok: true }; } // 예시 데이터는 실제 기록을 바꾸지 않는다
  const prev = mem.days[k]; mem.days[k] = c;
  const r = persist(); if (!r.ok) { if (prev) mem.days[k] = prev; else delete mem.days[k]; }
  return r;
}
export function deleteDay(k) { if (sample) { delete sample[k]; return { ok: true }; } const prev = mem.days[k]; delete mem.days[k]; const r = persist(); if (!r.ok && prev) mem.days[k] = prev; return r; }
export function getMeta(k) { return mem.meta[k]; }
export function setMeta(k, v) { mem.meta[k] = v; return persist(); }
export function exportJSON() { return JSON.stringify({ app: 'kibun-nalssi', schema: SCHEMA, exported: Date.now(), days: mem.days, name: mem.name }, null, 1); }
// 백업 파일 검사: 앱·스키마·형식. 합칠 항목 days, 그 수 n, 지금 기록과 날짜가 겹치는 수 m, 건너뛴 항목 수 skipped
export function checkBackup(text) {
  let o; try { o = JSON.parse(text); } catch (e) { return { ok: false }; }
  if (!isObj(o) || o.app !== 'kibun-nalssi' || !isObj(o.days)) return { ok: false };
  if (o.schema != null && !(Number.isFinite(o.schema) && o.schema >= 1 && o.schema <= SCHEMA)) return { ok: false };
  const tk = dayKey(now()), days = {}; let skipped = 0, m = 0;
  for (const [k, v] of Object.entries(o.days)) { const c = strictDay(k, v, tk); if (!c) { skipped++; continue; } days[k] = c; if (mem.days[k]) m++; }
  return { ok: true, n: Object.keys(days).length, m, skipped, days, name: typeof o.name === 'string' ? o.name.slice(0, 20) : '' };
}
// 복원 = 날짜별 합치기. 같은 날짜면 나중에 고친 쪽(up이 큰 쪽), 지금만 있는 날은 그대로. 이름은 지금 비어 있을 때만 파일 것.
// 바꾸기 전에 지금 기록 사본을 UNDO_KEY에 남긴다(못 남기면 복원하지 않음). 저장이 실패하면 메모리·사본을 원래대로 돌린다.
export function importJSON(text) {
  const chk = checkBackup(text);
  if (!chk.ok || !chk.n) return { ok: false, bad: true };
  const prev = mem, days = { ...mem.days }, wrote = {};
  for (const [k, c] of Object.entries(chk.days)) { const cur = days[k]; if (!cur || c.up > cur.up) { days[k] = c; wrote[k] = c.up; } }
  const name = mem.name || chk.name;
  // 바뀌는 날도 이름도 없으면(이미 다 들어 있는 파일) 직전 사본을 덮어쓰지 않고 저장도 하지 않는다(fix2b, 재검증 경미)
  if (!Object.keys(wrote).length && name === mem.name) return { ok: true, n: chk.n, m: chk.m, skipped: chk.skipped, same: true };
  let oldUndo = null; try { oldUndo = localStorage.getItem(UNDO_KEY); } catch (e) { /* 저장소 없음 */ }
  try { localStorage.setItem(UNDO_KEY, JSON.stringify({ at: Date.now(), days: mem.days, name: mem.name, wrote, restoredName: name })); }
  catch (e) { return { ok: false, full: isFull(e) }; }
  mem = { ...mem, days, name };
  const r = persist();
  if (!r.ok) {
    mem = prev;
    try { if (oldUndo == null) localStorage.removeItem(UNDO_KEY); else localStorage.setItem(UNDO_KEY, oldUndo); }
    catch (e) { try { localStorage.removeItem(UNDO_KEY); } catch (e2) { /* 저장소 없음 */ } }
    return r;
  }
  return { ok: true, n: chk.n, m: chk.m, skipped: chk.skipped };
}
function readUndo() {
  try { const s = JSON.parse(localStorage.getItem(UNDO_KEY) || 'null'); return isObj(s) && isObj(s.days) && isObj(s.wrote) ? s : null; }
  catch (e) { return null; }
}
export const hasUndo = () => !!readUndo();
// 복원 되돌리기: 그 복원이 쓴 날 가운데 그 뒤로 손대지 않은 날만 복원 직전으로 돌린다(복원 뒤에 남기거나 고친 기록은 그대로)
export function undoRestore() {
  const s = readUndo(); if (!s) return { ok: false };
  const prev = mem, days = { ...mem.days };
  for (const [k, up] of Object.entries(s.wrote)) {
    const cur = days[k]; if (!cur || cur.up !== up) continue;
    const old = realKey(k) ? cleanDay(s.days[k]) : null;
    if (old) days[k] = old; else delete days[k];
  }
  const name = mem.name === s.restoredName && typeof s.name === 'string' ? s.name.slice(0, 20) : mem.name;
  mem = { ...mem, days, name };
  const r = persist(); if (!r.ok) { mem = prev; return r; }
  try { localStorage.removeItem(UNDO_KEY); } catch (e) { /* 저장소 없음 */ }
  return { ok: true };
}
export function startSample(days) { sample = { ...days }; }
export function endSample() { sample = null; }
export const inSample = () => !!sample;
let asked = false;
export function requestPersist() { if (asked) return; asked = true; try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch (e) { /* 지원 안 함 */ } }
// 4d: 이름, 전체 삭제(이 앱의 모든 키 + 따로 받은 키)
export function getName() { return (mem && mem.name) || ''; }
export function setName(v) { mem.name = String(v || '').slice(0, 20); return persist(); }
export function clearAll(extraKeys = []) {
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(KEY) || extraKeys.includes(k)) localStorage.removeItem(k); } catch (e) { /* 저장소 없음 */ }
  mem = blank(); sample = null; damaged = false;
}
