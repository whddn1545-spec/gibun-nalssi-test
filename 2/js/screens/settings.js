// 설정 시트: 샘플 기록, 백업 저장·불러오기, 홈 화면에 추가, 모두 지우기.
// 설치 안내 이벤트는 시트를 열기 전에 올 수 있어서, 달력 화면이 앱을 열 때 watchInstallPrompt()로 미리 받아 둔다.

const SVG_NS = 'http://www.w3.org/2000/svg';

let deferredPrompt = null;
let watching = false;

export function watchInstallPrompt() {
  if (watching) return;
  watching = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; });
}

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function svgIcon(...paths) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

// 고정된 그림이라 글자를 섞지 않는다. 구조만 문자열로 쓰고 DOM으로 바꾼다.
function iosGuideArt() {
  const markup = `
    <svg xmlns="${SVG_NS}" viewBox="0 0 320 168" role="img" aria-label="공유 버튼을 누르고 홈 화면에 추가를 고르는 그림">
      <defs>
        <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E8FD6"/><stop offset="1" stop-color="#A9C6EC"/></linearGradient>
      </defs>
      <rect x="8" y="6" width="150" height="156" rx="20" fill="url(#g-sky)"/>
      <path d="M8 120h150v22a20 20 0 0 1-20 20H28a20 20 0 0 1-20-20Z" fill="rgba(255,255,255,.92)"/>
      <g fill="none" stroke="#2c7be5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" transform="translate(70 128)">
        <path d="M9 12V1.5M5 5l4-4 4 4M4 8H3.5A2 2 0 0 0 1.5 10v8a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H14"/>
      </g>
      <circle cx="88" cy="140" r="21" fill="none" stroke="#ffd36b" stroke-width="3"/>
      <rect x="174" y="22" width="138" height="124" rx="18" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.3)"/>
      <g fill="rgba(255,255,255,.4)"><rect x="190" y="40" width="70" height="8" rx="4"/><rect x="190" y="60" width="104" height="8" rx="4"/></g>
      <rect x="184" y="84" width="118" height="40" rx="12" fill="rgba(255,255,255,.95)"/>
      <g fill="none" stroke="#18233f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(194 95)">
        <rect x="1" y="1" width="16" height="16" rx="4"/><path d="M9 5v8M5 9h8"/>
      </g>
      <rect x="220" y="100" width="70" height="8" rx="4" fill="#18233f" opacity=".75"/>
      <path d="M124 128c14-12 18-26 34-30" fill="none" stroke="#ffd36b" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>
    </svg>`;
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  return document.importNode(doc.documentElement, true);
}

export function openSettings(ctx) {
  const { store, ui } = ctx;
  const { el } = ui;

  const content = el('div', { class: 'set-sheet' });
  let sheet = null;
  let resetTimer = 0;

  function row({ id, title, desc, icon, danger = false, onclick }) {
    return el('button', {
      id, class: `set-item pressable${danger ? ' is-danger' : ''}`, type: 'button', onclick,
    },
    el('span', { class: 'set-text' }, el('strong', {}, title), desc ? el('span', {}, desc) : null),
    icon ? svgIcon(...icon) : null);
  }

  function paint() {
    const hasSamples = store.hasSamples();

    const importInput = el('input', {
      id: 'file-import', class: 'set-file', type: 'file', accept: 'application/json,.json',
      onchange: () => importFile(importInput),
    });
    const importRow = el('label', { class: 'set-item pressable' },
      importInput,
      el('span', { class: 'set-text' }, el('strong', {}, '백업 불러오기'), el('span', {}, '저장해 둔 백업 파일의 기록을 이 기기에 합쳐요')),
      svgIcon('M12 15.5v-11', 'M7.5 9 12 4.5 16.5 9', 'M4 19.5h16'));

    const groups = [
      el('section', { class: 'set-group' },
        el('h3', { class: 'set-group-title' }, '둘러보기'),
        row({
          id: 'btn-sample', title: '샘플 기록 채우기', desc: '체험용이에요. 내가 남긴 기록은 덮어쓰지 않아요',
          icon: ['M12 4.5v15', 'M4.5 12h15'], onclick: fillSamples,
        }),
        hasSamples ? row({
          id: 'btn-clear-sample', title: '샘플 지우기', desc: '체험용 기록만 지우고 내 기록은 남겨요',
          icon: ['M6 7.5h12', 'M9.5 7.5V5.5h5v2', 'M7.5 7.5l.8 11h7.4l.8-11'], onclick: clearSamples,
        }) : null),
      el('section', { class: 'set-group' },
        el('h3', { class: 'set-group-title' }, '백업'),
        row({
          id: 'btn-export', title: '백업 저장', desc: '기록을 파일로 내려받아요',
          icon: ['M12 4.5v11', 'M7.5 11 12 15.5 16.5 11', 'M4 19.5h16'], onclick: exportBackup,
        }),
        importRow),
      isStandalone() ? null : el('section', { class: 'set-group' },
        el('h3', { class: 'set-group-title' }, '설치'),
        row({
          id: 'btn-install', title: '홈 화면에 추가', desc: '앱처럼 바로 열고, 인터넷 없이도 써요',
          icon: ['M5 5.5h14v14H5Z', 'M12 9v6', 'M9 12h6'], onclick: () => install(),
        })),
      el('section', { class: 'set-group' },
        el('h3', { class: 'set-group-title' }, '정리'),
        row({
          id: 'btn-reset', title: '모두 지우기', desc: '이 기기에 저장된 기록이 전부 사라져요', danger: true,
          icon: ['M6 7.5h12', 'M9.5 7.5V5.5h5v2', 'M7.5 7.5l.8 11h7.4l.8-11'], onclick: (e) => resetAll(e.currentTarget),
        })),
      el('p', { class: 'set-note' }, '기록은 이 기기에만 저장돼요.'),
    ].filter(Boolean);

    content.replaceChildren(el('h2', { class: 'set-title' }, '설정'), ...groups);
  }

  function fillSamples() {
    const added = store.seedSamples();
    ui.haptic('success');
    ui.toast(added ? `샘플 ${added}일을 채웠어요` : '샘플이 이미 채워져 있어요');
    paint();
  }

  function clearSamples() {
    store.clearSamples();
    ui.toast('샘플 기록을 지웠어요');
    paint();
  }

  function exportBackup() {
    const real = store.getAll().filter((r) => !r.sample);
    if (!real.length) {
      ui.toast('백업할 기록이 아직 없어요');
      return;
    }
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = el('a', { href: url, download: `기분날씨-백업-${store.todayStr()}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    ui.haptic('success');
    ui.toast(`${real.length}일의 기록을 저장했어요`);
  }

  async function importFile(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const count = store.importJSON(await file.text());
      ui.haptic('success');
      ui.toast(count ? `${count}일의 기록을 불러왔어요` : '이미 같은 기록이 있어서 바뀐 날이 없어요');
      paint();
    } catch (error) {
      ui.haptic('warn');
      ui.toast(error instanceof SyntaxError ? '기분날씨 백업 파일이 아니에요' : error.message);
    }
  }

  async function install() {
    if (deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptEvent.prompt();
      const choice = await promptEvent.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') ui.toast('홈 화면에 추가했어요');
      return;
    }
    showGuide();
  }

  // 설치 창을 띄울 수 없을 때: 기기에 맞는 안내 그림을 시트 안에서 보여 준다.
  function showGuide() {
    const ios = isIOS();
    const steps = ios
      ? ['화면 아래의 공유 버튼을 눌러요', '“홈 화면에 추가”를 골라요', '오른쪽 위의 “추가”를 누르면 끝이에요']
      : ['브라우저 오른쪽 위의 메뉴(점 세 개)를 눌러요', '“홈 화면에 추가” 또는 “앱 설치”를 골라요', '“설치”를 누르면 끝이에요'];
    content.replaceChildren(
      el('h2', { class: 'set-title' }, '홈 화면에 추가'),
      ios ? el('div', { class: 'set-guide-art' }, iosGuideArt()) : null,
      el('ol', { class: 'set-steps' }, steps.map((text) => el('li', {}, text))),
      ios ? el('p', { class: 'set-note' }, '사파리에서 열었을 때만 보이는 메뉴예요') : null,
      el('button', { class: 'btn btn-primary pressable set-back', type: 'button', onclick: paint }, '돌아가기'),
    );
  }

  function resetAll(button) {
    if (!resetTimer) {
      button.classList.add('is-armed');
      button.querySelector('strong').textContent = '정말 지울까요?';
      button.querySelector('.set-text span').textContent = '한 번 더 누르면 모든 기록이 지워져요';
      ui.haptic('warn');
      resetTimer = window.setTimeout(() => { resetTimer = 0; if (button.isConnected) paint(); }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    resetTimer = 0;
    store.clearAll();
    ctx.restoreSky();
    ui.toast('모든 기록을 지웠어요');
    sheet.close();
  }

  paint();
  sheet = ui.openSheet({ content, label: '설정', onClose: () => { clearTimeout(resetTimer); } });
  return sheet;
}
