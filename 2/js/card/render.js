// 예보 카드를 1080×1350 PNG로 그린다. 캔버스 2D만 쓰고, 메모는 카드에 넣지 않는다.
// 하늘 그림은 sky.paintStill이 있으면 그것을 쓰고, 없거나 실패하면 그라데이션과 언덕으로 대신한다.

const W = 1080;
const H = 1350;
const M = 76; // 좌우 여백
const TEXT_W = W - M * 2;

// 하늘 엔진은 언덕 꼭대기를 화면 높이의 약 62%에 둔다. 사람이 그 위에 앉으므로 제목은 그보다 위에 둔다.
const HILL = 0.62;
// 언덕 위로 올라오는 사람의 높이(카드 크기 기준). 우산을 쓰거나 팔을 든 날씨는 더 높다.
const PERSON = { rain: 130, thunder: 130, rainbow: 115, default: 95 };

const UI = '"Gibun Sans", -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
const SERIF = '"Gowun Batang", "Noto Serif KR", "AppleMyungjo", serif';

const PAPER = '#fbf8f2';
const PAPER_2 = '#f3eee3';
const INK = '#1b2447';
const INK_2 = '#566083';
const INK_3 = '#98a0b8';
const LINE = '#e6e1d6';

// 대표 날씨별 포인트 색 (종이 위에서 읽히는 진한 쪽)
const ACCENT = {
  sunny: '#e8860c', cloudy: '#5f7aa6', rain: '#3a72dc', thunder: '#7048d2', snow: '#4a9ac9', rainbow: '#e0508f', none: '#5f7aa6',
};

// sky.paintStill이 없을 때 쓰는 하늘 (낮 위, 중간, 아래, 먼 언덕, 가까운 언덕 위, 아래)
const FALLBACK_SKY = {
  none: ['#5E8FD6', '#A9C6EC', '#F6E2D3', '#7FA3B8', '#7DAE9A', '#4F8676'],
  sunny: ['#1E6FE3', '#4FA4F2', '#FFE2AE', '#6FB6A0', '#7CCB7A', '#3F9A63'],
  cloudy: ['#7488A6', '#A5B5CA', '#E7E4DD', '#7E97A0', '#7FA28F', '#557A6C'],
  rain: ['#2F3F59', '#4E6380', '#8CA0B5', '#44586B', '#4A7269', '#2E5050'],
  thunder: ['#1A1636', '#3A2C62', '#7A5384', '#2C2649', '#33355A', '#1C1C38'],
  snow: ['#9DBBDD', '#CFE0F2', '#F7FAFD', '#D5E3F0', '#F2F7FC', '#C9D9EA'],
  rainbow: ['#2F7BE6', '#6DB7F5', '#FFD9E0', '#86CDB8', '#90DDA0', '#4FB489'],
};

const imageCache = new Map();

function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return imageCache.get(src);
}

const weatherIcon = (id) => loadImage(`assets/weather/${id}.svg`);

async function loadFonts(sample) {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load('700 100px "Gowun Batang"', sample),
      document.fonts.load('400 30px "Gibun Sans"', sample),
      document.fonts.load('700 30px "Gibun Sans"', sample),
    ]);
  } catch { /* 글꼴이 없어도 대체 글꼴로 그린다 */ }
}

// ── 그리기 도구 ──────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  const rr = typeof r === 'number' ? [r, r, r, r] : r; // 좌상, 우상, 우하, 좌하
  ctx.beginPath();
  ctx.moveTo(x + rr[0], y);
  ctx.lineTo(x + w - rr[1], y);
  ctx.arcTo(x + w, y, x + w, y + rr[1], rr[1]);
  ctx.lineTo(x + w, y + h - rr[2]);
  ctx.arcTo(x + w, y + h, x + w - rr[2], y + h, rr[2]);
  ctx.lineTo(x + rr[3], y + h);
  ctx.arcTo(x, y + h, x, y + h - rr[3], rr[3]);
  ctx.lineTo(x, y + rr[0]);
  ctx.arcTo(x, y, x + rr[0], y, rr[0]);
  ctx.closePath();
}

const setFont = (ctx, weight, size, family = UI) => { ctx.font = `${weight} ${size}px ${family}`; };

function setSpacing(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

function text(ctx, str, x, y, { color, align = 'left', baseline = 'alphabetic' }) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

// token: { text, weight, size, family?, color? }
function measure(ctx, token, str = token.text) {
  setFont(ctx, token.weight, token.size, token.family);
  return ctx.measureText(str).width;
}

// 어절 단위로 줄을 나눈다. 어절 하나가 한 줄보다 길면 글자 단위로 자른다.
function greedyLines(ctx, tokens, maxWidth) {
  const lines = [];
  let line = [];
  let width = 0;
  const flush = () => { if (line.length) lines.push(line); line = []; width = 0; };
  for (const token of tokens) {
    const w = measure(ctx, token);
    const space = line.length ? measure(ctx, token, ' ') : 0;
    if (line.length && width + space + w > maxWidth) flush();
    if (w > maxWidth) {
      let chunk = '';
      for (const ch of token.text) {
        if (chunk && measure(ctx, token, chunk + ch) > maxWidth) {
          line.push({ ...token, text: chunk });
          flush();
          chunk = '';
        }
        chunk += ch;
      }
      if (chunk) { line.push({ ...token, text: chunk }); width = measure(ctx, token, chunk); }
      continue;
    }
    width += (line.length ? space : 0) + w;
    line.push(token);
  }
  flush();
  return lines;
}

// 줄 수는 그대로 두고 줄 길이를 고르게 맞춘다. 마지막 줄에 한두 글자만 남는 것을 막는다.
function balancedLines(ctx, tokens, maxWidth, floor = 0.7) {
  const base = greedyLines(ctx, tokens, maxWidth);
  if (base.length < 2) return base;
  let lo = maxWidth * floor;
  let hi = maxWidth;
  let best = base;
  for (let i = 0; i < 12; i += 1) {
    const mid = (lo + hi) / 2;
    const trial = greedyLines(ctx, tokens, mid);
    if (trial.length <= base.length) { best = trial; hi = mid; } else lo = mid;
  }
  return best;
}

const words = (str, weight, size, extra = {}) => str.split(/\s+/).filter(Boolean).map((t) => ({ text: t, weight, size, ...extra }));

function drawLine(ctx, line, x, y, defaultColor) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let cursor = x;
  line.forEach((token, i) => {
    if (i) cursor += measure(ctx, token, ' ');
    setFont(ctx, token.weight, token.size, token.family);
    ctx.fillStyle = token.color ?? defaultColor;
    ctx.fillText(token.text, cursor, y);
    cursor += measure(ctx, token);
  });
}

// ── 하늘 ─────────────────────────────────────────────

async function drawSky(ctx, h, weather, sky, iconRoom, keepClear) {
  const [top, mid, low, far, nearTop, nearLow] = FALLBACK_SKY[weather ?? 'none'];

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, low);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, h);

  if (sky && typeof sky.paintStill === 'function') {
    try {
      const layer = document.createElement('canvas');
      layer.width = W;
      layer.height = h;
      const layerCtx = layer.getContext('2d');
      await sky.paintStill(layerCtx, W, h, weather, { hour: 12, hill: true, garden: null, keepClear });
      // 아무것도 안 그리는 빈 구현이면 알파가 0이므로 대체 그림을 그대로 둔다.
      const alpha = (x, y) => layerCtx.getImageData(x, y, 1, 1).data[3];
      if (alpha(Math.floor(W / 2), Math.floor(h / 2)) > 0 || alpha(40, 40) > 0) {
        ctx.drawImage(layer, 0, 0);
        return;
      }
    } catch { /* 아래 대체 그림으로 이어진다 */ }
  }

  // 대체 그림: 먼 언덕, 가까운 언덕, 큰 날씨 아이콘
  const hillTop = h * HILL;
  const icon = await weatherIcon(weather ?? 'cloudy');
  if (icon && iconRoom > 260) ctx.drawImage(icon, W - M - 250, hillTop - 250, 250, 250);
  const farGrad = ctx.createLinearGradient(0, hillTop, 0, h);
  farGrad.addColorStop(0, far);
  farGrad.addColorStop(1, nearLow);
  ctx.fillStyle = farGrad;
  ctx.beginPath();
  ctx.ellipse(W * 0.78, hillTop + 260, 560, 260, 0, 0, Math.PI * 2);
  ctx.fill();
  const nearGrad = ctx.createLinearGradient(0, hillTop, 0, h);
  nearGrad.addColorStop(0, nearTop);
  nearGrad.addColorStop(1, nearLow);
  ctx.fillStyle = nearGrad;
  ctx.beginPath();
  ctx.ellipse(W * 0.2, hillTop + 300, 640, 280, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── 머리: 발표 표시, 기간, 큰 제목 ──────────────────

const HEAD_TOP = 130; // 제목 글자 윗선

function headlineLayout(ctx, str) {
  const widthAt = (size) => { setFont(ctx, 700, size, SERIF); return ctx.measureText(str).width; };
  let layout = null;
  for (let size = 108; size >= 88 && !layout; size -= 4) {
    if (widthAt(size) <= TEXT_W) layout = { lines: [str], size };
  }
  for (let size = 80; size >= 60 && !layout; size -= 4) {
    const lines = balancedLines(ctx, words(str, 700, size, { family: SERIF }), TEXT_W, 0.4);
    if (lines.length <= 2) layout = { lines: lines.map((l) => l.map((t) => t.text).join(' ')), size };
  }
  layout ??= { lines: [str], size: 60 };
  layout.lineH = layout.size * 1.12;
  layout.first = HEAD_TOP + layout.size * 0.86;
  layout.bottom = layout.first + (layout.lines.length - 1) * layout.lineH + layout.size * 0.2;
  return layout;
}

function drawHeader(ctx, f, light) {
  const ink = light ? '#ffffff' : INK;
  const label = `${f.observing ? '관측 중' : '마음기상청 발표'} · 제${f.issue}호`;
  setFont(ctx, 650, 27);
  setSpacing(ctx, 0.5);
  const padX = 26;
  const pillH = 56;
  const pillW = ctx.measureText(label).width + padX * 2 + 32;
  const py = 54;
  roundRect(ctx, M, py, pillW, pillH, pillH / 2);
  ctx.fillStyle = light ? 'rgba(255,255,255,0.2)' : 'rgba(27,36,71,0.1)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = light ? 'rgba(255,255,255,0.42)' : 'rgba(27,36,71,0.2)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(M + padX + 7, py + pillH / 2, 7, 0, Math.PI * 2);
  ctx.fillStyle = f.observing ? '#ffd36b' : '#7ef0b0';
  ctx.fill();
  text(ctx, label, M + padX + 29, py + pillH / 2 + 1, { color: ink, baseline: 'middle' });
  setSpacing(ctx, 0);

  setFont(ctx, 600, 28);
  ctx.save();
  if (light) { ctx.shadowColor = 'rgba(8,20,60,0.4)'; ctx.shadowBlur = 12; }
  text(ctx, f.period, W - M, py + pillH / 2 + 1, {
    color: light ? 'rgba(255,255,255,0.95)' : 'rgba(27,36,71,0.8)', align: 'right', baseline: 'middle',
  });
  ctx.restore();
}

function drawHeadline(ctx, layout, light) {
  ctx.save();
  if (light) {
    ctx.shadowColor = 'rgba(8,20,60,0.4)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 6;
  }
  setFont(ctx, 700, layout.size, SERIF);
  layout.lines.forEach((line, i) => {
    text(ctx, line, M, layout.first + i * layout.lineH, { color: light ? '#ffffff' : INK });
  });
  ctx.restore();
}

// ── 일주일 줄 ────────────────────────────────────────

// 그 주의 기온 범위를 선 높이에 맞춘다. 차이가 작아도 12도 폭은 확보해 선이 너무 요동치지 않게 한다.
function curvePoints(days, colW, y0, height) {
  const temps = days.filter((d) => d.temp !== null).map((d) => d.temp);
  const min = temps.length ? Math.min(...temps) : 20;
  const max = temps.length ? Math.max(...temps) : 20;
  const span = Math.max(12, max - min);
  const base = (max + min) / 2 - span / 2;
  return days.map((d, i) => {
    if (d.temp === null) return null;
    return { x: M + colW * (i + 0.5), y: y0 + height * (1 - (d.temp - base) / span), temp: d.temp };
  });
}

function strokeSmooth(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const k = 0.18;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) * k, p1.y + (p2.y - p0.y) * k,
      p2.x - (p3.x - p1.x) * k, p2.y - (p3.y - p1.y) * k,
      p2.x, p2.y,
    );
  }
  ctx.stroke();
}

const WEEK_H = 262;

async function drawWeek(ctx, f, y, accent) {
  const colW = TEXT_W / 7;
  const curveTop = y + 40;
  const curveH = 44;
  const pts = curvePoints(f.days, colW, curveTop, curveH);

  // 이어진 날끼리만 선으로 잇는다.
  ctx.save();
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = accent;
  let run = [];
  const runs = [];
  pts.forEach((p) => {
    if (p) run.push(p);
    else { runs.push(run); run = []; }
  });
  runs.push(run);
  runs.forEach((r) => strokeSmooth(ctx, r));
  ctx.restore();

  pts.forEach((p) => {
    if (!p) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();
    setFont(ctx, 700, 28);
    text(ctx, `${p.temp}°`, p.x, p.y - 20, { color: INK, align: 'center' });
  });

  const iconY = curveTop + curveH + 28;
  const size = 80;
  const icons = await Promise.all(f.days.map((d) => (d.weather ? weatherIcon(d.weather) : null)));
  f.days.forEach((d, i) => {
    const cx = M + colW * (i + 0.5);
    if (d.weather && icons[i]) {
      ctx.drawImage(icons[i], cx - size / 2, iconY, size, size);
    } else {
      ctx.save();
      ctx.setLineDash([1, 12]);
      ctx.lineCap = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#cfcabd';
      ctx.beginPath();
      ctx.arc(cx, iconY + size / 2, 27, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    setFont(ctx, 700, 28);
    text(ctx, d.label, cx, iconY + size + 36, { color: INK, align: 'center' });
    setFont(ctx, 500, 21);
    text(ctx, String(Number(d.date.slice(8))), cx, iconY + size + 60, { color: INK_3, align: 'center' });
  });
}

// ── 수치와 꼬리 ──────────────────────────────────────

const STATS_H = 82;

function drawStats(ctx, f, y, accent) {
  const colW = TEXT_W / 3;
  const cells = [
    { label: '마음 기온', value: f.stats.temp === null ? '–' : `${f.stats.temp}°` },
    { label: '마음 강수확률', value: f.stats.rainChance === null ? '–' : `${f.stats.rainChance}%` },
    { label: '맑은 날', value: `${f.stats.clearDays}일` },
  ];
  cells.forEach((cell, i) => {
    const cx = M + colW * (i + 0.5);
    setFont(ctx, 700, 54, SERIF);
    text(ctx, cell.value, cx, y + 48, { color: accent, align: 'center' });
    setFont(ctx, 600, 23);
    text(ctx, cell.label, cx, y + 80, { color: INK_2, align: 'center' });
    if (i) {
      ctx.fillStyle = LINE;
      ctx.fillRect(M + colW * i - 1, y + 4, 2, STATS_H - 8);
    }
  });
}

async function drawBrand(ctx, y) {
  const icon = await loadImage('assets/icons/icon-192.png');
  let x = M;
  if (icon) {
    ctx.save();
    roundRect(ctx, x, y - 38, 54, 54, 15);
    ctx.clip();
    ctx.drawImage(icon, x, y - 38, 54, 54);
    ctx.restore();
    x += 54 + 16;
  }
  setFont(ctx, 700, 30);
  text(ctx, '기분날씨', x, y, { color: INK });
  setFont(ctx, 500, 24);
  text(ctx, '오늘 기분을 날씨로 남겨요', W - M, y, { color: INK_3, align: 'right' });
}

// ── 메인 ─────────────────────────────────────────────

export async function renderCard(forecast, sky) {
  const f = forecast;
  await loadFonts(`${f.headline}${f.body.join('')}${f.outlook}${f.tip}`);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 기록이 3일 미만이면 대표 날씨를 정하지 않고 중립 하늘을 쓴다.
  const weather = f.recorded >= 3 ? f.dominant : null;
  const accent = ACCENT[weather ?? 'none'];
  const light = weather !== 'snow'; // 눈 오는 낮 하늘은 밝아서 남색 글자를 쓴다

  // 제목 아래에 사람이 앉을 자리(PERSON)와 보이는 언덕을 남기도록 하늘 높이를 정한다.
  const head = headlineLayout(ctx, f.headline);
  const skyH = Math.round(Math.max(540, (head.bottom + 30 + (PERSON[weather] ?? PERSON.default)) / HILL));
  const PANEL_TOP = Math.round(skyH * HILL + 56);

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  const headWidth = Math.max(...head.lines.map((l) => { setFont(ctx, 700, head.size, SERIF); return ctx.measureText(l).width; }));
  // 제목 글자가 놓일 자리는 해·구름·번개·입자를 비워 달라고 하늘 엔진에 알린다(캔버스 픽셀).
  const keepClear = {
    x: Math.max(0, M - 28),
    y: HEAD_TOP - 6,
    w: Math.min(W, headWidth + 56),
    h: head.bottom - HEAD_TOP + 22,
  };
  await drawSky(ctx, skyH, weather, sky, TEXT_W - headWidth, keepClear);

  // 글자가 읽히도록 위쪽에 옅은 막
  const scrim = ctx.createLinearGradient(0, 0, 0, 340);
  scrim.addColorStop(0, light ? 'rgba(8,16,48,0.34)' : 'rgba(255,255,255,0.18)');
  scrim.addColorStop(1, light ? 'rgba(8,16,48,0)' : 'rgba(255,255,255,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, 340);

  drawHeader(ctx, f, light);
  drawHeadline(ctx, head, light);

  // 종이 패널
  ctx.save();
  ctx.shadowColor = 'rgba(8,16,48,0.28)';
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = -8;
  roundRect(ctx, 0, PANEL_TOP, W, H - PANEL_TOP + 80, [60, 60, 0, 0]);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.restore();

  await drawWeek(ctx, f, PANEL_TOP + 30, accent);
  const stripEnd = PANEL_TOP + 30 + WEEK_H;
  ctx.fillStyle = LINE;
  ctx.fillRect(M, stripEnd + 14, TEXT_W, 2);

  // 본문, 수치, 전망 상자를 남은 공간에 맞춘다. 글자 크기를 줄여 가며 들어가는 첫 크기를 쓴다.
  const FOOT_Y = H - 52;
  const bodyTop = stripEnd + 14 + 2 + 30;
  const limit = FOOT_Y - 60;
  const PAD = 26;
  const INNER_W = TEXT_W - PAD * 2;

  // 먼저 글자를 줄여 보고(27까지), 그래도 안 들어가면 본문 끝 문장을 덜어 낸다.
  // 어떤 길이의 문장이 와도 카드 밖으로 넘치거나 잘리지 않게 하는 안전장치다.
  const layoutAt = (size, bodySentences, withTip, shortOutlook = false) => {
    const sub = Math.max(23, size - 6);
    const lead = words(bodySentences[0], 650, size);
    const rest = bodySentences.slice(1).flatMap((t) => words(t, 400, size));
    const bodyLines = balancedLines(ctx, [...lead, ...rest], TEXT_W, 0.82);
    const outlookText = shortOutlook ? f.outlook.split(/(?<=\.)\s+/)[0] : f.outlook;
    const outlookLines = balancedLines(ctx, words(outlookText, 500, sub), INNER_W, 0.8);
    const tipLines = withTip ? balancedLines(ctx, words(f.tip, 400, sub), INNER_W, 0.8) : [];
    const bodyLH = Math.round(size * 1.56);
    const subLH = Math.round(sub * 1.5);
    const bodyH = bodyLines.length * bodyLH;
    const boxH = PAD + 20 + 8 + outlookLines.length * subLH + PAD - 6
      + (withTip ? 14 + 2 + 14 + 20 + 8 + tipLines.length * subLH : 0);
    const total = bodyH + 26 + STATS_H + 26 + boxH;
    return { size, sub, bodyLines, outlookLines, tipLines, bodyLH, subLH, bodyH, boxH, total, withTip };
  };

  let fit = null;
  // 마음 생활 지수(위로와 농담)는 끝까지 남긴다. 줄이는 것은 본문이다.
  // 위로가 필요한 주(f.sad)는 본문의 마지막 문장이 위로이므로, 줄일 때 가운데 문장부터 덜어 낸다.
  const variants = [f.body];
  if (f.sad && f.body.length > 2) {
    for (let drop = 1; drop < f.body.length - 1; drop += 1) variants.push([f.body[0], ...f.body.slice(drop + 1)]);
    variants.push([f.body[0], f.body[f.body.length - 1]]);
  } else {
    for (let count = f.body.length - 1; count >= 1; count -= 1) variants.push(f.body.slice(0, count));
  }
  const plans = variants.map((body) => ({ body, tip: true, min: 27 }));
  plans.push({ body: variants[variants.length - 1].slice(-1), tip: true, min: 22, short: true });
  search: for (const plan of plans) {
    for (let size = 36; size >= plan.min; size -= 1) {
      const trial = layoutAt(size, plan.body, plan.tip, plan.short);
      fit = trial;
      if (bodyTop + trial.total <= limit) break search;
    }
  }

  // 남는 높이는 구역 사이에 나눈다.
  const gap = Math.min(30, Math.max(0, limit - (bodyTop + fit.total)) / 3);

  let y = bodyTop + fit.size;
  fit.bodyLines.forEach((line, i) => drawLine(ctx, line, M, y + i * fit.bodyLH, INK));
  y = bodyTop + fit.bodyH + 26 + gap;

  drawStats(ctx, f, y, accent);
  y += STATS_H + 26 + gap;

  roundRect(ctx, M, y, TEXT_W, fit.boxH, 26);
  ctx.fillStyle = PAPER_2;
  ctx.fill();
  const label = (str, ly) => {
    setFont(ctx, 700, 20);
    setSpacing(ctx, 1);
    text(ctx, str, M + PAD, ly, { color: accent });
    setSpacing(ctx, 0);
  };
  let ty = y + PAD + 16;
  label('다음 주 전망', ty);
  ty += 8 + fit.sub + 4;
  fit.outlookLines.forEach((line, i) => drawLine(ctx, line, M + PAD, ty + i * fit.subLH, INK));
  ty += (fit.outlookLines.length - 1) * fit.subLH + 14;
  if (fit.withTip) {
    ctx.fillStyle = LINE;
    ctx.fillRect(M + PAD, ty, INNER_W, 2);
    ty += 2 + 14 + 16;
    label('마음 생활 지수', ty);
    ty += 8 + fit.sub + 4;
    fit.tipLines.forEach((line, i) => drawLine(ctx, line, M + PAD, ty + i * fit.subLH, INK_2));
  }

  await drawBrand(ctx, FOOT_Y);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('카드 이미지를 만들지 못했어요.'))), 'image/png');
  });
}
