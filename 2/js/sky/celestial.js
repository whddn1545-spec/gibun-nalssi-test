// 별, 해, 달, 무지개. 모두 하늘색 위, 구름 뒤에 그려진다.

import { clamp, css, makeCanvas, mixc, rng, smooth } from './util.js';

const BOW = [
  [255, 111, 134], [255, 170, 79], [255, 227, 110], [111, 219, 148], [98, 197, 255], [169, 139, 255],
];

function makeMoon(R, pr) {
  const size = R * 2.6;
  const canvas = makeCanvas(size * pr, size * pr);
  const g = canvas.getContext('2d');
  g.scale(pr, pr);
  const c = size / 2;
  // 초승달 바깥의 어두운 부분을 아주 옅게 그려 둥근 달임을 알려 준다
  g.fillStyle = 'rgba(255, 244, 205, .1)';
  g.beginPath();
  g.arc(c, c, R, 0, Math.PI * 2);
  g.fill();
  const body = g.createLinearGradient(c - R, c - R, c + R, c + R);
  body.addColorStop(0, '#FFF8DC');
  body.addColorStop(1, '#FFD978');
  g.fillStyle = body;
  g.beginPath();
  g.arc(c, c, R, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(c + R * 0.46, c - R * 0.2, R * 0.86, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  return { canvas, size };
}

function starPath(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

export class Celestial {
  constructor(pr, reducedMotion) {
    this.reduced = reducedMotion;
    this.moon = null;
    this.moonPr = 0;
    const r = rng(2026);
    this.stars = Array.from({ length: 96 }, (_, i) => ({
      x: r(), y: Math.pow(r(), 1.2), r: 0.6 + r() * 1.1, ph: r() * 6.28, sp: 0.8 + r() * 1.8, big: i % 8 === 0,
    }));
    this.shoot = null;
    this.nextShoot = 6 + r() * 8;
    this.rand = r;
  }

  update(dt, F) {
    if (this.reduced) return;
    this.nextShoot -= dt;
    if (this.shoot) {
      this.shoot.age += dt;
      if (this.shoot.age > 0.9) this.shoot = null;
    } else if (this.nextShoot <= 0) {
      this.nextShoot = 12 + this.rand() * 14;
      if (F.starVis > 0.6) {
        this.shoot = { x: F.w * (0.25 + this.rand() * 0.6), y: F.hillTop * (0.08 + this.rand() * 0.25), age: 0 };
      }
    }
  }

  drawStars(ctx, F) {
    if (F.starVis < 0.02) return;
    const sky = F.hillTop;
    const limit = Math.max(1, Math.floor(this.stars.length * F.q));
    for (let i = 0; i < limit; i += 1) {
      const s = this.stars[i];
      const twinkle = this.reduced ? 0.85 : 0.62 + 0.38 * Math.sin(F.t * s.sp + s.ph);
      const fade = 1 - smooth(0.55, 1, s.y);
      const a = F.starVis * twinkle * fade;
      if (a < 0.02) continue;
      const x = s.x * F.w;
      const y = s.y * sky * 0.96;
      ctx.fillStyle = `rgba(255,250,235,${a.toFixed(3)})`;
      if (s.big) starPath(ctx, x, y, s.r * 3.4);
      else {
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (this.shoot) {
      const s = this.shoot;
      const k = s.age / 0.9;
      const hx = s.x - k * F.w * 0.32;
      const hy = s.y + k * F.w * 0.14;
      const a = Math.sin(k * Math.PI) * F.starVis;
      const g = ctx.createLinearGradient(hx, hy, hx + 60, hy - 26);
      g.addColorStop(0, `rgba(255,252,240,${a.toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,252,240,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + 60, hy - 26);
      ctx.stroke();
    }
  }

  drawSun(ctx, F) {
    const a = F.sunAlpha;
    if (a < 0.01) return;
    const R = F.w * 0.082;
    const { sunX: x, sunY: y } = F;
    const warm = F.sunWarm;
    // 큰 빛무리
    const haloR = R * (4.6 + warm * 1.4);
    const halo = ctx.createRadialGradient(x, y, R * 0.4, x, y, haloR);
    const hc = mixc([255, 226, 150], [255, 150, 110], warm);
    halo.addColorStop(0, css(hc, 0.62 * a));
    halo.addColorStop(0.4, css(hc, 0.2 * a));
    halo.addColorStop(1, css(hc, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - haloR, y - haloR, haloR * 2, haloR * 2);

    // 은은히 도는 빛살 (아이콘의 둥근 선 빛살과 같은 모양)
    const spin = F.t * 0.12;
    ctx.lineCap = 'round';
    ctx.lineWidth = R * 0.27;
    const rc = mixc([255, 214, 110], [255, 140, 90], warm);
    ctx.strokeStyle = css(rc, 0.62 * smooth(0.3, 0.9, a));
    for (let i = 0; i < 8; i += 1) {
      const ang = spin + (i * Math.PI) / 4;
      const breathe = 1 + 0.06 * Math.sin(F.t * 1.4 + i * 1.7);
      const r0 = R * 1.42;
      const r1 = R * (1.42 + 0.34 * breathe);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0);
      ctx.lineTo(x + Math.cos(ang) * r1 * 1.18, y + Math.sin(ang) * r1 * 1.18);
      ctx.stroke();
    }

    const body = ctx.createRadialGradient(x - R * 0.25, y - R * 0.3, 0, x, y, R * 1.12);
    body.addColorStop(0, css(mixc([255, 248, 210], [255, 235, 190], warm), a));
    body.addColorStop(0.5, css(mixc([255, 216, 102], [255, 170, 100], warm), a));
    body.addColorStop(1, css(mixc([255, 155, 54], [255, 100, 80], warm), a));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${(0.55 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x - R * 0.28, y - R * 0.32, R * 0.42, R * 0.27, -0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMoon(ctx, F) {
    const a = F.moonAlpha;
    if (a < 0.01) return;
    const R = F.w * 0.075;
    if (!this.moon || this.moonPr !== F.pr || Math.abs(this.moonR - R) > 1) {
      this.moon = makeMoon(R, F.pr);
      this.moonPr = F.pr;
      this.moonR = R;
    }
    const { moonX: x, moonY: y } = F;
    const haloR = R * 5;
    const halo = ctx.createRadialGradient(x, y, R * 0.5, x, y, haloR);
    halo.addColorStop(0, `rgba(210,222,255,${(0.34 * a).toFixed(3)})`);
    halo.addColorStop(0.45, `rgba(190,205,255,${(0.1 * a).toFixed(3)})`);
    halo.addColorStop(1, 'rgba(190,205,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - haloR, y - haloR, haloR * 2, haloR * 2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(-0.32 + Math.sin(F.t * 0.4) * 0.01);
    ctx.drawImage(this.moon.canvas, -this.moon.size / 2, -this.moon.size / 2, this.moon.size, this.moon.size);
    ctx.restore();
  }

  drawRainbow(ctx, F) {
    const prog = F.bowProg;
    if (prog < 0.005 || F.bowAlpha < 0.01) return;
    let cx = F.w * 0.5;
    let cy = F.hillTop + F.h * 0.012;
    let bw = F.w * 0.032;
    let R = F.w * 0.5;
    if (F.clear) {
      // 카드에서는 제목 아래 남은 자리에 맞춰 사람 오른쪽에 아치를 세운다.
      const room = F.hillTop - (F.clear.y + F.clear.h) - 6;
      R = clamp(room / 0.75, F.w * 0.16, R);
      cx = F.w * 0.66;
      cy = F.hillTop + R * 0.25;
      bw = R * 0.075;
    }
    const end = Math.PI + Math.PI * prog;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = F.bowAlpha;
    // 은은한 번짐
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = bw * BOW.length + 14;
    ctx.beginPath();
    ctx.arc(cx, cy, R - (bw * BOW.length) / 2, Math.PI, end);
    ctx.stroke();
    for (let i = 0; i < BOW.length; i += 1) {
      ctx.strokeStyle = css(BOW[i], 0.9);
      ctx.lineWidth = bw + 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, R - bw * (i + 0.5), Math.PI, end);
      ctx.stroke();
    }
    ctx.restore();
  }
}

