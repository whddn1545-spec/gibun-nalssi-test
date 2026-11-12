// 위기 안내 카드(design-spec §9.4, docs/safety-review.md 3·4절)와 도움받을 곳 시트.
// - 판정은 저장 성공 뒤에만. 하루 최대 1회(메모·궂은 날 합산)는 모듈 변수(오늘 키)로만 센다(저장하지 않음).
// - 궂은 날: 오늘 화면에서 오늘을 비·천둥으로 저장했을 때, 최근 7일 중 비·천둥 5일 이상, 7일에 한 번. 마지막 날짜만 mw.rainNudge에 둔다(백업 제외, 전체 삭제 때 지움).
// - 예시 데이터 중에는 판정·조용한 판·mw.rainNudge 갱신을 하지 않는다. 판정 결과·맞은 말·횟수를 저장·전송·console에 남기지 않는다.
import { play, after } from '../loop.js';
import * as store from '../store.js';
import { now, dayKey, addDays, parseKey } from '../dates.js';
import { needsHelp } from '../safety.js';
import { fmt } from '../copy.js';

export const RAIN_KEY = 'mw.rainNudge';
const SVG_X = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(cls, text) { const b = el('button', cls, text); b.type = 'button'; return b; }
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);

export function createCrisis(env) {
  const { C, app, sheet, reduced } = env; const S = C.safety;
  const scr = document.getElementById('screen-today');
  let shownDay = null, kind = null, L = null, h = null;

  function makeCard(inSheet) {
    const box = el('div', 'crisis-card' + (inSheet ? ' in-sheet' : '')); box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    const txt = el('p', 'crisis-t'); const l1 = el('span', 'crisis-l1'), l2 = el('span', 'crisis-l2'); txt.append(l1, l2);
    const go = btn('crisis-go', S.button); go.addEventListener('click', () => openHelp());
    const x = btn('crisis-x'); x.setAttribute('aria-label', C.misc.close); x.innerHTML = SVG_X;
    x.addEventListener('click', () => { if (inSheet) box.remove(); else hide(); });
    box.append(txt, go, x);
    const set = (k) => { const ls = (k === 'rain' ? S.long_rain : S.card_text).split('\n'); l1.textContent = ls.length > 1 ? ls[0] : ''; l1.hidden = ls.length < 2; l2.textContent = ls[ls.length - 1]; };
    return { el: box, set };
  }
  const card = makeCard(false); card.el.hidden = true; scr.appendChild(card.el);

  // 메모 아래 빈 하늘. 아래 조작(정보 줄) 위 8까지. 넘치면 ① 한마디를 숨겨 메모를 올리고 ② 글 2줄째와 단추만
  function place() {
    if (card.el.hidden || !L) return;
    app.classList.remove('cr-noline'); card.el.classList.remove('compact');
    const memo = document.getElementById('memoView'), line = document.getElementById('line');
    const top0 = app.getBoundingClientRect().top;
    const base = () => { const m = memo.textContent.trim() && getComputedStyle(memo).visibility !== 'hidden' ? memo : line; return m.getBoundingClientRect().bottom - top0 + 16; };
    const lim = L.infoTop - 8;
    card.el.style.top = base() + 'px';
    if (base() + card.el.offsetHeight > lim) { app.style.setProperty('--crm', L.textY.memo - L.textY.line + 'px'); app.classList.add('cr-noline'); card.el.style.top = base() + 'px'; }
    if (base() + card.el.offsetHeight > lim) card.el.classList.add('compact');
    // ③ 그래도 넘치면(200% 확대 등) 아래 조작을 가리지 않게 위로 올린다(위쪽 글자 일부를 덮는다)
    if (base() + card.el.offsetHeight > lim) card.el.style.top = Math.max(L.sat + 8, lim - card.el.offsetHeight) + 'px';
  }
  function show(k, delay) {
    if (h) h.cancel(); kind = k; card.set(k);
    h = after(delay, () => {
      card.el.hidden = false; place();
      if (reduced) { card.el.style.opacity = ''; return; }
      card.el.style.opacity = '0'; play(240, (p) => { card.el.style.opacity = p >= 1 ? '' : p.toFixed(3); });
    });
  }
  function hide() { if (h) { h.cancel(); h = null; } card.el.hidden = true; kind = null; app.classList.remove('cr-noline'); }
  // 메모 감지 조건: 예시 아님 && 직전 저장본과 다름 && 맞는 말
  const isCrisis = (memo, prevMemo) => !store.inSample() && (memo || '') !== (prevMemo || '') && needsHelp(memo);
  function rainCount(today) { const days = store.allDays(); let n = 0; for (let i = 0; i < 7; i++) { const r = days[dayKey(addDays(parseKey(today), -i))]; if (r && (r.w === 'rain' || r.w === 'thunder')) n++; } return n; }
  // 오늘 화면 저장 뒤. 카드를 띄우기로 했으면 true
  function onSaved(o) {
    if (store.inSample()) return false;
    const today = dayKey(now());
    if (o.hit) { if (shownDay === today) return false; shownDay = today; show('memo', o.isEdit ? 520 : o.quiet ? 640 : 1560); return true; }
    if (kind === 'memo' && !needsHelp(o.memo)) hide(); // 고쳐서 맞는 말이 없어지면 거둔다
    if (o.key !== today || (o.w !== 'rain' && o.w !== 'thunder') || shownDay === today) return false;
    let last = null; try { last = localStorage.getItem(RAIN_KEY); } catch (e) { /* 저장소 없음 */ }
    if (rainCount(today) < 5 || (last && daysBetween(last, today) < 7)) return false;
    shownDay = today; try { localStorage.setItem(RAIN_KEY, today); } catch (e) { /* 저장소 없음 */ }
    show('rain', o.isEdit ? 520 : 1560); return true;
  }
  // 날짜 시트 저장 뒤: 맞으면 시트 안(메모 아래)에 넣을 카드를 돌려준다
  function sheetCard(o) {
    if (!isCrisis(o.memo, o.prevMemo)) return null;
    const today = dayKey(now()); if (shownDay === today) return null; shownDay = today;
    const c = makeCard(true); c.set('memo');
    if (!reduced) { c.el.style.opacity = '0'; after(420, () => play(240, (p) => { c.el.style.opacity = p >= 1 ? '' : p.toFixed(3); })); }
    return c.el;
  }
  function openHelp() {
    sheet.show((body) => {
      const head = el('div', 'help-head'); const x = btn('help-x'); x.setAttribute('aria-label', C.misc.close); x.innerHTML = SVG_X; x.addEventListener('click', () => sheet.close());
      head.append(el('h2', 'sh-date', S.sheet_title), x);
      body.append(head, el('p', 'sh-note', S.sheet_note));
      const list = el('div', 'help-list');
      for (const t of S.hotlines) {
        const link = !t.note; // 1388처럼 안내가 붙은 번호는 링크를 걸지 않는다(휴대전화는 지역번호가 필요)
        const row = el(link ? 'a' : 'div', 'help-row' + (link ? '' : ' nolink'));
        if (link) { row.href = 'tel:' + t.number.replace(/[^0-9]/g, ''); row.setAttribute('aria-label', fmt(C.extra.call_label, { number: t.number, name: t.name })); }
        row.append(el('span', 'help-num', t.number), el('span', 'help-name', t.name));
        if (t.note) row.append(el('span', 'help-note', t.note));
        list.append(row);
      }
      body.append(list, el('p', 'help-why', S.why));
    }, { label: S.sheet_title, tall: true });
  }
  return { isCrisis, onSaved, sheetCard, openHelp, hide, layout(newL) { L = newL; place(); }, state: () => ({ shown: !card.el.hidden, kind, compact: card.el.classList.contains('compact') }) };
}
