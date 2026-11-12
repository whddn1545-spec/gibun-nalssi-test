// 예보 화면(design-spec §8): 카드 뷰어(좌우 넘김, 이웃 카드 16씩 보임, 끌기 1:1, 70 또는 500px/s, spring-soft), 위치 줄,
// 저장(공유 창 → 파일 저장 → 이미지 띄워 길게 누르기), 다른 방법, 작성 중 카드, 빈 상태, 카드 도착 연출(§6.4, 처음 볼 때 한 번).
import { play } from '../loop.js';
import { ease, Spring, SPR, driver, springCurve, pressable } from './spring.js';
import * as store from '../store.js';
import { now } from '../dates.js';
import { skyStops, rgba } from '../palette.js';
import { cardList, analyze, cardSig } from '../week.js';
import { renderCard, stampCanvas, loadCardFonts, cardBlob, CW, STAMP } from '../card.js';
import { fmt } from '../copy.js';

const POP = springCurve(SPR.pop), SOFT = springCurve(SPR.soft);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(cls, text) { const b = el('button', cls, text); b.type = 'button'; return b; }
const UA = () => navigator.userAgent || '';
// iOS(설치 앱 포함)는 a[download]가 사진에 저장되지 않는다는 보고가 있다(research 3-c). 앱 안 브라우저도 불확실로 본다.
export function isIOS() { return /iP(hone|ad|od)/.test(UA()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
const inApp = () => /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(|DaumApps|; wv\)/i.test(UA());
export function downloadOK() { return 'download' in HTMLAnchorElement.prototype && !isIOS() && !inApp(); }

export function createForecast(env) {
  const { C, reduced, sheet, toast, vibrate } = env; const X = C.extra, F = C.forecast;
  const root = document.getElementById('screen-forecast'); const inner = root.querySelector('.inner');
  const title = document.getElementById('fcTitle'), empty = document.getElementById('fcEmpty');
  const washes = [el('div', 'fc-wash'), el('div', 'fc-wash')]; washes.forEach((x) => root.insertBefore(x, inner));
  const vp = el('div', 'fc-vp'); vp.tabIndex = 0; vp.setAttribute('role', 'group'); vp.setAttribute('aria-label', X.viewer_label);
  const track = el('div', 'fc-track'); vp.appendChild(track);
  const pos = el('div', 'fc-pos'); const posL = el('span', 'fc-period'), posR = el('span', 'fc-count'); pos.append(posL, posR);
  const save = btn('fc-save', F.save), note = el('p', 'fc-note', F.in_progress_note), other = btn('fc-other', F.other);
  // 빈 화면(fix2b): 카드 자리에 점선 테두리의 빈 통보문 + 가운데 '관측 중' 점선 도장(§8 작성 중 도장 재사용), 안내 글과 단추는 그 아래
  const ghost = el('div', 'fc-ghost'); ghost.setAttribute('aria-hidden', 'true'); ghost.hidden = true;
  inner.append(ghost, vp, pos, save, note, other);
  let ghostDpr = 0;
  function ghostStamp() {
    const d = Math.min(2, window.devicePixelRatio || 1); if (ghostDpr === d) return; ghostDpr = d;
    const st = stampCanvas({ status: 'empty', rep: 'cloudy', tod: 'night', key: 'ghost' }, C, (120 * d) / STAMP.size); st.className = 'fc-ghost-st'; ghost.textContent = ''; ghost.append(st);
  }
  pressable(save); pressable(other);
  let lastDrag = null, L = null, FL = null, items = [], sigs = '', cards = [], idx = 0, visible = false, drag = null, saving = false, arriving = null, washI = 0, washKey = '', curKey = null, pre = 0, imgURL = null;
  const cache = new Map(); // 주 키 → { sig, cv } (화면용, 현재 ±2장만)
  const blobs = new Map(); // 서명 → Promise<Blob> (저장용 1080×1350, 최근 2장)
  const sx = new Spring(0, SPR.soft, 0.05);
  const kick = driver([sx], applyX);
  const kd = () => (FL.cardW * Math.min(2, window.devicePixelRatio || 1)) / CW;
  const alt = (an) => fmt(X.card_alt, { period: an.period, title: C.app.card_title, w: C.weather[an.rep].name, t: an.avgT < 0 ? `영하 ${-an.avgT}` : an.avgT, s: an.sentence, stat: an.stat, next: an.next });

  function fcLayout() {
    const xs = L.H < 640, bn = store.inSample() ? 36 : 0, tabTop = L.H - L.sab - L.t.tab;
    let top, cardW, cardH, posY, saveY, saveH, otherY;
    // 작은 화면(fix2b): 카드 W−56(320에서 264×330), 위치 줄 +8, 저장 +26(높이 48), 다른 방법 +6 → 탭 위 끝 6 안. 예시 띠가 있으면 그만큼 카드를 줄인다
    if (xs) { top = L.sat + 48; saveH = 48; cardW = Math.min(L.W - 56, (tabTop - bn - top - 138) / 1.25); cardH = cardW * 1.25; posY = top + cardH + 8; saveY = posY + 26; otherY = saveY + saveH + 6; }
    else {
      top = L.sat + 60; saveH = 56; const stack = 28 + saveH + 4 + 44 + 6;
      cardW = L.W - 48; cardH = Math.min(cardW * 1.25, tabTop - bn - top - stack); cardW = cardH / 1.25;
      posY = top + cardH + 8; saveY = posY + 28; otherY = saveY + saveH + 4;
    }
    return { xs, top, cardW, cardH, posY, saveY, saveH, otherY, left: (L.W - cardW) / 2, pitch: (L.W + cardW) / 2 - 16, titleY: L.sat + (xs ? 12 : 16) };
  }
  function place() {
    // 빈 통보문은 카드와 같은 자리·비율. 아래 안내(약 140)와 탭 위 여백이 들어가게 높이를 줄인다
    const gh = Math.max(0, Math.min(FL.cardH, L.H - L.sab - L.t.tab - FL.top - 172)), gw = gh / 1.25;
    Object.assign(ghost.style, { top: FL.top + 'px', left: (L.W - gw) / 2 + 'px', width: gw + 'px', height: gh + 'px' });
    title.style.top = FL.titleY + 'px'; empty.style.top = FL.top + gh + 16 + 'px';
    vp.style.top = FL.top + 'px'; vp.style.height = FL.cardH + 'px';
    pos.style.top = FL.posY + 'px';
    save.style.top = FL.saveY + 'px'; save.style.height = FL.saveH + 'px';
    note.style.top = FL.saveY + (FL.saveH - 18) / 2 + 'px';
    other.style.top = FL.otherY + 'px';
  }
  function applyX() { track.style.transform = `translate3d(${(FL.left + sx.x).toFixed(2)}px,0,0)`; }
  function compute() {
    const days = store.allDays(), nd = now(); const list = cardList(days, nd);
    items = list.map((x) => analyze(x.key, days, C, nd, list));
    const s = items.map(cardSig).join('#') + '|' + store.inSample(); const changed = s !== sigs; sigs = s; return changed;
  }
  function build() {
    track.textContent = '';
    cards = items.map((an, i) => {
      const e = el('div', 'fc-card'); e.style.left = i * FL.pitch + 'px'; e.style.width = FL.cardW + 'px'; e.style.height = FL.cardH + 'px';
      e.setAttribute('role', 'img'); e.setAttribute('aria-label', alt(an)); e.dataset.key = an.key; track.appendChild(e);
      return { el: e, an, sig: null };
    });
  }
  // ---------- 그리기(현재 카드 먼저, 이웃은 잠시 뒤, 멀어진 카드는 비운다) ----------
  function paint(i) {
    const cd = cards[i]; if (!cd) return;
    const sig = cardSig(cd.an) + '|' + FL.cardW.toFixed(1);
    if (cd.sig === sig && cd.el.querySelector('canvas')) return;
    const hit = cache.get(cd.an.key); let cv;
    if (hit && hit.sig === sig) cv = hit.cv;
    else { if (hit) hit.cv.width = hit.cv.height = 0; cv = renderCard(cd.an, C, { scale: kd() }).cv; cache.set(cd.an.key, { sig, cv }); }
    if (arriving === cd.an.key) return; // 도착 연출 중에는 층을 쓰고 끝에 붙인다
    cd.el.textContent = ''; cd.el.appendChild(cv); cd.sig = sig;
  }
  function trim() {
    for (const [k, v] of [...cache]) {
      const i = items.findIndex((a) => a.key === k);
      if (i >= 0 && Math.abs(i - idx) <= 2) continue;
      cache.delete(k); const cd = cards[i]; if (cd && cd.el.contains(v.cv)) { cd.el.textContent = ''; cd.sig = null; } v.cv.width = v.cv.height = 0;
    }
  }
  function paintAround() {
    if (!FL || !cards.length) return;
    loadCardFonts().then(() => {
      if (!visible) return; paint(idx);
      setTimeout(() => { if (!visible) return; paint(idx - 1); paint(idx + 1); trim(); }, 40);
    });
  }
  // ---------- 위치·단추·바탕 ----------
  function setWash(an) {
    const c = skyStops(an.rep, an.tod)[0]; if (c === washKey) return; washKey = c;
    const a = washes[washI], b = washes[1 - washI]; washI = 1 - washI;
    b.style.background = `linear-gradient(${rgba(c, 0.32)}, ${rgba(c, 0)})`;
    if (reduced || !visible) { b.style.opacity = '1'; a.style.opacity = '0'; return; }
    const a0 = parseFloat(a.style.opacity || '0'); b.style.opacity = '0';
    play(400, (p) => { const e = ease.inout(p); b.style.opacity = e.toFixed(3); a.style.opacity = (a0 * (1 - e)).toFixed(3); });
  }
  function info() {
    const an = items[idx], has = !!an;
    vp.hidden = pos.hidden = !has; empty.hidden = has || store.inSample(); ghost.hidden = empty.hidden; if (!ghost.hidden) ghostStamp();
    if (!has) { save.hidden = note.hidden = other.hidden = true; washes.forEach((x) => { x.style.opacity = '0'; }); washKey = ''; return; }
    posL.textContent = an.period; posR.textContent = fmt(X.pos_format, { i: idx + 1, n: items.length });
    const pub = an.status === 'published'; save.hidden = other.hidden = !pub; note.hidden = pub;
    setWash(an);
  }
  function setIndex(i, how) {
    if (!items.length) { idx = 0; curKey = null; info(); return; }
    idx = Math.max(0, Math.min(items.length - 1, i)); const an = items[idx]; curKey = an.key;
    if (how === 'instant') { sx.set(-idx * FL.pitch); applyX(); } else { sx.to(-idx * FL.pitch, SPR.soft); kick(); }
    cards.forEach((cd, j) => { cd.el.classList.toggle('cur', j === idx); cd.el.setAttribute('aria-hidden', j === idx ? 'false' : 'true'); });
    info(); paintAround();
    clearTimeout(pre);
    if (an.status === 'published') {
      if (!store.inSample()) env.markSeen(an.key);
      pre = setTimeout(() => { if (visible && items[idx] === an) getBlob(an).catch(() => {}); }, 700); // 누르는 순간 바로 공유 창을 열 수 있게 미리 만든다
    }
  }
  // ---------- 끌기·키보드 ----------
  vp.addEventListener('pointerdown', (e) => { if (arriving || items.length < 2 || e.button > 0) return; drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, on: false, base: -idx * FL.pitch, hist: [[e.timeStamp, e.clientX]] }; });
  vp.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.on) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.on = true; try { vp.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } } else return; }
    drag.dx = dx; drag.hist.push([e.timeStamp, e.clientX]); if (drag.hist.length > 6) drag.hist.shift();
    let x = drag.base + dx; const min = -(items.length - 1) * FL.pitch;
    if (x > 0) x *= 0.25; else if (x < min) x = min + (x - min) * 0.25;
    sx.set(x); applyX();
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return; const d = drag; drag = null; if (!d.on) return;
    const a = d.hist[0], b = d.hist[d.hist.length - 1]; const v = b[0] > a[0] ? ((b[1] - a[1]) / (b[0] - a[0])) * 1000 : 0;
    let ni = idx;
    if (d.dx <= -70 || (v <= -500 && d.dx < 0)) ni = idx + 1; else if (d.dx >= 70 || (v >= 500 && d.dx > 0)) ni = idx - 1;
    lastDrag = { dx: Math.round(d.dx), v: Math.round(v), n: d.hist.length };
    sx.v = Math.max(-3000, Math.min(3000, v)); setIndex(ni, 'spring');
  };
  vp.addEventListener('pointerup', endDrag); vp.addEventListener('pointercancel', endDrag);
  vp.addEventListener('keydown', (e) => { const st = { ArrowLeft: -1, ArrowRight: 1 }[e.key]; if (!st || arriving) return; e.preventDefault(); setIndex(idx + st, reduced ? 'instant' : 'spring'); });

  // ---------- 저장·보내기 3단계 ----------
  function getBlob(an) {
    const s = cardSig(an); let p = blobs.get(s);
    if (!p) { p = cardBlob(an, C); p.catch(() => blobs.delete(s)); blobs.set(s, p); while (blobs.size > 2) blobs.delete(blobs.keys().next().value); }
    return p;
  }
  function shareable(file) { try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] })); } catch (e) { return false; } }
  function download(blob, name) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); toast(C.share.saved);
  }
  function showImage(blob, an) {
    if (imgURL) URL.revokeObjectURL(imgURL); imgURL = URL.createObjectURL(blob);
    sheet.show((body) => {
      const img = el('img', 'fc-img no-drag'); img.src = imgURL; img.alt = alt(an); img.style.maxHeight = Math.max(200, Math.round(L.H * 0.7 - 170)) + 'px';
      const close = btn('sh-btn', C.misc.close); close.addEventListener('click', () => sheet.close());
      body.append(img, el('p', 'fc-longpress', C.share.longpress), close);
    }, { label: C.share.longpress });
  }
  const fallback = (blob, an) => (downloadOK() ? download(blob, an.fileName) : showImage(blob, an));
  async function onSave() {
    const an = items[idx]; if (!an || an.status !== 'published' || saving) return; saving = true;
    const slow = setTimeout(() => toast(C.misc.card_rendering), 450);
    try {
      const blob = await getBlob(an); clearTimeout(slow);
      const file = new File([blob], an.fileName, { type: 'image/png' });
      if (shareable(file)) {
        try { await navigator.share({ files: [file], text: C.share.text }); }
        catch (e) { if (e && e.name === 'AbortError') return; fallback(blob, an); } // 취소는 조용히 끝(다른 길을 저절로 띄우지 않는다)
        return;
      }
      fallback(blob, an);
    } catch (e) { clearTimeout(slow); toast(C.share.failed); }
    finally { saving = false; }
  }
  function openOther() {
    const an = items[idx]; if (!an || an.status !== 'published') return;
    getBlob(an).catch(() => {});
    sheet.show((body) => {
      body.append(el('h2', 'sh-date', X.other_title));
      const opt = (t, d, route) => {
        const b = btn('sh-opt'); b.dataset.route = route; b.append(el('span', 'sh-opt-t', t), el('span', 'sh-opt-d', d));
        b.addEventListener('click', async () => { try { const blob = await getBlob(an); if (route === 'download') { sheet.close(); download(blob, an.fileName); } else showImage(blob, an); } catch (e) { toast(C.share.failed); } });
        return b;
      };
      body.append(opt(X.other_file, X.other_file_desc, 'download'), opt(X.other_image, X.other_image_desc, 'image'));
    }, { label: X.other_title });
  }
  save.addEventListener('click', onSave); other.addEventListener('click', openOther);

  // ---------- 카드 도착 연출(§6.4): 위 1.1배 높이에서 내려와 −3°→0, 460에 도장 1.5→1 + 카드 2 눌림 + 진동, 760~1200 등압선 ----------
  function playArrival(i) {
    const cd = cards[i], an = items[i]; if (!cd) return;
    arriving = an.key;
    loadCardFonts().then(() => {
      if (!visible || arriving !== an.key) { arriving = null; return; }
      const k = kd();
      const base = renderCard(an, C, { scale: k, iso: false, stamp: false }).cv;
      const iso = renderCard(an, C, { scale: k, stamp: false }).cv; iso.className = 'fc-layer'; // 등압선 있는 판을 왼쪽부터 드러냄(언덕 뒤 등압선 그대로)
      const st = stampCanvas(an, C, k); st.className = 'fc-stamp';
      const s = FL.cardW / CW, S = STAMP.size * s;
      Object.assign(st.style, { left: STAMP.x * s - S / 2 + 'px', top: STAMP.y * s - S / 2 + 'px', width: S + 'px', height: S + 'px', opacity: '0' });
      iso.style.clipPath = 'inset(0 100% 0 0)';
      cd.el.textContent = ''; cd.el.append(base, iso, st); cd.sig = null; cd.el.classList.add('arriving');
      const drop = -1.1 * FL.cardH; cd.el.style.transform = `translateY(${drop.toFixed(1)}px) rotate(-3deg)`;
      let hit = false;
      play(1260, (p, e) => {
        const q = SOFT(e), press = e >= 460 ? 2 * Math.sin(Math.PI * Math.min(1, (e - 460) / 240)) : 0;
        cd.el.style.transform = `translateY(${(drop * (1 - q) + press).toFixed(2)}px) rotate(${(-3 * (1 - q)).toFixed(3)}deg)`;
        if (e >= 460) { if (!hit) { hit = true; vibrate(20); } st.style.opacity = '1'; st.style.transform = `scale(${(1.5 - 0.5 * POP(e - 460)).toFixed(4)})`; }
        const ip = ease.out(Math.max(0, Math.min(1, (e - 760) / 440))); iso.style.clipPath = `inset(0 ${((1 - ip) * 100).toFixed(2)}% 0 0)`;
        if (p >= 1) {
          cd.el.style.transform = ''; cd.el.classList.remove('arriving'); arriving = null;
          cd.el.textContent = ''; [base, iso, st].forEach((x) => { x.width = x.height = 0; }); paint(i);
        }
      }, 160);
    });
  }

  return {
    layout(newL) { L = newL; if (!visible) return; FL = fcLayout(); place(); build(); setIndex(idx, 'instant'); },
    show() {
      visible = true; FL = fcLayout(); place(); compute(); build();
      const ak = store.inSample() ? null : env.arrivalKey();
      let t = items.length - 1; const want = ak || curKey;
      if (want) { const j = items.findIndex((a) => a.key === want); if (j >= 0) t = j; }
      const arrive = !!(ak && items[t] && items[t].key === ak && !reduced);
      setIndex(t, 'instant');
      if (arrive) playArrival(t);
    },
    hide() { visible = false; clearTimeout(pre); arriving = null; },
    // 자료·예시 데이터·시각이 바뀌었을 때. 보이는 중이고 카드 목록이 바뀐 경우만 다시 만든다.
    refresh() {
      if (!visible) { sigs = ''; return; }
      FL = fcLayout(); place();
      if (!compute()) return;
      build(); let t = items.length - 1; if (curKey) { const j = items.findIndex((a) => a.key === curKey); if (j >= 0) t = j; }
      setIndex(t, 'instant');
    },
    state() { const an = items[idx]; return { n: items.length, idx, key: an ? an.key : null, status: an ? an.status : null, rep: an ? an.rep : null, save: !save.hidden, note: !note.hidden, other: !other.hidden, empty: !empty.hidden, pos: posR.textContent, period: posL.textContent, painted: cards.filter((c) => c.el.querySelector('canvas')).length, arriving: !!arriving, x: sx.x, FL, lastDrag }; },
  };
}
