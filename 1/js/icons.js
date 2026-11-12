// 날씨 캐릭터 아이콘. 표정만 봐도 기분이 읽히도록 그렸다.
// 화면에서는 움직이는 SVG로, 공유 카드에서는 같은 그림을 이미지로 쓴다.

let uid = 0;

const INK = '#3A4763';
const CHEEK = '#FF9AA8';

const eye = (x, y, r = 2, fill = INK) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const line = (d, stroke = INK, w = 2) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const cheeks = (x1, x2, y, r = 2.7) =>
  `<circle cx="${x1}" cy="${y}" r="${r}" fill="${CHEEK}" opacity=".55"/><circle cx="${x2}" cy="${y}" r="${r}" fill="${CHEEK}" opacity=".55"/>`;

const cloudBody = (fill) => `<g fill="${fill}">
  <circle cx="20.5" cy="38.5" r="11.5"/>
  <circle cx="33" cy="29.5" r="15.5"/>
  <circle cx="45.5" cy="38.5" r="11"/>
  <rect x="20" y="35" width="26" height="15" />
</g>`;

const gradient = (id, top, bottom) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="13" x2="0" y2="51"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;

const DRAW = {
  clear(p, a) {
    const rays = Array.from({ length: 8 }, (_, i) =>
      `<rect x="29.4" y="3.6" width="5.2" height="9.4" rx="2.6" fill="#FFC557" transform="rotate(${i * 45} 32 32)"/>`).join('');
    return `<defs><radialGradient id="${p}s" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#FFEC9A"/><stop offset="1" stop-color="#FFB43C"/></radialGradient></defs>
      <g class="${a ? 'ic-spin' : ''}">${rays}</g>
      <circle cx="32" cy="32" r="17.6" fill="url(#${p}s)"/>
      ${eye(26, 31)}${eye(38, 31)}
      ${line('M27.5 36.4 Q32 41 36.5 36.4')}
      ${cheeks(22.6, 41.4, 36.2)}`;
  },
  rainbow(p, a) {
    const arc = (r, c) => `<path d="M${32 - r} 43 A${r} ${r} 0 0 1 ${32 + r} 43" fill="none" stroke="${c}" stroke-width="5.4" stroke-linecap="round"/>`;
    return `<defs>${gradient(`${p}c`, '#FBFDFF', '#BFD3EA')}</defs>
      <g class="${a ? 'ic-shine' : ''}">${arc(26.5, '#FF8E93')}${arc(20.8, '#FFC66D')}${arc(15.1, '#86DC9C')}${arc(9.4, '#78BEFF')}</g>
      <g class="${a ? 'ic-bob' : ''}">
        <g transform="translate(9.6 22.4) scale(.7)">${cloudBody(`url(#${p}c)`)}</g>
        ${line('M25 49.6 q2.2 -2.6 4.4 0', INK, 1.9)}${line('M34.6 49.6 q2.2 -2.6 4.4 0', INK, 1.9)}
        <path d="M29 52 q3 4.2 6 0 z" fill="#EC6A7E"/>
        ${cheeks(21.8, 42.2, 52.2, 2.1)}
      </g>`;
  },
  cloud(p, a) {
    return `<defs>${gradient(`${p}c`, '#F8FBFF', '#AFC6E0')}</defs>
      <g class="${a ? 'ic-bob' : ''}">
        ${cloudBody(`url(#${p}c)`)}
        ${eye(26.6, 36)}${eye(39.4, 36)}
        ${line('M29.6 41.6 H36.4')}
        ${cheeks(22.4, 43.6, 40.4, 2.3)}
      </g>`;
  },
  snow(p, a) {
    const arm = (deg) => `<g transform="rotate(${deg} 32 32)">
      <path d="M32 5.5 V19 M32 11.6 L26.8 7.6 M32 11.6 L37.2 7.6" fill="none" stroke="url(#${p}f)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    return `<defs><linearGradient id="${p}f" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="64"><stop offset="0" stop-color="#A5D6FA"/><stop offset="1" stop-color="#6CAFEE"/></linearGradient>
      <radialGradient id="${p}b" cx=".42" cy=".36" r=".8"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D2E7FA"/></radialGradient></defs>
      <g class="${a ? 'ic-spin-slow' : ''}">${[0, 60, 120, 180, 240, 300].map(arm).join('')}</g>
      <circle cx="32" cy="32" r="14.5" fill="url(#${p}b)"/>
      ${line('M24.6 31.4 q2.5 2.8 5 0', INK, 1.9)}${line('M34.4 31.4 q2.5 2.8 5 0', INK, 1.9)}
      ${line('M29.6 37.2 Q32 39.4 34.4 37.2', INK, 1.9)}
      ${cheeks(23.6, 40.4, 36, 2.3)}`;
  },
  wind(p, a) {
    return `<defs>${gradient(`${p}c`, '#F2FBFD', '#B5E2EA')}</defs>
      <g class="${a ? 'ic-sway' : ''}">
        <g transform="translate(-7.5 2)">${cloudBody(`url(#${p}c)`)}
          ${eye(25, 35.4)}${eye(36, 35.4)}
          <ellipse cx="42.6" cy="39.4" rx="2.6" ry="3" fill="${INK}"/>
          ${cheeks(21, 34, 40, 2.3)}
        </g>
      </g>
      <g fill="none" stroke="#58B9D0" stroke-width="3.6" stroke-linecap="round" class="${a ? 'ic-gust' : ''}">
        <path d="M43 33.4 H54.6 a4.2 4.2 0 1 0 -4.2 -4.2"/>
        <path d="M45.5 42 H59"/>
        <path d="M42 50 H52.4 a3.6 3.6 0 1 1 -3.6 3.6"/>
      </g>`;
  },
  fog(p, a) {
    return `<defs>${gradient(`${p}c`, '#EEF2F6', '#B9C4D0')}</defs>
      <g class="${a ? 'ic-bob' : ''}">
        ${cloudBody(`url(#${p}c)`)}
        ${line('M23.4 34.6 H29.4')}${line('M36.6 34.6 H42.6')}
        <circle cx="33" cy="40.4" r="1.8" fill="${INK}"/>
      </g>
      <g stroke-linecap="round" stroke-width="4.6" fill="none">
        <path class="${a ? 'ic-slide' : ''}" d="M9 47.5 H43" stroke="#FFFFFF" opacity=".95"/>
        <path class="${a ? 'ic-slide2' : ''}" d="M21 55 H56" stroke="#AEBBC9"/>
        <circle cx="50" cy="47.5" r="0" />
      </g>`;
  },
  rain(p, a) {
    const drop = (x, y, delay) =>
      `<path class="${a ? 'ic-drop' : ''}" style="${a ? `animation-delay:${delay}s` : ''}" d="M${x} ${y} c-2.8 4 -3.9 6 -3.9 7.6 a3.9 3.9 0 0 0 7.8 0 c0 -1.6 -1.1 -3.6 -3.9 -7.6 z" fill="url(#${p}d)"/>`;
    return `<defs>${gradient(`${p}c`, '#B5C5D9', '#7F96B3')}
      <linearGradient id="${p}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8CC8FF"/><stop offset="1" stop-color="#4294F2"/></linearGradient></defs>
      ${drop(21, 49, 0)}${drop(33, 51, 0.45)}${drop(45, 49, 0.9)}
      <g transform="translate(0 -6)">
        ${cloudBody(`url(#${p}c)`)}
        ${line('M22.8 31.2 L28 33.2', INK, 1.9)}${line('M43.2 31.2 L38 33.2', INK, 1.9)}
        ${eye(26.6, 36.6)}${eye(39.4, 36.6)}
        ${line('M29 44 Q33 40 37 44')}
      </g>`;
  },
  thunder(p, a) {
    return `<defs>${gradient(`${p}c`, '#8F84B6', '#584E80')}
      <linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFEB77"/><stop offset="1" stop-color="#FFAE20"/></linearGradient></defs>
      <path class="${a ? 'ic-flick' : ''}" d="M35.6 36 L23.6 51 H31.4 L27 62.6 L42.4 45.6 H33.8 L39 36 Z" fill="url(#${p}b)" stroke="#FFD74E" stroke-width="1" stroke-linejoin="round"/>
      <g transform="translate(0 -9)" class="${a ? 'ic-shake' : ''}">
        ${cloudBody(`url(#${p}c)`)}
        ${line('M22.4 29.4 L29.6 33.2', '#231C3F', 2.5)}${line('M43.6 29.4 L36.4 33.2', '#231C3F', 2.5)}
        ${eye(27, 36.6, 2.1, '#231C3F')}${eye(39, 36.6, 2.1, '#231C3F')}
        ${line('M28.4 43.6 Q33 40.2 37.6 43.6', '#231C3F', 2.2)}
      </g>`;
  },
};

export function iconSVG(id, { animated = true, size } = {}) {
  const prefix = `i${++uid}`;
  const dim = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${dim} aria-hidden="true" focusable="false">${DRAW[id](prefix, animated)}</svg>`;
}

const imageCache = new Map();
export function iconImage(id, size = 256) {
  const key = `${id}:${size}`;
  if (!imageCache.has(key)) {
    imageCache.set(
      key,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSVG(id, { animated: false, size }))}`;
      }),
    );
  }
  return imageCache.get(key);
}

export const UI = {
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM19.4 13.5l1.6 1.2-2 3.4-1.9-.8a7.4 7.4 0 0 1-1.7 1l-.3 2H10.900l-.3-2a7.4 7.4 0 0 1-1.700-1l-1.900.8-2-3.400 1.600-1.200a7.700 7.700 0 0 1 0-2.000L5 10.300l2-3.400 1.900.8a7.400 7.400 0 0 1 1.700-1l.3-2h4.200l.3 2a7.400 7.400 0 0 1 1.700 1l1.900-.8 2 3.400-1.600 1.200a7.700 7.700 0 0 1 0 2z"/></svg>',
  today: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" d="M5 20.500V11a7 7 0 0 1 14 0v9.500z"/><circle cx="12" cy="11.500" r="2.700" fill="currentColor"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11V7.500a3 3 0 0 1 6 0V11z"/><path d="M14 11V7.500a3 3 0 0 1 6 0V11z"/><path d="M4 21v-3.500a3 3 0 0 1 6 0V21z"/></g><path fill="currentColor" d="M14 21v-3.500a3 3 0 0 1 6 0V21z"/></svg>',
  forecast: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3.500" width="16" height="17.500" rx="3.500" fill="none" stroke="currentColor" stroke-width="1.800"/><circle cx="12" cy="9.800" r="2.500" fill="currentColor"/><path d="M8 16h8M9.800 18.500h4.400" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.500 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.500 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flower: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="12" cy="6.500" r="3.400"/><circle cx="17.200" cy="10.300" r="3.400"/><circle cx="15.200" cy="16.400" r="3.400"/><circle cx="8.800" cy="16.400" r="3.400"/><circle cx="6.800" cy="10.300" r="3.400"/></g><circle cx="12" cy="12" r="2.600" fill="#FFC557"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5.200" fill="currentColor"/><path d="M12 2.500v2.600M12 18.900v2.600M2.500 12h2.600M18.900 12h2.600M5.300 5.300l1.800 1.800M16.900 16.900l1.800 1.800M5.300 18.700l1.800-1.800M16.900 7.100l1.800-1.800" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.500l4.700 4.700L19 7.800" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4.500-4.500M12 15l4.500-4.500M5 20h14" fill="none" stroke="currentColor" stroke-width="2.100" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4l4 4M6 12H5a1 1 0 0 0-1 1v6.500a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V13a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="2.100" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.500 6.500l11 11m0-11l-11 11" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.500v13M5.500 12h13" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"/></svg>',
};
