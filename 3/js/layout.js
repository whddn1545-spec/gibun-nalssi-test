// 화면 크기 규칙 (design-spec §4.1, §4.6). 모든 값은 CSS px.
const T = {
  xs: { hero: 72, d1: [26, 32], y: [49, 122, 156, 180], oneLine: true, memo: [14, 20, 3], orb: 38, cell: 64, hole: 34, strip: 52, tab: 48, memoH: 48, saveW: 72, crest: 150, gaps: [34, 30], friend: 44, hint: false, gapPick: 8, gapStrip: 12, info: 20, gapInfo: 4 },
  s: { hero: 96, d1: [32, 38], y: [60, 164, 204, 254], oneLine: false, memo: [15, 22, 2], orb: 44, cell: 74, hole: 38, strip: 58, tab: 52, memoH: 56, saveW: 92, crest: 192, gaps: [46, 42], friend: 52, hint: true, gapPick: 12, gapStrip: 24, info: 28, gapInfo: 12 },
  m: { hero: 104, d1: [34, 40], y: [66, 174, 218, 272], oneLine: false, memo: [15, 22, 2], orb: 48, cell: 78, hole: 40, strip: 60, tab: 52, memoH: 56, saveW: 96, crest: 192, gaps: [46, 42], friend: 56, hint: true, gapPick: 12, gapStrip: 24, info: 28, gapInfo: 12 },
  l: { hero: 112, d1: [36, 44], y: [72, 188, 236, 292], oneLine: false, memo: [15, 22, 2], orb: 52, cell: 82, hole: 44, strip: 64, tab: 56, memoH: 56, saveW: 104, crest: 204, gaps: [50, 46], friend: 60, hint: true, gapPick: 12, gapStrip: 24, info: 28, gapInfo: 12 },
};
export function computeLayout(W, H, sat, sab) {
  const cls = H < 640 ? 'xs' : W < 375 ? 's' : W < 415 ? 'm' : 'l';
  const t = T[cls];
  const narrow = W <= 340;
  const s = Math.min(1.1, Math.max(0.82, W / 390));
  const crest3 = H - sab - t.crest, crest2 = crest3 - t.gaps[0], crest1 = crest2 - t.gaps[1];
  const tabTop = H - sab - t.tab;
  const pickerTop = tabTop - t.gapPick - t.cell;
  const memoTop = H - sab - 4 - t.memoH;
  const stripTop = tabTop - t.gapStrip - t.strip;
  const infoTop = stripTop - t.gapInfo - t.info;
  const hintTop = pickerTop - 12 - 20;
  const pad = narrow ? 16 : 24, outer = narrow ? 12 : 16;
  return {
    cls, W, H, sat, sab, s, t, pad, outer,
    crest: [crest1, crest2, crest3],
    textY: { place: sat + 8, when: sat + 36, temp: sat + t.y[0], name: sat + t.y[1], line: sat + t.y[2], memo: sat + t.y[3] },
    tabTop, pickerTop, memoTop, stripTop, infoTop, hintTop,
    friend: { x: Math.round(0.27 * W), h: t.friend },
    screenX: Math.round(0.78 * W), trees: [Math.round(0.12 * W), Math.round(0.92 * W)], houseX: Math.round(0.58 * W),
    sun: { x: W - 92, y: sat + (cls === 'xs' ? 74 : 96), r: 44 * s },
    moon: { x: W - 92, y: sat + (cls === 'xs' ? 74 : 96), r: 34 * s },
    duskSun: { x: W - 108, y: crest1 - 4, r: 52 * s },
    textBottom: 0.49 * H,
  };
}
