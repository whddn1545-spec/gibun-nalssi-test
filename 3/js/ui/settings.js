// 설정(design-spec §9.1 순서): ① 내 기록 지키기(백업·복원) ② 이름 ③ 예시 데이터 ④ 홈 화면에 추가 ⑤ 마음이 힘들 때 ⑥ 앱 정보 ⑦ 전체 삭제.
// 설치 안내 시트(§9.2: iOS 3단계 그림 + Safari 저장소 분리 안내 + 백업 단추 / 안드로이드 설치 단추 + 메뉴 안내)와 저장 뒤 조용한 설치 권유 한 줄.
import { play, after } from '../loop.js';
import * as store from '../store.js';
import { now, dayKey, parseKey } from '../dates.js';
import { fmt } from '../copy.js';
import { drawOrb } from '../sky/orb.js';
import { isIOS } from './forecast.js';
import { RAIN_KEY } from './crisis.js';

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(cls, text) { const b = el('button', cls, text); b.type = 'button'; return b; }
export const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
let deferred = null; // 안드로이드 크롬의 beforeinstallprompt(눌렀을 때만 띄운다)
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
window.addEventListener('appinstalled', () => { deferred = null; });

// iOS 설치 3단계 그림(128×96, 직접 그림. 실제 OS 화면은 쓰지 않는다)
function stepArt(i) {
  const W = 128, H = 96, d = Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas'); cv.width = W * d; cv.height = H * d; cv.className = 'inst-art'; cv.setAttribute('aria-hidden', 'true');
  const c = cv.getContext('2d'); c.scale(d, d);
  const ink = '#1B2433', soft = '#E9E2D3', gold = '#F2C14E';
  const rr = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  c.fillStyle = '#FFFDF8'; rr(0, 0, W, H, 12); c.fill();
  c.strokeStyle = ink; c.lineWidth = 1.75; c.lineCap = 'round'; c.lineJoin = 'round';
  if (i === 0) { // 휴대폰 아래 막대의 공유 단추
    rr(36, 8, 56, 84, 10); c.fillStyle = soft; c.fill(); c.stroke();
    c.fillStyle = '#FFFFFF'; c.fillRect(37, 72, 54, 19);
    c.fillStyle = gold; c.beginPath(); c.arc(64, 81, 9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(60, 79); c.lineTo(60, 86); c.lineTo(68, 86); c.lineTo(68, 79); c.moveTo(64, 83); c.lineTo(64, 74); c.moveTo(61, 77); c.lineTo(64, 74); c.lineTo(67, 77); c.stroke();
  } else if (i === 1) { // 메뉴의 '홈 화면에 추가' 줄
    rr(16, 10, 96, 76, 10); c.fillStyle = '#FFFFFF'; c.fill(); c.stroke();
    [24, 44, 64].forEach((y, k) => { if (k === 1) { c.fillStyle = gold; rr(20, y - 4, 88, 18, 6); c.fill(); } c.fillStyle = k === 1 ? ink : '#B9B2A4'; c.fillRect(28, y + 3, k === 1 ? 50 : 56, 4); });
    rr(86, 41, 14, 14, 3); c.stroke(); c.beginPath(); c.moveTo(93, 44); c.lineTo(93, 52); c.moveTo(89, 48); c.lineTo(97, 48); c.stroke();
  } else { // 홈 화면에 선 기상대(앱 구슬)
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { const x = 18 + k * 25, y = 18 + r * 34; if (r === 1 && k === 1) continue; c.fillStyle = soft; rr(x, y, 18, 18, 5); c.fill(); }
    c.save(); c.translate(52, 61); drawOrb(c, 'sunny', 22); c.restore();
    c.strokeStyle = gold; c.lineWidth = 2; c.beginPath(); c.arc(52, 61, 15, 0, Math.PI * 2); c.stroke();
  }
  return cv;
}

export function createSettings(env) {
  const { C, sheet, toast, app } = env; const S = C.settings, I = C.install, X = C.extra;
  const inner = document.querySelector('#screen-settings .inner');
  const scroll = el('div', 'set-scroll'); inner.appendChild(scroll);
  const group = (title) => { const g = el('section', 'set-group'); if (title) g.append(el('h3', 'set-gtitle', title)); scroll.append(g); return g; };
  // 누르는 행은 오른쪽 W−24에 꺾쇠(§9.1 '값·꺾쇠 text-2', fix2b). 전체 삭제(danger)는 빨간 글자로 충분해 꺾쇠를 달지 않는다
  const chev = () => { const s = el('span', 'set-chev'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg>'; return s; };
  const row = (g, t, d, onClick, cls) => { const b = btn('set-row' + (cls ? ' ' + cls : ' has-chev')); b.append(el('span', 'set-row-t', t)); if (d) { const dd = el('span', 'set-row-d', d); b.append(dd); b._d = dd; } if (!cls) b.append(chev()); b.addEventListener('click', onClick); g.append(b); return b; };

  // ① 내 기록 지키기
  const g1 = group(S.backup_section); g1.append(el('p', 'set-note', S.backup_note));
  row(g1, S.backup_save, S.backup_save_desc, backup);
  const file = document.createElement('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true; file.id = 'restoreFile';
  row(g1, S.restore, S.restore_desc, () => { file.value = ''; file.click(); }); g1.append(file);
  const undoRow = row(g1, X.restore_undo, X.restore_undo_desc, askUndo); undoRow.id = 'setUndo'; undoRow.hidden = !store.hasUndo(); // 복원 직전 사본이 있을 때만
  file.addEventListener('change', () => { const f = file.files && file.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => askRestore(String(r.result || '')); r.onerror = () => toast(S.restore_failed); r.readAsText(f); });
  // ② 이름(사용자 입력이라 본문 글꼴)
  const g2 = group(null); const nameRow = el('label', 'set-row set-name'); const nameIn = document.createElement('input');
  nameIn.type = 'text'; nameIn.maxLength = 20; nameIn.autocomplete = 'off'; nameIn.spellcheck = false; nameIn.placeholder = S.name_placeholder; nameIn.id = 'nameInput'; nameIn.value = store.getName();
  // 이름과 설명을 한 칸(높이 72)으로 묶고 구분선은 그 아래(fix2b)
  const nameTx = el('span', 'set-name-tx'); nameTx.append(el('span', 'set-row-t', S.name), el('span', 'set-row-d', S.name_desc));
  nameRow.append(nameTx, nameIn); g2.append(nameRow);
  const saveName = () => { const r = store.setName(nameIn.value.trim()); if (!r.ok) toast(C.misc.save_failed); };
  nameIn.addEventListener('change', saveName); nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) nameIn.blur(); });
  // ③ 예시 데이터(기존 단추를 옮겨 쓴다)
  const g3 = group(null); const sampleRow = document.getElementById('setSample'); sampleRow.classList.add('has-chev'); sampleRow.append(chev()); g3.append(sampleRow);
  // ④ 홈 화면에 추가 ⑤ 마음이 힘들 때
  const g4 = group(null); const instRow = row(g4, S.install, isStandalone() ? X.install_done : S.install_desc, openInstall); instRow.id = 'setInstall';
  row(g4, S.help, S.help_desc, () => env.openHelp()).id = 'setHelp';
  // ⑥ 앱 정보
  const g6 = group(S.about); g6.append(el('p', 'set-note', S.about_desc), el('p', 'set-note set-notice', S.notice));
  row(g6, S.license, S.license_desc, openLicense).id = 'setLicense';
  // ⑦ 전체 삭제(맨 아래)
  const g7 = group(null); row(g7, S.delete_all, null, deleteAll, 'danger').id = 'setDelete';

  function download(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  function backup() {
    try { download(new Blob([store.exportJSON()], { type: 'application/json' }), fmt(X.backup_file, { app: C.app.name, date: dayKey(now()) })); toast(S.backup_saved); }
    catch (e) { toast(S.backup_failed); }
  }
  // 복원 = 날짜별 합치기. 확인 창에 이 파일의 기록 n일·겹치는 m일·건너뛸 k개를 건수로 알린다
  function askRestore(text) {
    const chk = store.checkBackup(text);
    if (!chk.ok) { toast(S.restore_failed); return; }
    if (!chk.n) { toast(X.restore_nothing); return; }
    sheet.show((body) => {
      body.append(el('h2', 'sh-date', S.restore_confirm), el('p', 'sh-note', fmt(chk.m ? X.restore_merge : X.restore_merge_none, { n: chk.n, m: chk.m })));
      if (chk.skipped) body.append(el('p', 'sh-note', fmt(X.restore_skipped, { k: chk.skipped })));
      body.append(el('p', 'sh-note', X.restore_keep));
      const yes = btn('sh-btn', S.restore_confirm_button); yes.id = 'restoreYes';
      yes.addEventListener('click', () => {
        const r = store.importJSON(text); sheet.close();
        if (!r.ok) { toast(r.bad ? S.restore_failed : r.full ? X.restore_full : C.misc.save_failed); return; } // 실패하면 기록은 그대로
        toast(S.restore_success); env.onDataChanged();
      });
      const no = btn('sh-text cancel', S.delete_cancel); no.addEventListener('click', () => sheet.close());
      const w = el('div', 'sh-del'); w.append(no); body.append(yes, w);
    }, { label: S.restore });
  }
  function askUndo() {
    sheet.show((body) => {
      body.append(el('h2', 'sh-date', X.restore_undo_title), el('p', 'sh-note', X.restore_undo_body));
      const yes = btn('sh-btn', X.restore_undo_button); yes.id = 'undoYes';
      yes.addEventListener('click', () => {
        const r = store.undoRestore(); sheet.close();
        if (!r.ok) { toast(r.full ? C.misc.storage_full : C.misc.save_failed); return; }
        toast(X.restore_undo_done); env.onDataChanged();
      });
      const no = btn('sh-text cancel', S.delete_cancel); no.addEventListener('click', () => sheet.close());
      const w = el('div', 'sh-del'); w.append(no); body.append(yes, w);
    }, { label: X.restore_undo });
  }
  function deleteAll() {
    const step = (body, n) => {
      body.textContent = '';
      body.append(el('h2', 'sh-date', n === 1 ? S.delete_step1_title : S.delete_step2_title), el('p', 'sh-note', n === 1 ? S.delete_step1_body : S.delete_step2_body));
      const yes = btn('sh-btn' + (n === 2 ? ' danger' : ''), n === 1 ? S.delete_step1_confirm : S.delete_step2_confirm); yes.id = 'deleteYes' + n;
      yes.addEventListener('click', () => {
        if (n === 1) { step(body, 2); sheet.relayout(); yes.blur(); body.querySelector('#deleteYes2').focus(); return; }
        store.clearAll([RAIN_KEY]); sheet.close(); toast(S.delete_done); env.onDataChanged('deleted');
      });
      const no = btn('sh-text cancel', S.delete_cancel); no.addEventListener('click', () => sheet.close());
      const w = el('div', 'sh-del'); w.append(no); body.append(yes, w);
    };
    sheet.show((body) => step(body, 1), { label: S.delete_all });
  }
  function openLicense() {
    sheet.show((body) => { body.append(el('h2', 'sh-date', S.license), el('p', 'sh-note', S.license_desc)); const box = el('div', 'lic'); body.append(box);
      Promise.all(['fonts/OFL-GowunBatang.txt', 'fonts/OFL-Pretendard.txt'].map((u) => fetch(u).then((r) => (r.ok ? r.text() : '')).catch(() => '')))
        .then((ts) => { ts.forEach((t) => { if (t) box.append(el('pre', 'lic-t', t)); }); sheet.relayout(); }); }, { label: S.license, tall: true });
  }
  function openInstall() {
    sheet.show((body) => {
      body.append(el('h2', 'sh-date', I.title));
      if (isIOS()) {
        // 단계마다 번호 원(지름 22, 그림 바깥 모서리 −6, fix3). 기록이 있으면 'Safari 기록은 이어지지 않음' 경고와 백업 단추를 그림보다 먼저 둔다(fix2b)
        const ol = el('ol', 'inst-steps'); I.ios_steps.forEach((t, i) => { const li = el('li', 'inst-step'); const art = el('div', 'inst-art-w'); art.append(stepArt(i), el('span', 'inst-num', String(i + 1))); li.append(art, el('p', 'inst-t', t)); ol.append(li); });
        const b = btn('sh-btn inst-backup', I.backup_button); b.addEventListener('click', backup);
        const warn = [el('p', 'inst-notice', I.safari_notice), el('p', 'sh-note', I.safari_backup), b];
        if (store.count() > 0) body.append(...warn, ol); else body.append(ol, ...warn);
      } else {
        if (deferred) { const b = btn('sh-btn gold', I.android_button); b.id = 'installBtn'; b.addEventListener('click', async () => { const d = deferred; deferred = null; try { await d.prompt(); await d.userChoice; } catch (e) { /* 사용자가 닫음 */ } sheet.close(); }); body.append(b); }
        body.append(el('p', 'sh-note', I.android_fallback));
      }
      const c = btn('sh-text cancel', I.close); c.addEventListener('click', () => sheet.close()); const w = el('div', 'sh-del'); w.append(c); body.append(w);
    }, { label: I.title, tall: true });
  }

  // 저장 뒤 조용한 설치 권유(오늘 화면 정보 줄 위 한 줄): 설치 안 됨·예시 아님·기록 3일 이상·고치기 아님·위기 카드 없음·14일에 한 번
  const pill = btn('inst-nudge', I.prompt); pill.hidden = true; document.getElementById('screen-today').appendChild(pill);
  let pillH = null, L = null;
  pill.addEventListener('click', () => { hideNudge(); openInstall(); });
  function hideNudge() { if (pillH) { pillH.cancel(); pillH = null; } pill.hidden = true; }
  function nudge(o) {
    if (isStandalone() || store.inSample() || o.isEdit || o.crisisShown || o.quiet || store.count() < 3) return false;
    const today = dayKey(now()), last = store.getMeta('installNudge');
    if (last && (parseKey(today) - parseKey(last)) / 864e5 < 14) return false;
    store.setMeta('installNudge', today);
    pillH = after(1800, () => {
      if (L) pill.style.top = L.infoTop - 44 + 'px';
      pill.hidden = false; pill.style.opacity = '0'; play(240, (p) => { pill.style.opacity = p >= 1 ? '' : p.toFixed(3); });
      pillH = after(8000, () => play(240, (p) => { pill.style.opacity = (1 - p).toFixed(3); if (p >= 1) hideNudge(); }));
    });
    return true;
  }
  return {
    layout(newL) { L = newL; if (!pill.hidden) pill.style.top = L.infoTop - 44 + 'px'; },
    refresh() { nameIn.value = store.getName(); undoRow.hidden = !store.hasUndo(); if (instRow._d) instRow._d.textContent = isStandalone() ? X.install_done : S.install_desc; },
    nudge, hideNudge, openInstall,
  };
}
