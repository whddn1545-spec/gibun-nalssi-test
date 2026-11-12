// 작은 사람(앱의 마음), 등불, 눈사람.
// 포즈는 숫자 묶음이고, 날씨가 바뀌면 숫자들이 부드럽게 따라가서 자세가 이어진다.
// 좌표 단위는 CSS px, 원점은 앉은 자리(바닥), 위쪽이 -y.

import { clamp, css, lerp, mixc, mulc, smooth } from './util.js';

// stand 서기, lean 몸 기울기, look 고개(+위 -아래), swing 다리 살랑임,
// armL/armR [팔꿈치x, y, 손x, y] (어깨 기준), leg [무릎x, y, 발x, y] (엉덩이 기준), umb 우산, scarf 목도리
const POSES = {
  neutral: { stand: 0, lean: 0.0, look: 0.7, swing: 0.25, umb: 0, scarf: 0, hug: 0, aL: [-5, 6, -8, 15], aR: [4, 5, 6, 10], leg: [9.5, -1.5, 10.5, 6.5] },
  sunny: { stand: 0, lean: 0.0, look: 0.9, swing: 1, umb: 0, scarf: 0, hug: 0, aL: [-5, 6, -8, 15], aR: [4, 5, 6, 10], leg: [9.5, -1.5, 10.5, 6.5] },
  cloudy: { stand: 0, lean: 0.05, look: -0.8, swing: 0, umb: 0, scarf: 0, hug: 0, aL: [-1, 6, 5, 10], aR: [4, 5, 6, 10], leg: [8, -3.5, 9.5, 2.6] },
  rain: { stand: 0, lean: 0.0, look: 0.2, swing: 0, umb: 1, scarf: 0, hug: 0, aL: [3, 6, 6.5, 10], aR: [5, -3, 5.5, -9], leg: [8, -4, 9.5, 2.4] },
  thunder: { stand: 0, lean: 0.06, look: -0.35, swing: 0, umb: 1, scarf: 0, hug: 1, aL: [2, 6, 7.5, 9], aR: [5, -3, 5.5, -9], leg: [6.5, -9, 5.5, 2] },
  snow: { stand: 0, lean: 0.0, look: 0.55, swing: 0, umb: 0, scarf: 1, hug: 0.5, aL: [0, 6, 6, 9.5], aR: [4, 5, 7, 9.5], leg: [8, -4.5, 9.5, 1.8] },
  rainbow: { stand: 1, lean: 0, look: 1, swing: 0, umb: 0, scarf: 0, hug: 0, aL: [-6, -4, -9.5, -12], aR: [6, -4, 9.5, -12], leg: [0.4, 6, 0.8, 12] },
};

const SKIN = [255, 211, 176];
const HAIR_L = [88, 74, 128];
const HAIR_D = [52, 41, 82];
const SWEAT_L = [255, 182, 108];
const SWEAT = [242, 153, 74];
const SWEAT_D = [222, 126, 54];
const PANTS = [74, 86, 128];
const SHOE = [247, 240, 227];
const ARR = (a) => a.slice();

function limb(ctx, ax, ay, bx, by, cx, cy, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.stroke();
}

export class Figure {
  constructor(reducedMotion) {
    this.reduced = reducedMotion;
    this.pose = { ...POSES.neutral, aL: ARR(POSES.neutral.aL), aR: ARR(POSES.neutral.aR), leg: ARR(POSES.neutral.leg) };
    this.umb = 0;
    this.umbV = 0;
    this.man = 0;
    this.manV = 0;
    this.hop = 0;
    this.wave = 0;
    this.targetKey = 'neutral';
  }

  setTarget(key, instant) {
    this.targetKey = POSES[key] ? key : 'neutral';
    if (instant) {
      const t = POSES[this.targetKey];
      this.pose = { ...t, aL: ARR(t.aL), aR: ARR(t.aR), leg: ARR(t.leg) };
      this.umb = t.umb;
    }
  }

  poked() {
    this.hop = 1;
  }

  update(dt, F) {
    const t = POSES[this.targetKey];
    const k = 1 - Math.exp(-dt / 0.38);
    const p = this.pose;
    for (const key of ['stand', 'lean', 'look', 'swing', 'umb', 'scarf', 'hug']) p[key] += (t[key] - p[key]) * k;
    for (const key of ['aL', 'aR', 'leg']) for (let i = 0; i < 4; i += 1) p[key][i] += (t[key][i] - p[key][i]) * k;
    // 우산은 스프링으로 펴진다
    const target = t.umb;
    this.umbV += ((target - this.umb) * 70 - this.umbV * 9.5) * dt;
    this.umb += this.umbV * dt;
    // 눈사람도 톡 하고 생긴다
    const goal = F.p.snowCover > 0.5 ? 1 : 0;
    this.manV += ((goal - this.man) * 60 - this.manV * 8.5) * dt;
    this.man = clamp(this.man + this.manV * dt, -0.05, 1.3);
    this.hop = Math.max(0, this.hop - dt * 2.2);
  }

  draw(ctx, F) {
    const p = this.pose;
    const t = F.t;
    const mot = F.reduced ? 0 : 1;
    const amb = F.ambSoft;
    const col = (c) => css(mulc(c, amb));
    const stand = clamp(p.stand);
    const sink = F.reduced ? 0 : F.flinchLevel;

    ctx.save();
    ctx.translate(F.px, F.py + 1);
    const hopY = -Math.sin((1 - this.hop) * Math.PI) * 7 * (this.hop > 0 ? 1 : 0);
    const bob = p.swing > 0.3 ? 0 : Math.sin(t * 1.5) * 0.35 * mot;
    ctx.translate(0, hopY + sink * 1.2 + bob);
    const cheer = stand > 0.5 ? Math.sin(t * 3.4) * mot : 0;
    ctx.translate(0, -Math.abs(cheer) * 1.6 * stand);

    const swing = Math.sin(t * 3.3) * p.swing * mot;
    const hipY = -3 - 9 * stand;
    const lean = p.lean + Math.sin(t * 1.25) * 0.03 * p.swing * mot + (sink ? -0.05 * sink : 0);
    const shoulderY = -16 - 9 * stand;

    const pants = col(PANTS);
    const pantsFar = css(mulc(mulc(PANTS, [0.82, 0.82, 0.85]), amb));
    const shoe = col(SHOE);

    // 다리 (뒤쪽 다리 먼저)
    const [kx, ky, fx, fy] = p.leg;
    for (const far of [true, false]) {
      const hx = far ? lerp(1, -3.6, stand) : lerp(3.4, 3.6, stand);
      const hy = hipY - (far ? 1 : 0);
      const a = swing * (far ? -0.7 : 1);
      const lift = far ? 2.4 * (1 - stand) : 0;
      const kneeX = hx + kx;
      const kneeY = hy + ky - lift;
      const footX = hx + fx + a * 2;
      const footY = hy + fy - lift - Math.abs(a) * 0.9;
      limb(ctx, hx, hy, kneeX, kneeY, footX, footY, 4.6, far ? pantsFar : pants);
      ctx.fillStyle = shoe;
      ctx.beginPath();
      ctx.ellipse(footX + 1.2, footY + 0.6, 3.1, 2.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 상체: 엉덩이를 축으로 기울어진다
    ctx.save();
    ctx.translate(0, hipY + 2);
    ctx.rotate(lean);
    ctx.translate(0, -(hipY + 2));

    // 뒤쪽 팔
    const arm = (a, side, shade) => {
      const sx = side * 6;
      const [ex, ey, hx, hy] = a;
      limb(ctx, sx, shoulderY, sx + ex, shoulderY + ey, sx + hx, shoulderY + hy, 3.8, shade);
    };
    const sweatMid = col(SWEAT);
    const sweatDark = col(SWEAT_D);
    arm(p.aL, -1, sweatDark);

    // 몸
    const bodyTop = shoulderY - 3.6;
    const bodyH = 19;
    const bg = ctx.createLinearGradient(-8, bodyTop, 8, bodyTop + bodyH);
    bg.addColorStop(0, col(SWEAT_L));
    bg.addColorStop(0.5, sweatMid);
    bg.addColorStop(1, sweatDark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(-8, bodyTop, 16, bodyH, 7.5);
    ctx.fill();
    // 등의 줄무늬
    ctx.fillStyle = css(mulc([255, 226, 188], amb), 0.75);
    ctx.beginPath();
    ctx.roundRect(-7.6, bodyTop + 8.4, 15.2, 2.6, 1.3);
    ctx.fill();

    // 목도리
    if (p.scarf > 0.02) {
      const sc = clamp(p.scarf);
      const flutter = Math.sin(t * 5 + 1) * (1.5 + F.p.wind * 4) * mot;
      ctx.globalAlpha = sc;
      ctx.fillStyle = col([232, 93, 93]);
      ctx.beginPath();
      ctx.roundRect(-7.8, bodyTop - 2.4, 15.6, 5.2, 2.6);
      ctx.fill();
      ctx.fillStyle = col([200, 66, 70]);
      ctx.fillRect(-6, bodyTop - 0.3, 12, 1.1);
      ctx.save();
      ctx.translate(3.4, bodyTop + 1.4);
      ctx.rotate(0.12 + flutter * 0.06);
      ctx.fillStyle = col([232, 93, 93]);
      ctx.beginPath();
      ctx.roundRect(-2.1, 0, 4.2, 10.5, 2);
      ctx.fill();
      ctx.fillStyle = col([200, 66, 70]);
      ctx.fillRect(-2.1, 7.4, 4.2, 1.1);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      // 깃
      ctx.fillStyle = css(mulc([255, 224, 190], amb), 0.9);
      ctx.beginPath();
      ctx.roundRect(-4.4, bodyTop + 0.2, 8.8, 2.8, 1.4);
      ctx.fill();
    }

    // 머리
    const look = clamp(p.look, -1, 1);
    const headY = bodyTop - 7.2 - look * 0.9 + (stand > 0.5 ? Math.sin(t * 3.4) * 0.6 * mot : 0);
    const headRot = -look * 0.05 + Math.sin(t * 0.8) * 0.02 * mot;
    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate(headRot);
    // 귀
    ctx.fillStyle = col(SKIN);
    ctx.beginPath();
    ctx.arc(-7.1, 1.4, 1.9, 0, Math.PI * 2);
    ctx.arc(7.1, 1.4, 1.9, 0, Math.PI * 2);
    ctx.fill();
    // 목덜미: 고개를 들면 살짝 보인다
    if (look > 0.2) {
      ctx.fillStyle = col(SKIN);
      ctx.beginPath();
      ctx.roundRect(-3, 5.4, 6, 3.2, 1.4);
      ctx.fill();
    }
    const hg = ctx.createRadialGradient(-2.6, -3.4, 0.5, 0, 0, 8.3);
    hg.addColorStop(0, col(HAIR_L));
    hg.addColorStop(1, col(HAIR_D));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(0, 0, 7.4, 0, Math.PI * 2);
    ctx.fill();
    // 뒷머리 가르마 결과 삐죽 머리
    ctx.strokeStyle = col(HAIR_D);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.6, -6.8);
    ctx.quadraticCurveTo(1.2, -10.4, 4.2, -10);
    ctx.stroke();
    ctx.strokeStyle = css(mulc(HAIR_L, amb), 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 5.4, Math.PI * 1.12, Math.PI * 1.45);
    ctx.stroke();
    ctx.restore();

    // 앞쪽 팔
    arm(p.aR, 1, sweatMid);
    // 손
    ctx.fillStyle = col(SKIN);
    for (const [a, side] of [[p.aL, -1], [p.aR, 1]]) {
      ctx.beginPath();
      ctx.arc(side * 6 + a[2], shoulderY + a[3], 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 우산
    const open = this.umb;
    if (open > 0.02 || p.umb > 0.02) this.drawUmbrella(ctx, F, p, shoulderY, open);
    ctx.restore();
    ctx.restore();
  }

  drawUmbrella(ctx, F, p, shoulderY, open) {
    const mot = F.reduced ? 0 : 1;
    const hx = 6 + p.aR[2];
    const hy = shoulderY + p.aR[3];
    const ang = -0.4 + Math.sin(F.t * 1.6) * 0.015 * mot + F.flinchLevel * 0.06 * mot;
    const len = 20;
    const topX = hx + Math.sin(ang) * len;
    const topY = hy - Math.cos(ang) * len;
    const amb = F.ambSoft;
    // 손잡이와 대
    ctx.strokeStyle = css(mulc([122, 90, 72], amb));
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - Math.sin(ang) * 5, hy + Math.cos(ang) * 5);
    ctx.lineTo(topX, topY);
    ctx.stroke();

    const o = clamp(open, 0, 1.12);
    const hw = 1.8 + 15.4 * o;
    const dome = 13.5 - 5.2 * o;
    ctx.save();
    ctx.translate(topX, topY);
    ctx.rotate(ang);
    const col = [255, 201, 60];
    const g = ctx.createLinearGradient(0, -dome, 0, 2);
    g.addColorStop(0, css(mulc([255, 226, 120], amb)));
    g.addColorStop(1, css(mulc([240, 170, 30], amb)));
    ctx.fillStyle = g;
    ctx.beginPath();
    // 우산 살 가장자리는 아래로 둥글게 파인 물결 모양
    ctx.moveTo(-hw, 2);
    ctx.quadraticCurveTo(-hw * 0.9, -dome * 1.05, 0, -dome);
    ctx.quadraticCurveTo(hw * 0.9, -dome * 1.05, hw, 2);
    const n = 4;
    for (let i = 0; i < n; i += 1) {
      const x1 = hw - ((i + 1) * hw * 2) / n;
      const xm = hw - ((i + 0.5) * hw * 2) / n;
      ctx.quadraticCurveTo(xm, 2 + 2.6 * Math.min(1, o + 0.2), x1, 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css(mulc([214, 148, 20], amb), 0.5);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const f of [-0.5, 0, 0.5]) {
      ctx.moveTo(0, -dome);
      ctx.quadraticCurveTo(hw * f * 0.9, -dome * 0.4, hw * f * 1.5 * Math.min(1, 0.67 + 0.33 * o), 1.5);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${(0.35 * o).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(-hw * 0.38, -dome * 0.62, hw * 0.28, dome * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(mulc(col, amb));
    ctx.beginPath();
    ctx.arc(0, -dome - 0.4, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawLantern(ctx, F) {
    const L = F.lantern;
    // 불이 켜질 만큼 어두울 때만 나타난다 (낮의 구름에서는 보이지 않는다)
    const shown = smooth(0.3, 0.55, L);
    if (shown < 0.02) return;
    ctx.save();
    ctx.globalAlpha = shown;
    const x = F.lx;
    const y = F.ly;
    const flick = F.reduced ? 1 : 1 + Math.sin(F.t * 7.1) * 0.025 + Math.sin(F.t * 13.3) * 0.015;
    const R = 62 * flick;
    const gx = ctx.createRadialGradient(x, y - 6, 1, x, y - 6, R);
    gx.addColorStop(0, `rgba(255,205,120,${(0.62 * L).toFixed(3)})`);
    gx.addColorStop(0.35, `rgba(255,180,90,${(0.22 * L).toFixed(3)})`);
    gx.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = gx;
    ctx.fillRect(x - R, y - 6 - R, R * 2, R * 2);
    ctx.save();
    ctx.translate(x, y);
    const body = css(mixc([90, 70, 70], [255, 213, 130], L));
    ctx.strokeStyle = css([108, 82, 70]);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -14.2, 2.6, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = css([108, 82, 70]);
    ctx.beginPath();
    ctx.roundRect(-3.9, -13.6, 7.8, 2.2, 1);
    ctx.roundRect(-3.9, -2, 7.8, 2, 1);
    ctx.fill();
    const lg = ctx.createLinearGradient(0, -12, 0, -2);
    lg.addColorStop(0, css(mixc([120, 100, 100], [255, 236, 170], L)));
    lg.addColorStop(1, body);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.roundRect(-3.4, -12, 6.8, 10, 2.2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${(0.7 * L).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(-1, -8, 1, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  drawSnowman(ctx, F) {
    const s = this.man;
    if (s < 0.02) return;
    ctx.save();
    ctx.translate(F.sx, F.sy + 1);
    ctx.scale(s, s);
    const amb = F.ambSoft;
    const snow = (c) => css(mulc(c, amb));
    const rg = (cx, cy, r) => {
      const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
      g.addColorStop(0, snow([255, 255, 255]));
      g.addColorStop(1, snow([207, 223, 242]));
      return g;
    };
    // 팔
    ctx.strokeStyle = css(mulc([120, 86, 66], amb));
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6.5, -11);
    ctx.lineTo(-12, -15);
    ctx.moveTo(6.5, -11);
    ctx.lineTo(12, -16);
    ctx.stroke();
    ctx.fillStyle = rg(0, -8, 8.6);
    ctx.beginPath();
    ctx.arc(0, -8, 8.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rg(0, -20.5, 6.2);
    ctx.beginPath();
    ctx.arc(0, -20.5, 6.2, 0, Math.PI * 2);
    ctx.fill();
    // 목도리
    ctx.fillStyle = snow([94, 167, 242]);
    ctx.beginPath();
    ctx.roundRect(-5.6, -16.4, 11.2, 3.2, 1.6);
    ctx.fill();
    // 얼굴
    ctx.fillStyle = snow([60, 52, 80]);
    for (const [dx, dy] of [[-2.2, -21.6], [2.2, -21.6], [0, -6], [0, -10]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = snow([255, 150, 60]);
    ctx.beginPath();
    ctx.moveTo(0.3, -20.4);
    ctx.lineTo(5.2, -19.2);
    ctx.lineTo(0.3, -18.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

