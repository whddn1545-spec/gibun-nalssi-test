// '나의 기분 일기예보' 카드 이미지 (1080×1350 PNG, 인스타·카톡에 알맞은 4:5). Canvas 2D로 직접 그린다.
import { DOW, fmtMD } from './dates.js';
import { iconImage, svgImage, TONE } from './icons.js';
import { sceneSVG } from './art.js';

export const CARD_W = 1080;
export const CARD_H = 1350;
const FONT = 'Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const INK = '#46352D';
const INK2 = '#8E7566';
const EDGE = '#F1E2D0';
const EDGE2 = '#E7D1BA';
const PAPER = { initial: '#FFF6EC', sunny: '#FFF7E6', rainbow: '#FFF5F1', cloudy: '#FAF5F0', snow: '#F8F6FC', rain: '#F4F4F8', thunder: '#F6F1F8' };
const ACCENT = { initial: '#CFC0F4', sunny: '#FFC94F', rainbow: '#FFA6BE', cloudy: '#C5C9DB', snow: '#ABC7F2', rain: '#93B2E0', thunder: '#B69DE2' };

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 스티커처럼: 아래로 단색 그림자 + 테두리 */
function sticker(g, x, y, w, h, r, { fill = '#FFFDF9', edge = EDGE, drop = EDGE2, dropY = 9, line = 5 } = {}) {
  g.fillStyle = drop;
  rr(g, x, y + dropY, w, h, r);
  g.fill();
  g.fillStyle = fill;
  rr(g, x, y, w, h, r);
  g.fill();
  if (line) {
    g.lineWidth = line;
    g.strokeStyle = edge;
    rr(g, x, y, w, h, r);
    g.stroke();
  }
}

function wrap(g, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width <= maxW) { line = test; continue; }
    if (line) lines.push(line);
    if (g.measureText(w).width <= maxW) { line = w; continue; }
    let part = '';
    for (const ch of w) {
      if (g.measureText(part + ch).width > maxW) { lines.push(part); part = ch; } else part += ch;
    }
    line = part;
  }
  if (line) lines.push(line);
  return lines;
}

function fitFont(g, text, weight, size, min, maxW) {
  let s = size;
  g.font = `${weight} ${s}px ${FONT}`;
  while (g.measureText(text).width > maxW && s > min) {
    s -= 2;
    g.font = `${weight} ${s}px ${FONT}`;
  }
  return s;
}

function grain(g) {
  const p = document.createElement('canvas');
  p.width = p.height = 96;
  const pg = p.getContext('2d');
  let s = 42;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260; i++) {
    pg.fillStyle = `rgba(120,86,60,${0.035 + rnd() * 0.05})`;
    pg.fillRect(Math.floor(rnd() * 96), Math.floor(rnd() * 96), 1.4, 1.4);
  }
  g.fillStyle = g.createPattern(p, 'repeat');
  g.fillRect(0, 0, CARD_W, CARD_H);
}

export async function renderCard({ days, s, mon }) {
  if (document.fonts && document.fonts.load) {
    await Promise.all(['800 72px', '700 36px', '500 34px'].map((f) => document.fonts.load(`${f} Pretendard`))).catch(() => {});
  }
  const top = s.top || 'initial';
  const ids = new Set(days.filter((d) => d.entry).map((d) => d.entry.w));
  ids.add(s.next ? s.next.w : 'cloudy');
  const imgs = {};
  await Promise.all([...ids].map(async (id) => { imgs[id] = await iconImage(id, 240); }));
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const g = c.getContext('2d');
  g.textBaseline = 'alphabetic';
  const X = 60;
  const IW = CARD_W - X * 2;

  // ---- 자리 잡기: 아래에서부터 쌓아 겹치지 않게
  g.font = `500 34px ${FONT}`;
  const detail = wrap(g, s.detail || '', IW - 128).slice(0, 2);
  const FOOT_Y = CARD_H - 34; // 바닥 글씨 기준선
  const nh = 128; // 다음 주 예보 칸
  const ny = FOOT_Y - 44 - nh;
  const dh = 226; // 일주일 칸
  const dy = ny - 30 - dh;
  const bh = 128 + detail.length * 46; // 말풍선
  const by = dy - 34 - bh;
  const hy = 252; // 하늘 액자
  const hh = by + 64 - hy;
  const HERO_W = IW - 28;
  const HERO_H = hh - 28;
  const heroSvg = sceneSVG(top, { width: HERO_W * 2, height: HERO_H * 2, ratio: HERO_W / HERO_H, top: 8 });
  const hero = await svgImage(heroSvg);

  // 종이
  g.fillStyle = PAPER[top];
  g.fillRect(0, 0, CARD_W, CARD_H);
  grain(g);

  // 머리: 상표 · 날짜
  g.font = `800 30px ${FONT}`;
  const brand = '기분날씨 WEEKLY';
  const bw = g.measureText(brand).width + 52;
  sticker(g, X, 54, bw, 62, 31, { fill: '#FFEBDA', edge: '#FFEBDA', drop: '#F3D3BC', dropY: 5, line: 0 });
  g.fillStyle = '#A3765A';
  g.fillText(brand, X + 26, 96);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const range = `${fmtMD(mon)} – ${fmtMD(sun)}`;
  g.font = `700 30px ${FONT}`;
  const rw = g.measureText(range).width + 48;
  sticker(g, CARD_W - X - rw, 54, rw, 62, 31, { fill: '#FFFDF9', dropY: 5, line: 4 });
  g.fillStyle = INK2;
  g.fillText(range, CARD_W - X - rw + 24, 96);

  // 제목 (형광펜은 '일기예보' 아래, 글씨 뒤에)
  const SOFT = { initial: '#ECE4FF', sunny: '#FFE6A3', rainbow: '#FFDDE8', cloudy: '#E6E7F0', snow: '#DEE8FB', rain: '#D8E4F6', thunder: '#E7DDF8' };
  g.font = `800 74px ${FONT}`;
  const pre = g.measureText('나의 기분 ').width;
  const hw = g.measureText('일기예보').width;
  g.save();
  g.translate(X + pre - 6, 186);
  g.rotate(-0.018);
  g.fillStyle = SOFT[top];
  rr(g, 0, 0, hw + 14, 32, 14);
  g.fill();
  g.restore();
  g.fillStyle = INK;
  g.fillText('나의 기분 일기예보', X, 212);

  // 하늘 그림 (흰 테두리 액자)
  sticker(g, X, hy, IW, hh, 70, { fill: '#FFFFFF', edge: '#FFFFFF', drop: EDGE2, dropY: 10, line: 0 });
  g.save();
  rr(g, X + 14, hy + 14, HERO_W, HERO_H, 58);
  g.clip();
  g.drawImage(hero, X + 14, hy + 14, HERO_W, HERO_H);
  g.restore();

  // 몽글이 예보관 말풍선
  sticker(g, X + 30, by, IW - 60, bh, 40, { fill: '#FFFDF8', dropY: 8, line: 5 });
  g.save();
  g.translate(X + 62, by - 4);
  g.rotate(-0.07);
  g.font = `800 28px ${FONT}`;
  const tag = '몽글이 예보관';
  const tw = g.measureText(tag).width + 40;
  g.fillStyle = '#FFFDF8';
  rr(g, -6, -34, tw + 12, 60, 30);
  g.fill();
  g.fillStyle = ACCENT[top];
  rr(g, 0, -28, tw, 48, 24);
  g.fill();
  g.fillStyle = INK;
  g.fillText(tag, 20, 6);
  g.restore();
  g.fillStyle = INK;
  fitFont(g, s.headline, 800, 64, 40, IW - 128);
  g.fillText(s.headline, X + 64, by + 104);
  g.font = `500 34px ${FONT}`;
  g.fillStyle = INK2;
  detail.forEach((ln, i) => g.fillText(ln, X + 64, by + 156 + i * 46));

  // 일주일: 요일 / 그림 / 날짜가 서로 닿지 않게
  sticker(g, X, dy, IW, dh, 44, { fill: '#FFFDF9', dropY: 8, line: 5 });
  const colW = (IW - 30) / 7;
  days.forEach((d, i) => {
    const cx = X + 15 + colW * i + colW / 2;
    if (d.entry && TONE[d.entry.w]) {
      g.fillStyle = TONE[d.entry.w].tint;
      rr(g, cx - colW / 2 + 6, dy + 14, colW - 12, dh - 28, 30);
      g.fill();
    }
    g.textAlign = 'center';
    g.font = `800 30px ${FONT}`;
    g.fillStyle = d.date.getDay() === 0 ? '#E8836B' : d.date.getDay() === 6 ? '#7B9CD0' : INK2;
    g.fillText(DOW[d.date.getDay()], cx, dy + 56);
    if (d.entry && imgs[d.entry.w]) {
      g.drawImage(imgs[d.entry.w], cx - 42, dy + 70, 84, 84);
    } else if (d.future) {
      g.fillStyle = '#EFE3D6';
      g.beginPath();
      g.arc(cx, dy + 112, 9, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = '#E3CDB8';
      g.setLineDash([8, 9]);
      g.lineWidth = 4;
      g.beginPath();
      g.arc(cx, dy + 112, 26, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    g.font = `800 28px ${FONT}`;
    g.fillStyle = d.entry ? INK2 : d.future ? '#DDCCBB' : '#C9B4A2';
    g.fillText(String(d.date.getDate()), cx, dy + 196);
    g.textAlign = 'left';
  });

  // 다음 주 예보
  sticker(g, X, ny, IW, nh, 40, { fill: '#FFF1E4', edge: '#FFE4CF', drop: '#F3D3BC', dropY: 6, line: 4 });
  const nextIcon = imgs[s.next ? s.next.w : 'cloudy'];
  if (nextIcon) g.drawImage(nextIcon, X + 24, ny + nh / 2 - 38, 76, 76);
  g.fillStyle = INK;
  const nextText = s.next ? `다음 주 ${s.next.label} · 맑음 확률 ${s.next.prob}%` : '다음 주 예보 준비 중';
  const nextLine = s.next ? s.next.line : s.nextText || '';
  fitFont(g, nextText, 800, 36, 26, IW - 150);
  g.fillText(nextText, X + 120, ny + nh / 2 - 6);
  fitFont(g, nextLine, 500, 29, 22, IW - 150);
  g.fillStyle = INK2;
  g.fillText(nextLine, X + 120, ny + nh / 2 + 36);

  // 바닥 글씨
  g.font = `700 25px ${FONT}`;
  g.fillStyle = '#B49C88';
  g.textAlign = 'right';
  const rec = s.recorded === 7 ? '7일 모두 기록' : `7일 중 ${s.recorded}일 기록`;
  g.fillText(`맑음 지수 ${s.index == null ? '–' : s.index} · ${rec} · 기분날씨`, CARD_W - X, FOOT_Y);
  g.textAlign = 'left';
  return c;
}

export async function renderCardBlob(args) {
  const c = await renderCard(args);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}
