// 홈 화면에 추가(설치): 안드로이드·PC 크롬은 설치 창, 아이폰은 브라우저별 안내
let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

window.addEventListener('beforeinstallprompt', (e) => {
  // 크롬의 작은 설치 띠가 탭바를 가리지 않게 막고, 앱 안의 버튼·안내로 띄운다
  e.preventDefault();
  deferred = e;
  emit();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  emit();
});

const UA = navigator.userAgent || '';
export const onInstallChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  navigator.standalone === true;
export const isIOS = () =>
  /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** 카카오톡·인스타그램·페이스북·라인·네이버 같은 앱 안의 브라우저 */
export const inAppBrowser = () => {
  const m = UA.match(/KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps|everytimeApp|Whale\/.*inapp|BAND\//i);
  if (!m) return null;
  const k = m[0].toLowerCase();
  if (k.startsWith('kakao')) return '카카오톡';
  if (k.startsWith('instagram')) return '인스타그램';
  if (k.startsWith('fb')) return '페이스북';
  if (k.startsWith('line')) return '라인';
  if (k.startsWith('naver')) return '네이버 앱';
  if (k.startsWith('band')) return '밴드';
  return '앱';
};
export const isIOSChrome = () => isIOS() && /CriOS/i.test(UA);
export const canPrompt = () => !!deferred;

export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred;
  deferred = null;
  try {
    await e.prompt();
    const choice = await e.userChoice;
    emit();
    return choice && choice.outcome;
  } catch {
    emit();
    return 'error';
  }
}
