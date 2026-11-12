// 친구에게 보낼 주간 카드. 화면에 보이는 그림과 저장되는 이미지가 같다.

import { renderStill } from './sky.js';
import { iconImage } from './icons.js';
import { W } from './weather.js';
import { parseKey } from './util.js';
import * as store from './store.js';

export const CARD_W = 1080;
export const CARD_H = 1350;

const UI_FONT = '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
const DISPLAY_FONT = '"Gowun Batang", "AppleMyungjo", "Noto Serif KR", serif';

const THEME = {
  clear: { bg: ['#BDE0FF', '#FFEDD0'], dark: false },
  rainbow: { bg: ['#C8E2FF', '#FFDCE9'], dark: false },
  cloud: { bg: ['#C9D5E3', '#EFEAE2'], dark: false },
  snow: { bg: ['#D0DDF1', '#F6F2F5'], dark: false },
  wind: { bg: ['#C1E0EF', '#EDF3DC'], dark: false },
  fog: { bg: ['#D2D8DE', '#EDEBE5'], dark: false },
  rain: { bg: ['#21344A', '#44596F'], dark: true },
  thunder: { bg: ['#16132D', '#3A3062'], dark: true },
};

let assets = null;
function ready() {
  if (!assets) {
    const fonts = ['400 34px "Pretendard"', '600 34px "Pretendard"', '700 34px "Pretendard"', '800 34px "Pretendard"', '700 90px "Gowun Batang"'];
    assets = Promise.all([
      ...fonts.map((f) => document.fonts.load(f, '가나다맑음0123').catch(() => null)),
      ...Object.keys(W).map((id) => iconImage(id, 240)),
    ]);
  }
  return assets;
}

function archPath(g, x, y, w, h, rb) {
  const r = w / 2;
  g.beginPath();
  g.moveTo(x, y + r);
  g.arc(x + r, y + r, r, Math.PI, 0);
  g.lineTo(x + w, y + h - rb);
  g.arcTo(x + w, y + h, x + w - rb, y + h, rb);
  g.lineTo(x + rb, y + h);
  g.arcTo(x, y + h, x, y + h - rb, rb);
  g.closePath();
}

// 한국어는 어절 단위로 줄을 바꾸고, 어절이 너무 길 때만 글자 단위로 끊는다
function wrap(g, text, maxW) {
  const lines = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (g.measureText(next).width <= maxW) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = '';
    if (g.measureText(word).width <= maxW) {
      cur = word;
      continue;
    }
    for (const ch of word) {
      if (g.measureText(cur + ch).width > maxW) {
        lines.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fitFont(g, text, weight, family, maxSize, maxW) {
  let size = maxSize;
  for (; size > 30; size -= 2) {
    g.font = `${weight} ${size}px ${family}`;
    if (g.measureText(text).width <= maxW) break;
  }
  return size;
}

export async function paintCard(canvas, fc, pixelWidth = CARD_W) {
  await ready();
  const k = pixelWidth / CARD_W;
  canvas.width = Math.round(CARD_W * k);
  canvas.height = Math.round(CARD_H * k);
  const g = canvas.getContext('2d');
  g.setTransform(k, 0, 0, k, 0, 0);

  const theme = THEME[fc.dominant];
  const ink = theme.dark ? '#F5F7FF' : '#1E2942';
  const soft = theme.dark ? 'rgba(245,247,255,.74)' : 'rgba(30,41,66,.68)';
  const faint = theme.dark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.58)';
  const faintStroke = theme.dark ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.85)';

  const bg = g.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, theme.bg[0]);
  bg.addColorStop(1, theme.bg[1]);
  g.fillStyle = bg;
  g.fillRect(0, 0, CARD_W, CARD_H);
  g.textBaseline = 'alphabetic';

  // 머리글
  g.fillStyle = ink;
  g.textAlign = 'left';
  g.font = `700 36px ${UI_FONT}`;
  g.fillText('나의 기분 일기예보', 72, 100);
  g.textAlign = 'right';
  g.fillStyle = soft;
  g.font = `600 32px ${UI_FONT}`;
  g.fillText(fc.complete ? fc.range : `${fc.range} 중간 예보`, CARD_W - 72, 100);

  // 아치 창문
  const archW = 640;
  const archH = 470;
  const ax = (CARD_W - archW) / 2;
  const ay = 140;
  const rb = 44;
  g.save();
  g.shadowColor = theme.dark ? 'rgba(0,0,0,.5)' : 'rgba(40,70,120,.28)';
  g.shadowBlur = 56 * k;
  g.shadowOffsetY = 22 * k;
  g.fillStyle = theme.bg[0];
  archPath(g, ax, ay, archW, archH, rb);
  g.fill();
  g.restore();

  const garden = store.all().filter((e) => e.key <= fc.sunday);
  const scenePx = Math.max(archW, Math.round(archW * k * 1.5));
  const scale = scenePx / archW;
  const still = renderStill(fc.dominant, scenePx, Math.round(archH * scale), {
    date: parseKey(fc.sunday),
    garden,
    days: garden.length,
  });
  g.save();
  archPath(g, ax, ay, archW, archH, rb);
  g.clip();
  g.drawImage(still, ax, ay, archW, archH);
  g.restore();
  archPath(g, ax + 1.5, ay + 1.5, archW - 3, archH - 3, rb - 1.5);
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(255,255,255,.5)';
  g.stroke();

  // 창문 안 오른쪽 아래의 작은 앱 이름
  g.save();
  g.textAlign = 'right';
  g.font = `700 24px ${UI_FONT}`;
  g.fillStyle = 'rgba(255,255,255,.95)';
  g.shadowColor = 'rgba(30,41,66,.55)';
  g.shadowBlur = 8 * k;
  g.shadowOffsetY = 1 * k;
  g.fillText('기분날씨', ax + archW - 34, ay + archH - 26);
  g.restore();

  // 큰 제목과 본문은 창문과 7일 칸 사이의 가운데에 놓는다
  const ty = 932;
  g.textAlign = 'center';
  g.font = `500 32px ${UI_FONT}`;
  const lines = wrap(g, fc.body, CARD_W - 150).slice(0, 3);
  const blockH = 88 + 30 + lines.length * 46;
  const blockTop = ay + archH + (ty - (ay + archH) - blockH) / 2;

  g.fillStyle = ink;
  const titleSize = fitFont(g, fc.headline, 700, DISPLAY_FONT, 88, CARD_W - 150);
  g.font = `700 ${titleSize}px ${DISPLAY_FONT}`;
  g.fillText(fc.headline, CARD_W / 2, blockTop + 78);

  g.font = `500 32px ${UI_FONT}`;
  g.fillStyle = soft;
  lines.forEach((line, i) => g.fillText(line, CARD_W / 2, blockTop + 88 + 30 + 30 + i * 46));

  // 7일 창문
  const tileW = 118;
  const tileH = 138;
  const gap = 15;
  const totalW = tileW * 7 + gap * 6;
  const x0 = (CARD_W - totalW) / 2;
  for (let i = 0; i < 7; i++) {
    const d = fc.days[i];
    const x = x0 + i * (tileW + gap);
    if (d.w) {
      const def = W[d.w];
      const tg = g.createLinearGradient(0, ty, 0, ty + tileH);
      tg.addColorStop(0, def.tile[0]);
      tg.addColorStop(0.62, def.tile[1]);
      tg.addColorStop(1, def.tile[2]);
      g.fillStyle = tg;
      archPath(g, x, ty, tileW, tileH, 22);
      g.fill();
      const img = await iconImage(d.w, 240);
      const s = 88;
      g.drawImage(img, x + (tileW - s) / 2, ty + tileH - s - 13, s, s);
    } else {
      g.fillStyle = faint;
      archPath(g, x, ty, tileW, tileH, 22);
      g.fill();
      archPath(g, x + 1, ty + 1, tileW - 2, tileH - 2, 21);
      g.lineWidth = 2;
      g.strokeStyle = faintStroke;
      g.stroke();
      g.fillStyle = soft;
      g.font = `600 36px ${UI_FONT}`;
      g.textAlign = 'center';
      g.fillText('·', x + tileW / 2, ty + tileH / 2 + 22);
    }
    g.textAlign = 'center';
    g.fillStyle = d.w ? ink : soft;
    g.font = `700 28px ${UI_FONT}`;
    g.fillText(d.label, x + tileW / 2, ty + tileH + 38);
  }

  // 수치와 전망
  const statsY = 1128;
  const statsH = 104;
  g.fillStyle = faint;
  roundRect(g, 72, statsY, CARD_W - 144, statsH, 30);
  g.fill();
  roundRect(g, 73, statsY + 1, CARD_W - 146, statsH - 2, 29);
  g.lineWidth = 2;
  g.strokeStyle = faintStroke;
  g.stroke();

  const stat = (cx, label, value) => {
    g.textAlign = 'center';
    g.fillStyle = soft;
    g.font = `600 24px ${UI_FONT}`;
    g.fillText(label, cx, statsY + 38);
    g.fillStyle = ink;
    g.font = `800 40px ${UI_FONT}`;
    g.fillText(value, cx, statsY + 85);
  };
  const third = (CARD_W - 144) / 3;
  stat(72 + third / 2, '평균 마음 기온', `${fc.avgTemp}°`);
  stat(72 + third * 1.5, '마음 강수확률', `${fc.rainPct}%`);
  stat(72 + third * 2.5, '맑은 날', `${fc.brightDays}일`);

  g.textAlign = 'center';
  g.fillStyle = ink;
  const outlookSize = fitFont(g, fc.outlook, 600, UI_FONT, 31, CARD_W - 144);
  g.font = `600 ${outlookSize}px ${UI_FONT}`;
  g.fillText(fc.outlook, CARD_W / 2, 1282);

  const tip = `생활 기상 정보 · ${fc.tip}`;
  g.fillStyle = soft;
  const tipSize = fitFont(g, tip, 500, UI_FONT, 26, CARD_W - 144);
  g.font = `500 ${tipSize}px ${UI_FONT}`;
  g.fillText(tip, CARD_W / 2, 1322);

  return canvas;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export async function cardBlob(fc) {
  const canvas = document.createElement('canvas');
  await paintCard(canvas, fc, CARD_W);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요'))), 'image/png');
  });
}
