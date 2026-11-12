// 종이 결: 256×256 타일 1장(mulberry32 고정 시드), 회색 128±22, 불투명 (design-spec §5.1-5)
import { mulberry32 } from '../dates.js';
let tile = null, url = null;
export function grainTile() {
  if (tile) return tile;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); const img = x.createImageData(256, 256); const r = mulberry32(0x5eed1234);
  for (let i = 0; i < 65536; i++) { const v = 128 + Math.round((r() * 2 - 1) * 22); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0); tile = c; return c;
}
export function grainURL() { if (!url) url = grainTile().toDataURL('image/png'); return url; }
// 캔버스 안에 덮기(구슬·카드). ctx는 CSS px 좌표계.
export function applyGrain(ctx, x, y, w, h, alpha = 0.16) {
  const p = ctx.createPattern(grainTile(), 'repeat');
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = alpha; ctx.fillStyle = p; ctx.fillRect(x, y, w, h); ctx.restore();
}
