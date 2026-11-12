// 날씨 아이콘 6종 — 얼굴이 있는 스티커 그림(시안 C). 외부 참조 없는 SVG라 canvas 이미지로도 쓴다.
const INK = '#46352D';
const CLOUD = 'M13 30C8 30 6.5 24 10.5 22C9.5 16 15.5 12.5 20 15.5C22 10 31 9.5 33.5 15.5C38.5 14.5 42 19.5 39.5 23.5C43 26 41 30 36.5 30Z';

const BODY = {
  sunny: `<path d="M24 4.5v4M24 39.5v4M4.5 24h4M39.5 24h4M10.2 10.2l2.8 2.8M35 35l2.8 2.8M10.2 37.8l2.8-2.8M35 13l2.8-2.8" stroke="#FFB43C" stroke-width="3.6" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="12.6" fill="#FFD66B" stroke="${INK}" stroke-width="2.4"/>
    <path d="M18.6 23.8q2.1-2.8 4.2 0M25.2 23.8q2.1-2.8 4.2 0M21.4 27.2q2.6 2.8 5.2 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="17.2" cy="27.6" r="2" fill="#FF9C8C" opacity=".85"/><circle cx="30.8" cy="27.6" r="2" fill="#FF9C8C" opacity=".85"/>`,
  rainbow: `<g fill="none" stroke-width="4.6" stroke-linecap="round">
      <path d="M6.5 35A17.5 17.5 0 0 1 41.5 35" stroke="#FF94A4"/><path d="M11 35A13 13 0 0 1 37 35" stroke="#FFD86E"/><path d="M15.5 35A8.5 8.5 0 0 1 32.5 35" stroke="#8FD8AE"/>
    </g>
    <path d="M5 41C2 41 1.5 36.5 5 36C5 32 10 31 12 34C14 32 18.5 33 18 36.6C20.5 37.2 20 41 17 41Z" fill="#fff" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round"/>
    <path d="M31 41C28 41 27.5 36.5 31 36C31 32 36 31 38 34C40 32 44.5 33 44 36.6C46.5 37.2 46 41 43 41Z" fill="#fff" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round"/>
    <path d="M38 6.5c.5 2.6 1 3.1 3.6 3.6-2.6.5-3.1 1-3.6 3.6-.5-2.6-1-3.1-3.6-3.6 2.6-.5 3.1-1 3.6-3.6z" fill="#FFE16E" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
  cloudy: `<path d="M13 36C8 36 6.5 30 10.5 28C9.5 22 15.5 18.5 20 21.5C22 16 31 15.5 33.5 21.5C38.5 20.5 42 25.5 39.5 29.5C43 32 41 36 36.5 36Z" fill="#E7E8F2" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M18.4 28.2h4M25.6 28.2h4M22 32.4q1-.9 2 0t2 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M8 13.5h7M11 9.5h9" stroke="#C3C7DA" stroke-width="2.4" stroke-linecap="round"/>`,
  snow: `<path d="${CLOUD}" fill="#F4F8FF" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M18.4 21.8q1.9 2 3.8 0M25.8 21.8q1.9 2 3.8 0M22.6 25.4q1.4 1.1 2.8 0" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>
    <g stroke="#88AEE8" stroke-width="1.8" stroke-linecap="round">
      <path d="M15 34.6v6.4M12.2 36.2l5.6 3.2M12.2 39.4l5.6-3.2"/><path d="M24 38.8v6.4M21.2 40.4l5.6 3.2M21.2 43.6l5.6-3.2"/><path d="M33 34.6v6.4M30.2 36.2l5.6 3.2M30.2 39.4l5.6-3.2"/>
    </g>`,
  rain: `<path d="${CLOUD}" fill="#B0C4E5" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M17.6 18.9l3.4-1.3M30.4 18.9l-3.4-1.3M22.4 26.4q1.6-1.4 3.2 0" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="20.2" cy="22.2" r="1.7" fill="${INK}"/><circle cx="27.8" cy="22.2" r="1.7" fill="${INK}"/>
    <path d="M17 33.5c1.7 2.4 2.8 4.2 2.8 5.6a2.8 2.8 0 0 1-5.6 0c0-1.4 1.1-3.2 2.8-5.6z" fill="#7FB3F0" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M31 36c1.7 2.4 2.8 4.2 2.8 5.6a2.8 2.8 0 0 1-5.6 0c0-1.4 1.1-3.2 2.8-5.6z" fill="#7FB3F0" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
  thunder: `<path d="${CLOUD}" fill="#9D8EC3" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M17.4 18l3.6 1.7M30.6 18l-3.6 1.7M22 26.6q2-1.7 4 0" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>
    <circle cx="20.4" cy="22.6" r="1.6" fill="${INK}"/><circle cx="27.6" cy="22.6" r="1.6" fill="${INK}"/>
    <path d="M26.2 29.5L19.6 38.6h4.8l-2.8 7.6 9-11.2h-5l3.2-5.5z" fill="#FFD84D" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`,
};

/** 날씨별 색: 옅은 바탕(tint)·진한 테두리(deep)·빛(glow) */
export const TONE = {
  sunny: { tint: '#FFF2C6', deep: '#F2B53C', glow: 'rgba(242,181,60,.55)' },
  rainbow: { tint: '#FFE4EC', deep: '#F197B2', glow: 'rgba(241,151,178,.55)' },
  cloudy: { tint: '#EEEEF6', deep: '#A9ADC6', glow: 'rgba(140,146,184,.5)' },
  snow: { tint: '#E9F1FF', deep: '#97B5EA', glow: 'rgba(151,181,234,.55)' },
  rain: { tint: '#DFEAF8', deep: '#7B9CD0', glow: 'rgba(123,156,208,.55)' },
  thunder: { tint: '#EDE4FA', deep: '#9A7ECB', glow: 'rgba(154,126,203,.55)' },
};

export function icon(id, cls = 'wicon') {
  return `<svg class="${cls} wi--${id}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${BODY[id] || ''}</svg>`;
}

/** canvas에 그릴 이미지 (카드 이미지용) */
const imgCache = new Map();
export function svgImage(svg) {
  if (imgCache.has(svg)) return imgCache.get(svg);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('svg image'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  imgCache.set(svg, p);
  return p;
}
export function iconImage(id, size = 480) {
  return svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}">${BODY[id] || ''}</svg>`);
}
