// 앱 아이콘(design-spec §10): 1024 기준 그림을 원하는 크기로 그린다. 글자 없음, 앱 그림 코드(해 3톤·언덕·구름 친구·구슬 광택·종이 결) 그대로.
// 바탕 #14365A→#0B1B33(밤의 맑은 하늘), 구슬 중심 (512,500) 지름 720, 안은 낮의 맑음. 마스커블은 지름 640·중심 (512,512)로 안전 원(가운데 80%, 지름 819) 안에.
// fix2b(design-review-final 10): 홈 화면 60pt에서 구름 친구가 보이게 구슬 620→720, 중심 y 470→500, 친구 키 230→300(지름 720 기준), 바닥 그림자 불투명도 절반.
// fix3: 달력 구슬(orb.js)처럼 해를 빛 타원에서 떨어뜨림. 해 중심 (−150u,−118u)=(−.242D,−.190D) → (−.31D, 0)(왼쪽 그대로, 언덕 바로 위).
//   오른쪽 아래로는 친구 모자와 부딪혀 아래로 옮겼다. 해 면적 중 빛 타원과 겹치는 몫 58.6%→6.2%, 겹치는 부분은 불투명도 절반(.275).
import { drawFriend } from './sky/art.js';
import { mix } from './palette.js';
import { grainTile } from './sky/paper.js';
const TAU = Math.PI * 2;

export function drawIcon(c, size, maskable) {
  c.save(); c.scale(size / 1024, size / 1024);
  const bg = c.createLinearGradient(0, 0, 0, 1024); bg.addColorStop(0, '#14365A'); bg.addColorStop(1, '#0B1B33'); c.fillStyle = bg; c.fillRect(0, 0, 1024, 1024);
  const D = maskable ? 640 : 720, R = D / 2, cx = 512, cy = maskable ? 512 : 500, u = D / 620;
  c.fillStyle = 'rgba(5,10,20,.175)'; c.beginPath(); c.ellipse(cx, cy + R * 0.98, 0.42 * D, 0.08 * D, 0, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
  const sky = c.createLinearGradient(0, cy - R, 0, cy + R); sky.addColorStop(0, '#4A9AD4'); sky.addColorStop(1, '#86C8E8'); c.fillStyle = sky; c.fillRect(cx - R, cy - R, D, D);
  // 해 r104(왼쪽, 언덕 바로 위. fix3): 빛무리 + 3톤(초승 빛·원반·그늘)
  const sx = cx - 0.31 * D, sy = cy, sr = 104 * u;
  const halo = c.createRadialGradient(sx, sy, sr * 0.9, sx, sy, sr * 2.3); halo.addColorStop(0, 'rgba(255,241,184,.32)'); halo.addColorStop(1, 'rgba(255,241,184,0)'); c.fillStyle = halo; c.fillRect(cx - R, cy - R, D, D);
  c.save(); c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.clip();
  c.fillStyle = mix('#FFD257', '#FFFFFF', 0.35); c.fillRect(sx - sr, sy - sr, 2 * sr, 2 * sr);
  c.beginPath(); c.arc(sx + sr * 0.09, sy + sr * 0.11, sr, 0, TAU); c.fillStyle = '#FFD257'; c.fill();
  c.beginPath(); c.rect(sx - sr - 2, sy - sr - 2, 2 * sr + 4, 2 * sr + 4); c.arc(sx - sr * 0.13, sy - sr * 0.16, sr, 0, TAU, true); c.fillStyle = mix('#FFD257', '#D97A2B', 0.25); c.fill('evenodd');
  c.restore();
  // 언덕 2겹(능선 y≈640), 능선 빛
  const hill = (y0, amp, col, ph) => { c.beginPath(); c.moveTo(cx - R - 10, cy + R + 10); for (let x = cx - R - 10; x <= cx + R + 10; x += 6) c.lineTo(x, y0 + amp * Math.sin((x - cx) / (150 * u) + ph)); c.lineTo(cx + R + 10, cy + R + 10); c.closePath(); c.fillStyle = col; c.fill(); };
  hill(cy + 118 * u, 14 * u, mix('#3F7D55', '#86C8E8', 0.45), 0.7);
  hill(cy + 166 * u, 10 * u, mix('#3F7D55', '#FFFFFF', 0.12), 2.2); hill(cy + 170 * u, 10 * u, '#3F7D55', 2.2);
  // 구름 친구(키 300 at 지름 720, 밀짚모자, 낮)
  const f = ((300 / 56) * D) / 720, fx = cx + 46 * u, fy = cy + 168 * u + 10 * u * Math.sin(46 / 150 + 2.2);
  drawFriend(c, fx, fy, f, { tod: 'day', w: 'sunny', t: 0, blink: 0, look: 0, up: 0, jump: 0, sx: 1, sy: 1, rot: 0.04, dx: 0, propS: 1, eyes: 'happy', mouth: 'smile', spiky: false, lantern: false, step: 0, wave: 0, heel: 0, cloudCol: null, glow: null });
  // 종이 결, 아랫면 그늘, 빛 타원(§5.7 비율)
  const p = c.createPattern(grainTile(), 'repeat'); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.16; c.fillStyle = p; c.fillRect(cx - R, cy - R, D, D); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.beginPath(); c.rect(cx - R - 4, cy - R - 4, D + 8, D + 8); c.arc(cx - 0.06 * D, cy - 0.09 * D, R, 0, TAU, true); c.fillStyle = 'rgba(10,16,30,.22)'; c.fill('evenodd');
  const hl = (a) => { c.save(); c.translate(cx - 0.22 * D, cy - 0.26 * D); c.rotate((-35 * Math.PI) / 180); c.beginPath(); c.ellipse(0, 0, 0.19 * D, 0.11 * D, 0, 0, TAU); c.fillStyle = `rgba(255,255,255,${a})`; c.fill(); c.restore(); };
  c.save(); c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.clip(); hl(0.275); c.restore(); // 해와 겹치는 부분은 절반(fix3, orb.js와 같음)
  c.save(); c.beginPath(); c.rect(cx - R - 4, cy - R - 4, D + 8, D + 8); c.arc(sx, sy, sr, 0, TAU, true); c.clip('evenodd'); hl(0.55); c.restore();
  c.restore(); c.restore();
}
export function iconURL(size, maskable) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  drawIcon(cv.getContext('2d'), size, maskable); const u = cv.toDataURL('image/png'); cv.width = cv.height = 0; return u;
}
