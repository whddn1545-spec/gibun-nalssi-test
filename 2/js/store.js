// 기기 안에만 저장되는 기록 저장소와 날짜 도구.
// 날짜 문자열은 항상 기기 현지 시각 기준 'YYYY-MM-DD'다. toISOString()은 쓰지 않는다.

import { WEATHER_IDS, isWeather } from './weather.js';

const RECORDS_KEY = 'gibun.records.v1';
const META_KEY = 'gibun.meta.v1';
export const MEMO_MAX = 60;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ── 날짜 ─────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');

export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayStr = () => toDateStr(new Date());

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// 그 주의 월요일
export function weekStart(str) {
  const day = parseDate(str).getDay();
  return addDays(str, day === 0 ? -6 : 1 - day);
}

export const weekdayOf = (str) => WEEKDAYS[parseDate(str).getDay()];

export function formatKo(str, { weekday = true } = {}) {
  const d = parseDate(str);
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return weekday ? `${base} ${WEEKDAYS[d.getDay()]}요일` : base;
}

// ── 저장 ─────────────────────────────────────────────
// 시크릿 모드 등에서 저장이 막혀도 앱이 죽지 않도록 메모리로 대체한다.
// memory에는 저장에 실패한 값만 들어가므로, 값이 있으면 그것이 가장 최신이다.

const memory = new Map();

function readJSON(key, fallback) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    memory.delete(key);
  } catch {
    memory.set(key, value);
  }
}

// false면 기록이 이 화면을 닫을 때까지만 남는다.
export const isPersistent = () => memory.size === 0;

function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  return toDateStr(parseDate(str)) === str;
}

// 조합 이모지처럼 여러 코드포인트가 한 글자로 보이는 경우까지 한 글자로 센다.
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;

function graphemes(text) {
  return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);
}

// 입력 중인 메모를 보이는 글자 기준 MEMO_MAX자에서 자른다. 공백은 건드리지 않는다.
export function clipMemo(text) {
  const value = String(text ?? '');
  const parts = graphemes(value);
  return parts.length > MEMO_MAX ? parts.slice(0, MEMO_MAX).join('') : value;
}

function cleanMemo(memo) {
  return clipMemo(String(memo ?? '').replace(/[\r\n]+/g, ' ').trim());
}

function isValidRecord(r) {
  return r && typeof r === 'object' && isValidDate(r.date) && isWeather(r.weather);
}

let records = loadRecords();
const listeners = new Set();

function loadRecords() {
  const raw = readJSON(RECORDS_KEY, {});
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const r of Object.values(raw)) if (isValidRecord(r)) out[r.date] = r;
  }
  return out;
}

function notify(event) {
  for (const fn of listeners) fn(event);
}

function commit(event) {
  writeJSON(RECORDS_KEY, records);
  notify(event);
}

// 쓰기 전에 다시 읽어, 다른 창에서 그사이 저장한 기록을 덮어쓰지 않는다.
function refresh() {
  records = loadRecords();
}

window.addEventListener('storage', (event) => {
  if (event.key !== RECORDS_KEY && event.key !== null) return;
  refresh();
  notify({ type: 'bulk' });
});

// fn({ type: 'set' | 'delete' | 'bulk', date? }). 해제 함수를 돌려준다.
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getRecord = (date) => records[date] ?? null;

// 날짜 오름차순
export const getAll = () => Object.values(records).sort((a, b) => a.date.localeCompare(b.date));

export const getRange = (start, end) => getAll().filter((r) => r.date >= start && r.date <= end);

// weather를 빼면 메모만, memo를 빼면 날씨만 바꾼다.
export function setRecord(date, { weather, memo } = {}) {
  refresh();
  const prev = records[date];
  const next = {
    date,
    weather: weather ?? prev?.weather,
    memo: memo === undefined ? (prev?.memo ?? '') : cleanMemo(memo),
    updatedAt: Date.now(),
  };
  if (!isValidRecord(next)) throw new Error(`잘못된 기록: ${date}`);
  records[date] = next;
  commit({ type: 'set', date });
  return next;
}

export function deleteRecord(date) {
  refresh();
  if (!records[date]) return;
  delete records[date];
  commit({ type: 'delete', date });
}

function readMeta() {
  const meta = readJSON(META_KEY, {});
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
}

export function getMeta(key, fallback = null) {
  const meta = readMeta();
  return key in meta ? meta[key] : fallback;
}

export function setMeta(key, value) {
  const meta = readMeta();
  meta[key] = value;
  writeJSON(META_KEY, meta);
}

// ── 백업 ─────────────────────────────────────────────

export function exportJSON() {
  const real = getAll().filter((r) => !r.sample);
  return JSON.stringify({ app: 'gibun-weather', version: 1, exportedAt: new Date().toISOString(), records: real }, null, 2);
}

// 잘못된 파일이면 예외를 던지고 기존 기록은 건드리지 않는다.
// 같은 날짜는 더 새로 고친 쪽을 남기고, 아직 오지 않은 날은 받지 않는다.
// 실제로 바뀐 날의 수를 돌려준다.
export function importJSON(text) {
  const data = JSON.parse(text);
  if (data?.app !== 'gibun-weather' || !Array.isArray(data.records)) throw new Error('기분날씨 백업 파일이 아니에요.');
  refresh();
  // 시간대가 다른 기기에서 만든 백업을 위해 하루는 여유를 둔다.
  const latest = addDays(todayStr(), 1);
  const valid = data.records.filter((r) => isValidRecord(r) && r.date <= latest);
  let changed = 0;
  for (const r of valid) {
    const incomingAt = Number(r.updatedAt) || 0;
    const current = records[r.date];
    if (current && !current.sample && (current.updatedAt ?? 0) >= incomingAt) continue;
    const memo = cleanMemo(r.memo);
    if (current && current.weather === r.weather && current.memo === memo && !current.sample) continue;
    records[r.date] = { date: r.date, weather: r.weather, memo, updatedAt: incomingAt || Date.now() };
    changed += 1;
  }
  commit({ type: 'bulk' });
  return changed;
}

export function clearAll() {
  records = {};
  commit({ type: 'bulk' });
}

// ── 샘플 ─────────────────────────────────────────────
// 앱을 처음 둘러볼 때 쓰는 체험용 기록. 실제 기록은 절대 덮어쓰지 않는다.

const SAMPLE_MEMOS = {
  sunny: ['퇴근길 노을이 예뻤어', '산책 30분의 힘', '별일 없었는데 괜히 좋았던 날', '점심에 먹은 김치찌개가 다 했다'],
  cloudy: ['회의가 세 시간… 머리가 멍하다', '그냥 그런 하루', '오늘은 좀 쉬고 싶어', ''],
  rain: ['이유 없이 울적한 저녁', '비 소리 들으면서 낮잠', '커피 쏟음 ㅠㅠ', '엄마 목소리 듣고 싶은 날'],
  thunder: ['버스 놓침. 화남.', '왜 나한테만 그래', '메일 답장 쓰다가 세 번 지웠다', ''],
  snow: ['아무것도 안 했는데 좋았다', '이불 속이 최고야', '조용히 책 읽은 날', ''],
  rainbow: ['칭찬 한마디에 하루가 바뀜', '합격 소식!!', '친구가 보내준 사진에 한참 웃었다', '오랜만에 다 같이 모였다'],
};

function sampleRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 어제부터 과거로 days일을 채운다. 추가한 개수를 돌려준다. 이미 샘플이 있으면 그대로 둔다.
export function seedSamples(days = 75) {
  refresh();
  if (hasSamples()) return 0;
  const rand = sampleRandom(20261110);
  const weights = { sunny: 30, cloudy: 25, rain: 15, thunder: 8, snow: 9, rainbow: 13 };
  const total = WEATHER_IDS.reduce((sum, id) => sum + weights[id], 0);
  const today = todayStr();
  let added = 0;
  for (let i = 1; i <= days; i += 1) {
    const roll = rand();
    const date = addDays(today, -i);
    if (roll < 0.1 || records[date]) continue;
    let pick = rand() * total;
    const weather = WEATHER_IDS.find((id) => (pick -= weights[id]) < 0) ?? 'sunny';
    const memos = SAMPLE_MEMOS[weather];
    records[date] = { date, weather, memo: memos[Math.floor(rand() * memos.length)], updatedAt: Date.now(), sample: true };
    added += 1;
  }
  commit({ type: 'bulk' });
  return added;
}

export function clearSamples() {
  refresh();
  for (const r of Object.values(records)) if (r.sample) delete records[r.date];
  commit({ type: 'bulk' });
}

export const hasSamples = () => Object.values(records).some((r) => r.sample);
