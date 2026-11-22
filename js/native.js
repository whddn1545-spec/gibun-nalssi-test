// 앱(Capacitor) 기능을 한 곳에서. 웹(브라우저·PWA)에서는 조용히 웹 방식으로 대신한다.
// 번들러 없이 쓰므로 @capacitor/core를 import하지 않고, 앱 안에서 주입되는 window.Capacitor를 쓴다.

const cap = () => globalThis.Capacitor;
export const isNative = () => !!(cap() && typeof cap().isNativePlatform === 'function' && cap().isNativePlatform());
export const platform = () => (isNative() && cap().getPlatform ? cap().getPlatform() : 'web');
const P = (name) => (isNative() && cap().Plugins ? cap().Plugins[name] : null);
const has = (name) => !!P(name);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** 플러그인이 답하지 않아도 앱이 멈추지 않게 (시작 화면에서 영원히 기다리지 않기) */
const withTimeout = (p, ms, fallback) => Promise.race([p, wait(ms).then(() => fallback)]);

// ---------------------------------------------------------------- 기기 설정 저장소(이중 저장)
/** 기기 설정 저장소에 둔 사본을 읽는다(최대 1.5초). 없거나 실패하면 null */
export async function prefsGet(key) {
  const PR = P('Preferences');
  if (!PR) return null;
  try {
    const r = await withTimeout(PR.get({ key }), 1500, null);
    return r && typeof r.value === 'string' ? r.value : null;
  } catch (e) {
    console.warn('[기분날씨] 기기 저장소 읽기 실패', e);
    return null;
  }
}

let lastRaw = '';
let pending = null;
/** 저장할 때마다 부른다. 마지막 내용만 쓰도록 모은다. */
export function mirror(key, raw, { force = false } = {}) {
  if (!has('Preferences') || (!force && raw === lastRaw)) return;
  lastRaw = raw;
  if (pending) return;
  pending = Promise.resolve().then(async () => {
    pending = null;
    try { await P('Preferences').set({ key, value: lastRaw }); } catch (e) { console.warn('[기분날씨] 기기 저장소 쓰기 실패', e); }
  });
}

// ---------------------------------------------------------------- 진동
let hapticsOn = true;
let soft = false; // 차분하게: 진동을 한 번·가볍게만
export const setHaptics = (on, { calm = false } = {}) => { hapticsOn = on !== false; soft = !!calm; };
export const hapticsAvailable = () => has('Haptics') || (!!navigator.vibrate && !/iPhone|iPad|iPod/i.test(navigator.userAgent));

/** kind: tap | select | success | light | medium | heavy | warn | 날씨 id */
export async function haptic(kind = 'tap') {
  if (!hapticsOn) return;
  if (soft && !['select', 'tap', 'warn'].includes(kind)) kind = 'light';
  const H = P('Haptics');
  if (!H) {
    const pat = { tap: 6, select: 5, success: [12, 60, 18], light: 8, medium: 14, heavy: 30, warn: [20, 50, 20],
      sunny: [12, 60, 18], rainbow: [10, 40, 10, 40, 22], cloudy: 10, snow: 8, rain: [8, 90, 8], thunder: [40, 70, 24] }[kind] ?? 6;
    try { navigator.vibrate && navigator.vibrate(pat); } catch { /* 지원 안 함 */ }
    return;
  }
  try {
    switch (kind) {
      case 'select': case 'tap': await H.selectionStart(); await H.selectionChanged(); await H.selectionEnd(); break;
      case 'success': case 'sunny': await H.notification({ type: 'SUCCESS' }); break;
      case 'rainbow': await H.notification({ type: 'SUCCESS' }); await wait(160); await H.impact({ style: 'LIGHT' }); await wait(90); await H.impact({ style: 'LIGHT' }); break;
      case 'cloudy': case 'snow': case 'light': await H.impact({ style: 'LIGHT' }); break;
      case 'rain': await H.impact({ style: 'LIGHT' }); await wait(110); await H.impact({ style: 'LIGHT' }); break;
      case 'thunder': await H.impact({ style: 'HEAVY' }); await wait(120); await H.impact({ style: 'MEDIUM' }); break;
      case 'medium': await H.impact({ style: 'MEDIUM' }); break;
      case 'heavy': await H.impact({ style: 'HEAVY' }); break;
      case 'warn': await H.notification({ type: 'WARNING' }); break;
      default: await H.impact({ style: 'LIGHT' });
    }
  } catch { /* 진동이 없는 기기 */ }
}

// ---------------------------------------------------------------- 파일 · 공유 · 사진
const FILE_PREFIX = '기분날씨-'; // 앱 임시 폴더에 쓰는 파일은 모두 이 이름으로 시작한다(지울 때 쓴다)

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error || new Error('read'));
    r.readAsDataURL(blob);
  });
}

/** 앱 임시 폴더에 파일을 쓰고 uri를 돌려준다 */
async function writeCache(blob, name) {
  const FS = P('Filesystem');
  const data = await blobToBase64(blob);
  const path = name.startsWith(FILE_PREFIX) ? name : `${FILE_PREFIX}${name}`;
  const r = await FS.writeFile({ path, data, directory: 'CACHE', recursive: true });
  return r.uri;
}

/**
 * 앱 임시 폴더에 남은 백업·카드 파일을 지운다. 공유 창이 파일을 다 읽은 뒤여야 하므로
 * 공유 직후가 아니라 앱을 켤 때와 '모든 기록 지우기' 때 부른다.
 */
export async function cleanupCache() {
  const FS = P('Filesystem');
  if (!FS) return 0;
  try {
    const r = await withTimeout(FS.readdir({ path: '', directory: 'CACHE' }), 2000, { files: [] });
    const mine = (r.files || []).map((f) => (typeof f === 'string' ? f : f.name)).filter((n) => n && n.startsWith(FILE_PREFIX));
    for (const n of mine) {
      try { await FS.deleteFile({ path: n, directory: 'CACHE' }); } catch { /* 이미 없음 */ }
    }
    return mine.length;
  } catch {
    return 0;
  }
}

const isCancel = (e) => /cancel|abort|dismiss/i.test(String((e && (e.message || e.errorMessage || e.code)) || e));

/**
 * 시스템 공유 창으로 파일 보내기. 반환: 'shared' | 'cancel' | 'unsupported' | 'error'
 * 웹에서는 navigator.share(파일)를 쓴다.
 */
export async function shareFile(blob, name, { title = '', text = '' } = {}) {
  if (has('Share') && has('Filesystem')) {
    try {
      const uri = await writeCache(blob, name);
      await P('Share').share({ title, text, files: [uri], dialogTitle: title || '공유하기' });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancel';
      console.warn('[기분날씨] 공유 실패', e);
      return 'error';
    }
  }
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (e) {
      return e && e.name === 'AbortError' ? 'cancel' : 'error';
    }
  }
  return 'unsupported';
}

/**
 * 사진 앱에 바로 저장. 반환: 'saved' | 'denied' | 'unsupported' | 'error'
 * - 안드로이드: 앱에 넣은 PhotoSaver(MediaStore, 안드로이드 10+는 권한 없음)
 * - 아이폰: @capacitor-community/media (사진 '추가만' 권한)
 */
export async function savePhoto(blob, name) {
  const base = name.replace(/\.png$/i, '');
  try {
    if (platform() === 'android' && has('PhotoSaver')) {
      const data = await blobToBase64(blob);
      await P('PhotoSaver').savePng({ data, fileName: base, album: '기분날씨' });
      return 'saved';
    }
    if (platform() === 'ios' && has('Media')) {
      const data = await blobToBase64(blob);
      await P('Media').savePhoto({ path: `data:image/png;base64,${data}` });
      return 'saved';
    }
  } catch (e) {
    console.warn('[기분날씨] 사진 저장 실패', e);
    if (/denied|permission|access/i.test(String((e && (e.message || e.code)) || e))) return 'denied';
    return 'error';
  }
  return 'unsupported';
}

// ---------------------------------------------------------------- 매일 알림
export const remindAvailable = () => has('LocalNotifications');

/** 'granted' | 'denied' | 'prompt' | 'unavailable' */
export async function remindPermission({ ask = false } = {}) {
  const LN = P('LocalNotifications');
  if (!LN) return 'unavailable';
  try {
    let r = await LN.checkPermissions();
    if (ask && r.display !== 'granted' && r.display !== 'denied') r = await LN.requestPermissions();
    if (r.display === 'granted') return 'granted';
    if (r.display === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unavailable';
  }
}

const REMIND_BASE = 7100; // 알림 id 7100~7139 (최대 40개)
const REMIND_SIG = 'kibun-weather:remind-sig'; // 마지막으로 예약한 목록(같으면 다시 예약하지 않는다)
const ACTION_TYPE = 'PICK_WEATHER';
let prepared = false;

/** 안드로이드 알림 채널(이름이 휴대폰 설정에 보인다)과 알림 버튼(맑음·구름·비)을 한 번만 등록 */
async function prepareReminders(LN, actions) {
  if (prepared) return;
  prepared = true;
  try {
    if (platform() === 'android' && LN.createChannel) {
      await LN.createChannel({ id: 'remind', name: '매일 알림', description: '하루 한 번 오늘 마음 날씨를 물어봐요', importance: 3, visibility: 0, vibration: true });
    }
    if (LN.registerActionTypes && actions && actions.length) {
      await LN.registerActionTypes({ types: [{ id: ACTION_TYPE, actions: actions.map((a) => ({ id: a.id, title: a.title, foreground: true })) }] });
    }
  } catch (e) {
    console.warn('[기분날씨] 알림 준비 실패', e);
  }
}

/**
 * 매일 알림을 예약한다(지난 시각·건너뛸 날은 main.js가 뺀다). items: [{ at: Date, body }]
 * - isExactNotification:false → 안드로이드 12+에서 '알람 및 리마인더' 설정 화면을 열지 않는다(정확한 알람 권한은 쓰지 않음)
 * - 지난번과 같은 목록이고 예약이 그대로 남아 있으면 다시 예약하지 않는다(앱을 열 때마다 다시 걸지 않게)
 * 반환: 예약한 개수(0 = 바뀐 것 없음 또는 없음, -1 = 실패)
 */
export async function scheduleReminders(items, { actions = [] } = {}) {
  const LN = P('LocalNotifications');
  if (!LN) return -1;
  try {
    await prepareReminders(LN, actions);
    const sig = items.map((it) => `${it.at.getTime()}|${it.body}`).join('\n');
    let pendingIds = [];
    try {
      const p = await LN.getPending();
      pendingIds = (p.notifications || []).map((n) => n.id).filter((id) => id >= REMIND_BASE && id < REMIND_BASE + 40);
    } catch { /* 모르면 다시 건다 */ }
    let prev = null;
    try { prev = localStorage.getItem(REMIND_SIG); } catch { /* 없음 */ }
    if (prev === sig && pendingIds.length === items.length) return 0;
    if (pendingIds.length) await LN.cancel({ notifications: pendingIds.map((id) => ({ id })) });
    if (items.length) {
      await LN.schedule({
        notifications: items.map((it, i) => ({
          id: REMIND_BASE + i,
          title: '기분날씨',
          body: it.body,
          schedule: { at: it.at, allowWhileIdle: true },
          isExactNotification: false,
          channelId: 'remind',
          actionTypeId: actions.length ? ACTION_TYPE : undefined,
          smallIcon: 'ic_stat_cloud',
          iconColor: '#FF8B6D',
          extra: { kind: 'remind' },
        })),
      });
    }
    try { localStorage.setItem(REMIND_SIG, sig); } catch { /* 못 적으면 다음에 다시 건다 */ }
    return items.length;
  } catch (e) {
    console.warn('[기분날씨] 알림 예약 실패', e);
    return -1;
  }
}

export async function cancelReminders() {
  const LN = P('LocalNotifications');
  if (!LN) return;
  try { localStorage.removeItem(REMIND_SIG); } catch { /* 없음 */ }
  try {
    const p = await LN.getPending();
    const mine = (p.notifications || []).filter((n) => n.id >= REMIND_BASE && n.id < REMIND_BASE + 40).map((n) => ({ id: n.id }));
    if (mine.length) await LN.cancel({ notifications: mine });
  } catch { /* 예약이 없으면 그만 */ }
}

/** 알림의 버튼(맑음·구름·비)이나 알림 자체를 눌러 앱이 열렸을 때. fn(actionId) — 알림 자체는 'tap' */
export function onReminderAction(fn) {
  const LN = P('LocalNotifications');
  if (!LN || !LN.addListener) return;
  LN.addListener('localNotificationActionPerformed', (a) => {
    const extra = a && a.notification && a.notification.extra;
    if (extra && extra.kind && extra.kind !== 'remind') return;
    fn(a && a.actionId ? a.actionId : 'tap');
  });
}

// ---------------------------------------------------------------- 앱 생명주기 · 뒤로 가기 · 상태바 · 시작 화면
export function onResume(fn) {
  const A = P('App');
  if (A) A.addListener('resume', fn);
}

/** 안드로이드 뒤로 가기. handler가 true를 돌려주면 처리한 것으로 본다. */
export function onBack(handler) {
  const A = P('App');
  if (!A) return;
  A.addListener('backButton', () => {
    if (handler()) return;
    A.exitApp();
  });
}

export async function appInfo() {
  const A = P('App');
  if (!A) return null;
  try { return await withTimeout(A.getInfo(), 1500, null); } catch { return null; }
}

export async function setupChrome() {
  const SB = P('StatusBar');
  if (SB) {
    try { await SB.setStyle({ style: 'LIGHT' }); } catch { /* 지원 안 함 */ }
  }
}

export async function hideSplash() {
  const S = P('SplashScreen');
  if (S) {
    try { await S.hide({ fadeOutDuration: 250 }); } catch { /* 이미 닫힘 */ }
  }
}

/** 바깥 링크(개인정보처리방침 등)를 연다. 앱에서는 페이지 이동을 Capacitor가 가로채 시스템 브라우저로 연다. */
export function openExternal(url) {
  if (!url) return;
  if (isNative()) { window.location.href = url; return; }
  window.open(url, '_blank', 'noopener');
}
